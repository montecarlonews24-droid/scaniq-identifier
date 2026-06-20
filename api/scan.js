// SCANIQ proxy — powered by Google Gemini (free tier, no credit card)
// The client (index.html) sends/expects an Anthropic-Messages-style body.
// This function translates that to Gemini's format and back, so the
// rest of the app never needs to know which AI provider is behind it.

// Repairs the most common way Gemini breaks JSON: it embeds a literal
// double-quote inside a string value (e.g. quoting text off a label)
// without escaping it. This walks the text tracking whether we're inside
// a string, and treats a '"' as "real" closing punctuation only when it's
// followed by a JSON structural character (: , } ]) or end of text —
// otherwise it's an internal quote, so it gets escaped instead.
function repairJsonQuotes(raw) {
  let out = '';
  let inStr = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (ch === '\\') { out += ch + (raw[i + 1] || ''); i++; continue; }
      if (ch === '"') {
        let j = i + 1;
        while (j < raw.length && /\s/.test(raw[j])) j++;
        const nextCh = raw[j];
        if (nextCh === undefined || ':,}]'.includes(nextCh)) {
          inStr = false;
          out += ch;
        } else {
          out += '\\"';
        }
        continue;
      }
      out += ch;
    } else {
      if (ch === '"') inStr = true;
      out += ch;
    }
  }
  // Trailing commas before a closing brace/bracket are also a common slip.
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function extractJsonBlock(s) {
  const match = s.match(/\{[\s\S]*\}/);
  return match ? match[0] : s;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'Server misconfigured: GEMINI_API_KEY is not set in Vercel environment variables.' } });
  }

  try {
    const { max_tokens, messages, tools } = req.body || {};

    // Deep Analysis (max_tokens >= 4000) gets the stronger Pro model.
    // Everything else uses Flash (fast, 1500 free requests/day).
    const model = (max_tokens && max_tokens >= 4000) ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

    const hasTools = Array.isArray(tools) && tools.some(t => t.type === 'web_search_20250305');

    // Detect whether the prompt expects a strict JSON object back (every
    // SCANIQ prompt that wants structured data says "PURE JSON ONLY").
    // Free-form chat/translate prompts never contain this marker.
    const wantsJson = (messages || []).some(m => {
      const text = typeof m.content === 'string'
        ? m.content
        : (m.content || []).map(b => b.text || '').join(' ');
      return /\bJSON\b/.test(text);
    });

    // Translate Anthropic-style messages[] into Gemini contents[]
    const contents = (messages || []).map(m => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      let parts;
      if (typeof m.content === 'string') {
        parts = [{ text: m.content }];
      } else {
        parts = (m.content || []).map(block => {
          if (block.type === 'image') {
            return { inline_data: { mime_type: block.source.media_type, data: block.source.data } };
          }
          return { text: block.text || '' };
        });
      }
      return { role, parts };
    });

    const geminiBody = {
      contents,
      generationConfig: { maxOutputTokens: max_tokens || 2000 },
    };

    // Translate the Anthropic web_search tool into Gemini's Google Search grounding
    if (hasTools) {
      geminiBody.tools = [{ google_search: {} }];
    }

    // Gemini's native structured-output mode guarantees syntactically valid
    // JSON. Not compatible with tools/grounding on gemini-2.5 models, so
    // only apply when no tools are used (the tools+JSON case is covered by
    // the repair pass below instead).
    if (wantsJson && !hasTools) {
      geminiBody.generationConfig.responseMimeType = 'application/json';
    }

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: { message: data.error?.message || 'Gemini API error' } });
    }

    const candidate = data.candidates?.[0];
    let text = (candidate?.content?.parts || []).map(p => p.text || '').join('');

    if (!text) {
      const reason = candidate?.finishReason || data.promptFeedback?.blockReason || 'no content returned';
      return res.status(502).json({ error: { message: `Gemini returned no usable content (${reason}). Try again.` } });
    }

    // Safety net: if the model was supposed to return JSON but the result
    // doesn't actually parse (e.g. an unescaped quote slipped through, or
    // this was a tools+JSON request that couldn't use native JSON mode),
    // repair it before handing it back to the client.
    if (wantsJson) {
      const block = extractJsonBlock(text);
      try {
        JSON.parse(block);
      } catch {
        const repaired = repairJsonQuotes(block);
        try {
          JSON.parse(repaired);
          text = text.replace(block, repaired);
        } catch {
          // Repair didn't work either; pass the original through and let
          // the client's own error handling surface it.
        }
      }
    }

    // Respond in the same shape the client already expects from Anthropic
    res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    res.status(500).json({ error: { message: err.message || 'Proxy request failed.' } });
  }
};
