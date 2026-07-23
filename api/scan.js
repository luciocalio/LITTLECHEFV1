// ══════════════════════════════════════════════════════════════
//  LITTLECHEF · /api/scan — estrazione dati da documenti
//  Riceve un file (immagine o PDF) in base64 e chiede a Claude
//  un'estrazione strutturata JSON. Chiave Anthropic SOLO lato server.
//  Il prompt è SPECIFICO per il tipo di destinazione: estrae solo
//  quelle entità e ignora il resto del documento.
//    kind='dishes'      → { items: [{ name, price, category }] }
//    kind='pantry'      → { items: [{ name, quantity, unit, price }] }
//    kind='fixed_costs' → { items: [{ name, amount }] }
// ══════════════════════════════════════════════════════════════

const PROMPTS = {
  dishes:
    'Questo documento può essere un menù, una lista o altro. Estrai SOLO i PIATTI/PRODOTTI DEL MENÙ con il loro prezzo di vendita. ' +
    'IGNORA completamente ingredienti di magazzino, voci di costo, fatture fornitori: NON sono piatti. ' +
    'Rispondi SOLO con JSON valido, nessun altro testo, nel formato: ' +
    '{"items":[{"name":"nome piatto","price":numero,"category":"ANTIPASTO|PRIMO|SECONDO|DOLCE|BEVANDE o vuoto"}]}. ' +
    'Il prezzo è un numero (es. 12.50), senza simbolo €. Se un prezzo non è leggibile usa null. ' +
    'Se nel documento non ci sono piatti di menù, rispondi {"items":[]}.',
  pantry:
    'Questo documento può essere una fattura, un listino fornitore, una lista o altro. Estrai SOLO gli INGREDIENTI / MATERIE PRIME di magazzino con il prezzo per unità. ' +
    'IGNORA completamente i piatti del menù e le voci di costo fisso (affitto, utenze, personale): NON sono ingredienti. ' +
    'Rispondi SOLO con JSON valido, nessun altro testo, nel formato: ' +
    '{"items":[{"name":"nome ingrediente","quantity":numero o null,"unit":"kg|g|L|ml|pz o vuoto","price":numero}]}. ' +
    'Il prezzo è un numero per unità (es. 8.50), senza simbolo €. Se un valore non è leggibile usa null. ' +
    'Se nel documento non ci sono ingredienti, rispondi {"items":[]}.',
  fixed_costs:
    'Questo documento può essere una fattura, un estratto conto, una lista di spese o altro. Estrai SOLO le VOCI DI COSTO FISSO mensile ' +
    '(es. affitto, utenze luce/gas/acqua, personale/stipendi, software, assicurazione, commercialista, manutenzione, TARI, telefono/internet, marketing). ' +
    'IGNORA completamente i piatti del menù e gli ingredienti/materie prime: NON sono costi fissi. ' +
    'Rispondi SOLO con JSON valido, nessun altro testo, nel formato: ' +
    '{"items":[{"name":"nome voce di costo","amount":numero}]}. ' +
    'L\'importo è il costo mensile come numero (es. 2000), senza simbolo €. Se un valore non è leggibile usa null. ' +
    'Se nel documento non ci sono voci di costo fisso, rispondi {"items":[]}.',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: { message: 'Metodo non consentito' } }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY non configurata sul server' } }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { fileBase64, mediaType, kind } = body || {};
  if (!fileBase64 || !mediaType) { res.status(400).json({ error: { message: 'file mancante' } }); return; }

  const prompt = PROMPTS[kind] || PROMPTS.menu;
  const isPdf = mediaType === 'application/pdf';
  const mediaBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
    : { type: 'image',    source: { type: 'base64', media_type: mediaType, data: fileBase64 } };

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content: [mediaBlock, { type: 'text', text: prompt }] }],
      }),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) { res.status(upstream.status).json(data); return; }

    // Estrai il testo e prova a parsare il JSON
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    let parsed = null;
    const match = text.match(/\{[\s\S]*\}/);
    if (match) { try { parsed = JSON.parse(match[0]); } catch { /* ignore */ } }

    if (!parsed || !Array.isArray(parsed.items)) {
      res.status(422).json({ error: { message: 'Estrazione non riuscita: il documento non è leggibile o non contiene dati riconoscibili.' }, raw: text });
      return;
    }
    res.status(200).json({ items: parsed.items });
  } catch (err) {
    res.status(502).json({ error: { message: `Errore scanner: ${err.message}` } });
  }
}
