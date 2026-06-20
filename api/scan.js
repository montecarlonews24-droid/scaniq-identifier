// SCANIQ proxy — powered by Google Gemini (free tier, no credit card)
// The client (index.html) sends/expects an Anthropic-Messages-style body.
// This function translates that to Gemini's format and back, so the
// rest of the app never needs to know which AI provider is behind it.

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
    // JSON, eliminating the "Expected ',' or '}'" parse errors that happen
    // when the model free-types JSON and forgets to escape a quote.
    // Not compatible with tools/grounding, so only apply when no tools are used.
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
    const text = (candidate?.content?.parts || []).map(p => p.text || '').join('');

    if (!text) {
      const reason = candidate?.finishReason || data.promptFeedback?.blockReason || 'no content returned';
      return res.status(502).json({ error: { message: `Gemini returned no usable content (${reason}). Try again.` } });
    }

    // Respond in the same shape the client already expects from Anthropic
    res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    res.status(500).json({ error: { message: err.message || 'Proxy request failed.' } });
  }
};
