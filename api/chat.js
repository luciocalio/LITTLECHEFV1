// ══════════════════════════════════════════════════════════════
//  LITTLECHEF · /api/chat — Vercel Serverless Function
//  Proxy verso l'API Anthropic. La chiave ANTHROPIC_API_KEY vive
//  SOLO qui (server), mai nel bundle client. Il loop agentico resta
//  lato client: esegue i tool e rimanda i tool_result a ogni giro.
// ══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // CORS — l'app è same-origin in produzione; header permissivi per sicurezza
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: { message: 'Metodo non consentito' } }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY non configurata sul server' } });
    return;
  }

  // Body: può arrivare già parsato (Vercel) o come stringa
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { model, max_tokens, system, tools, messages } = body || {};

  if (!Array.isArray(messages)) {
    res.status(400).json({ error: { message: 'messages mancante o non valido' } });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      model      || 'claude-sonnet-4-6',
        max_tokens: max_tokens || 2000,
        system,
        tools,
        messages,
      }),
    });

    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: { message: `Errore proxy Anthropic: ${err.message}` } });
  }
}
