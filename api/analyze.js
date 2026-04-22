export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[analyze] ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'API 키가 설정되지 않았습니다' });
  }

  try {
    const body = req.body;
    if (!body || !body.messages) {
      console.error('[analyze] Invalid request body:', JSON.stringify(body)?.slice(0, 200));
      return res.status(400).json({ error: '요청 형식이 잘못되었습니다' });
    }

    console.log('[analyze] Calling Anthropic, model:', body.model, 'messages:', body.messages?.length);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: body.model,
        max_tokens: body.max_tokens || 1024,
        messages: body.messages,
        temperature: 0
      })
    });

    const data = await response.json();
    console.log('[analyze] Anthropic status:', response.status, 'content length:', data?.content?.[0]?.text?.length);

    if (!response.ok) {
      console.error('[analyze] Anthropic error:', JSON.stringify(data).slice(0, 300));
    }

    res.status(response.status).json(data);
  } catch (e) {
    console.error('[analyze] Exception:', e.message);
    res.status(500).json({ error: e.message });
  }
}
