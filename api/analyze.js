export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[analyze] GEMINI_API_KEY not set');
    return res.status(500).json({ error: 'API 키가 설정되지 않았습니다' });
  }

  try {
    const body = req.body;
    if (!body || !body.messages) {
      return res.status(400).json({ error: '요청 형식이 잘못되었습니다' });
    }

    // Claude 메시지 형식 → Gemini 형식 변환
    const userMessage = body.messages[0];
    const parts = [];

    if (Array.isArray(userMessage.content)) {
      for (const block of userMessage.content) {
        if (block.type === 'image') {
          parts.push({
            inlineData: {
              mimeType: block.source.media_type,
              data: block.source.data
            }
          });
        } else if (block.type === 'text') {
          parts.push({ text: block.text });
        }
      }
    } else {
      parts.push({ text: userMessage.content });
    }

    const geminiBody = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 1024
      }
    };

    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    console.log('[analyze] Calling Gemini, parts:', parts.length);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody)
    });

    const data = await response.json();
    console.log('[analyze] Gemini status:', response.status);

    if (!response.ok) {
      console.error('[analyze] Gemini error:', JSON.stringify(data).slice(0, 300));
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API 오류' });
    }

    // Gemini 응답 → Claude 응답 형식으로 래핑 (기존 HTML 코드와 호환)
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[analyze] Gemini response length:', text.length);

    res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (e) {
    console.error('[analyze] Exception:', e.message);
    res.status(500).json({ error: e.message });
  }
}
