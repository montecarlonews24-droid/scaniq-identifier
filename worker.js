const GEMINI_KEY = 'AIzaSyA6kWGyA2VtSODl33cGMvfByNivUCxhCUA';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({error:{message:'Method not allowed'}}), {
        status: 405,
        headers: {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}
      });
    }

    try {
      const body = await request.json();
      const messages = body.messages || [];
      const maxTokens = body.max_tokens || 2000;

      const wantsJson = messages.some(m =>
        (typeof m.content === 'string' && m.content.includes('PURE JSON ONLY')) ||
        (Array.isArray(m.content) && m.content.some(c => c.text && c.text.includes('PURE JSON ONLY')))
      );

      const useDeep = maxTokens >= 4000;
      const model = useDeep ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

      const geminiContents = messages.map(m => {
        if (typeof m.content === 'string') return {role:'user', parts:[{text: m.content}]};
        const parts = m.content.map(c => {
          if (c.type === 'text') return {text: c.text};
          if (c.type === 'image') return {inline_data:{mime_type: c.source.media_type, data: c.source.data}};
          return null;
        }).filter(Boolean);
        return {role: 'user', parts};
      });

      const geminiBody = {
        contents: geminiContents,
        generationConfig: { maxOutputTokens: Math.max(maxTokens, 3500) }
      };

      if (wantsJson) {
        geminiBody.generationConfig.responseMimeType = 'application/json';
      }

      const key = GEMINI_KEY;
      const resp = await fetch(`${GEMINI_URL}${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(geminiBody)
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Gemini error');

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return new Response(JSON.stringify({
        content: [{type:'text', text}]
      }), {
        headers: {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}
      });

    } catch (err) {
      return new Response(JSON.stringify({error:{message: err.message}}), {
        status: 500,
        headers: {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}
      });
    }
  }
};
