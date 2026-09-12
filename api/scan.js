// ══════════════════════════════════════════════════════════════
//  LITTLECHEF · /api/scan — estrazione dati da documenti
//  Riceve un file (immagine o PDF) in base64 e chiede a Claude
//  un'estrazione strutturata JSON. Chiave Anthropic SOLO lato server.
//  Il prompt è SPECIFICO per il tipo di destinazione: estrae solo
//  quelle entità e ignora il resto del documento.
//    kind='dishes'      → { items: [{ name, price, category }] }
//    kind='pantry'      → { items: [{ name, price, unit, calcExplanation, packageWarning, crossCheckOk }] }
//                          price è già il prezzo per UNITÀ SINGOLA (a kg/L se
//                          la confezione dichiara un peso/volume): se la riga
//                          di fattura è una confezione multipla (es. "X 6") o
//                          un articolo fatturato a pezzo ma pesato (es. "500G"
//                          a PZ), computePantryItem() applica sconto,
//                          divisione per confezione e conversione a kg/L
//                          PRIMA di rispondere al client — mai lasciato al
//                          modello, mai il prezzo di confezione/a pezzo
//                          spacciato per prezzo unitario o al kg (vedi
//                          computePantryItem più sotto).
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
    'Questo documento può essere una fattura, un listino fornitore, una lista o altro. Estrai SOLO gli INGREDIENTI / MATERIE PRIME di magazzino. ' +
    'IGNORA completamente i piatti del menù e le voci di costo fisso (affitto, utenze, personale): NON sono ingredienti. ' +
    '\n\n' +
    'IMPORTANTE — molte righe di fattura sono CONFEZIONI MULTIPLE (es. una cassa da 6 bottiglie), non il prezzo dell\'unità singola. ' +
    'Estrai i dati GREZZI così come scritti nel documento, SENZA fare tu calcoli o divisioni: al calcolo pensa un altro sistema, tu devi solo leggere. ' +
    '\n\n' +
    'Per OGNI riga, estrai questi campi separati:\n' +
    '- "packagePrice": il prezzo stampato per la riga/confezione (numero, es. 3.15), PRIMA di applicare lo sconto.\n' +
    '- "discountPct": lo sconto così come scritto (numero, es. 25), anche se il simbolo % non è stampato — quasi sempre è una percentuale. null se non c\'è sconto.\n' +
    '- "quantity": il numero di confezioni/pezzi acquistati in quella riga (es. 8 casse). null se non leggibile.\n' +
    '- "lineTotal": l\'importo totale della riga fattura, se presente (es. 18.90). null se assente.\n' +
    '- "unitsPerPackage": SOLO se la descrizione dell\'articolo contiene inequivocabilmente un pattern di CONFEZIONE MULTIPLA — più unità identiche dentro una confezione più grande, es. "X 6", "X 12", "CF. 6", "CF 12", "CT 24", "CONF. DA 6", "SCATOLA DA 12" — estrai il numero (es. 6). Se il pattern non è presente o non è leggibile con certezza, usa null: NON indovinare mai un numero.\n' +
    '- "packageAmbiguous": true SOLO se il testo suggerisce una confezione multipla (parole come CF, CT, CONF, SCATOLA, PACCO, "X <numero>") ma il numero esatto di unità non è leggibile con sicurezza. false/omesso altrimenti (incluso il caso normale di un articolo sfuso senza confezione, es. "Farina 00 sacco 25kg" venduto direttamente a peso).\n' +
    '- "packageSize" e "packageSizeUnit": DIVERSO da unitsPerPackage — qui si tratta del peso/volume di UNA SINGOLA confezione dichiarato nella descrizione (non quante ce ne sono, ma quanto pesa/contiene UNA), es. "500G"→packageSize:500,packageSizeUnit:"G"; "500GR"→500,"GR"; "1 KG"→1,"KG"; "750ML"→750,"ML"; "1L" o "1LT"→1,"L". Frequente quando la fattura fattura "a pezzo" (U.M. PZ) ma l\'articolo è in realtà pesato/misurato (farina, formaggio, pasta, uova, latticini...). Se non c\'è alcuna indicazione di peso/volume nella descrizione, usa null per entrambi — NON indovinare.\n' +
    '- "packageSizeAmbiguous": true SOLO se il testo suggerisce un peso/volume di confezione ma il numero o l\'unità non sono leggibili con sicurezza. false/omesso altrimenti.\n' +
    '- "unit": unità di misura/fatturazione dell\'articolo così come in fattura, cioè la colonna U.M. ("kg", "g", "L", "ml", "pz", o vuoto) — NON confonderla con packageSizeUnit, che è il peso/volume scritto nel NOME del prodotto, un\'informazione diversa e separata.\n' +
    '- "name": nome dell\'ingrediente, ripulito ma riconoscibile.\n' +
    '\n' +
    'Le confezioni multiple (unitsPerPackage) e il peso/volume di una singola confezione (packageSize) sono due cose DIVERSE che possono comparire insieme (es. "cassa da 6 buste da 500g" ha entrambe) o separate: estrai ciascuna in modo indipendente, solo se davvero presente nel testo.\n' +
    '\n' +
    'Rispondi SOLO con JSON valido, nessun altro testo, nel formato: ' +
    '{"items":[{"name":"...","packagePrice":numero o null,"discountPct":numero o null,"quantity":numero o null,"lineTotal":numero o null,"unitsPerPackage":numero o null,"packageAmbiguous":boolean,"packageSize":numero o null,"packageSizeUnit":"G|GR|KG|ML|L|LT o null","packageSizeAmbiguous":boolean,"unit":"..."}]}. ' +
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

// ══════════════════════════════════════════════════════════════
//  Calcolo prezzo per unità singola (Dispensa) — DETERMINISTICO, mai
//  affidato al modello. Claude estrae solo i dati grezzi dalla fattura
//  (packagePrice, discountPct, quantity, lineTotal, unitsPerPackage);
//  qui si fa l'aritmetica, con la stessa disciplina di calcEngine.js:
//  numeri veri, non stimati, con verifica incrociata quando possibile.
// ══════════════════════════════════════════════════════════════

const num = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isFinite(n) ? n : null;
};

// Lo sconto in fattura è quasi sempre una percentuale anche senza il simbolo
// %, ma non è garantito: se abbiamo quantità e importo di riga, verifichiamo
// entrambe le interpretazioni (percentuale vs valore assoluto in €) e
// scegliamo quella che torna con l'importo reale — invece di darla per
// scontata. Tolleranza 2% per arrotondamenti di stampa.
export function resolveDiscount(packagePrice, discountRaw, quantity, lineTotal) {
  if (discountRaw === null || discountRaw <= 0) {
    return { discountedPrice: packagePrice, interpretation: 'none', crossCheckOk: null };
  }
  const asPercent  = packagePrice * (1 - discountRaw / 100);
  const asAbsolute = packagePrice - discountRaw;

  const canCheck = quantity !== null && quantity > 0 && lineTotal !== null && lineTotal > 0;
  if (!canCheck) {
    return { discountedPrice: asPercent, interpretation: 'percent', crossCheckOk: null };
  }
  const diffPercent  = Math.abs(asPercent  * quantity - lineTotal) / lineTotal;
  const diffAbsolute = asAbsolute > 0 ? Math.abs(asAbsolute * quantity - lineTotal) / lineTotal : Infinity;

  if (diffPercent <= 0.02 && diffPercent <= diffAbsolute) {
    return { discountedPrice: asPercent, interpretation: 'percent', crossCheckOk: true };
  }
  if (diffAbsolute <= 0.02 && diffAbsolute < diffPercent) {
    return { discountedPrice: asAbsolute, interpretation: 'absolute', crossCheckOk: true };
  }
  // Nessuna delle due interpretazioni torna con l'importo di riga: si tiene
  // la percentuale (la più comune sulle fatture italiane) ma si segnala.
  return { discountedPrice: asPercent, interpretation: 'percent', crossCheckOk: false };
}

// Peso/volume di UNA SINGOLA confezione (Problema 3) → sempre convertito
// all'unità base kg/L, mai "prezzo al grammo" come nuova unità (coerenza
// con le unità già usate nel resto dell'app).
const PACKAGE_SIZE_UNITS = {
  G:  { base: 'kg', factor: 1 / 1000 },
  GR: { base: 'kg', factor: 1 / 1000 },
  GRAMMI: { base: 'kg', factor: 1 / 1000 },
  KG: { base: 'kg', factor: 1 },
  ML: { base: 'L', factor: 1 / 1000 },
  L:  { base: 'L', factor: 1 },
  LT: { base: 'L', factor: 1 },
};

function resolvePackageSize(sizeRaw, unitRaw) {
  const size = num(sizeRaw);
  if (size === null || size <= 0 || !unitRaw) return null;
  const spec = PACKAGE_SIZE_UNITS[unitRaw.toString().trim().toUpperCase()];
  if (!spec) return null;
  return { sizeInBase: size * spec.factor, baseUnit: spec.base };
}

const eur = n => '€' + (Math.round(n * 10000) / 10000).toFixed(2).replace('.', ',');

export function computePantryItem(raw) {
  const name              = (raw.name || '').toString();
  const packagePrice      = num(raw.packagePrice ?? raw.price); // raw.price: fallback se il modello non segue lo schema
  const discountRaw       = num(raw.discountPct);
  const quantity          = num(raw.quantity);
  const lineTotal         = num(raw.lineTotal);
  const unitsPerPackage   = num(raw.unitsPerPackage);
  const packageAmbiguous  = raw.packageAmbiguous === true;
  const packageSizeAmbiguous = raw.packageSizeAmbiguous === true;
  const rawUnit           = (raw.unit || '').toString();

  if (packagePrice === null) {
    return { name, price: null, unit: rawUnit, packageWarning: null, crossCheckOk: null, calcExplanation: null };
  }

  const { discountedPrice, crossCheckOk } = resolveDiscount(packagePrice, discountRaw, quantity, lineTotal);

  // Passaggio di calcolo leggibile, costruito man mano che si applicano gli
  // step — mostra SEMPRE come si è arrivati al numero finale (Problema 1,
  // punto 3), mai solo il risultato.
  let chain = eur(packagePrice) + (rawUnit ? `/${rawUnit}` : '');
  if (discountRaw !== null && discountRaw > 0) {
    chain += ` (sconto ${discountRaw}%) → ${eur(discountedPrice)}`;
  }

  let runningPrice = discountedPrice;
  let runningUnit  = rawUnit;

  // PROBLEMA 1 — confezione multipla (N unità identiche in una cassa/scatola).
  if (unitsPerPackage !== null && unitsPerPackage > 1) {
    const pricePerPiece = runningPrice / unitsPerPackage;
    chain += ` ÷ ${unitsPerPackage} = ${eur(pricePerPiece)}/pz`;
    runningPrice = pricePerPiece;
    runningUnit  = 'pz';
  } else if (packageAmbiguous) {
    // Confezione sospetta ma numero di unità NON leggibile con certezza →
    // non si indovina: si lascia il prezzo così, si segnala per revisione.
    return {
      name,
      price: Math.round(runningPrice * 10000) / 10000,
      unit: runningUnit,
      packageWarning: 'Confezione multipla non riconosciuta con certezza: questo è il prezzo di confezione, non dell\'unità singola. Verifica manualmente.',
      crossCheckOk,
      calcExplanation: chain,
    };
  }

  // PROBLEMA 3 — peso/volume della singola confezione → prezzo a kg/L
  // invece che a pezzo (es. "500G" a PZ diventa prezzo al kg).
  const sizeResolved = !packageSizeAmbiguous ? resolvePackageSize(raw.packageSize, raw.packageSizeUnit) : null;
  let warning = null;

  if (sizeResolved) {
    const { sizeInBase, baseUnit } = sizeResolved;
    const pricePerBase = runningPrice / sizeInBase;
    const sizeLabel = `${raw.packageSize}${(raw.packageSizeUnit || '').toString().toUpperCase()}`;
    chain += ` (confezione ${sizeLabel}) ÷ ${sizeInBase} = ${eur(pricePerBase)}/${baseUnit}`;
    runningPrice = pricePerBase;
    runningUnit  = baseUnit;
  } else if (packageSizeAmbiguous) {
    // Peso/volume sospettato ma non leggibile con certezza → non si
    // indovina: si lascia il prezzo così com'è, si segnala per revisione.
    warning = 'Peso/volume della confezione non riconosciuto con certezza: questo prezzo potrebbe non essere per kg/L. Verifica manualmente.';
  }

  return {
    name,
    price: Math.round(runningPrice * 10000) / 10000,
    unit: runningUnit || 'pz',
    packageWarning: warning,
    crossCheckOk,
    calcExplanation: chain,
  };
}

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
        max_tokens: 8000, // margine per fatture multi-pagina con molte righe (Problema 2)
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

    // Dispensa: calcolo deterministico prezzo per unità singola (mai lasciato al modello)
    const items = kind === 'pantry' ? parsed.items.map(computePantryItem) : parsed.items;

    res.status(200).json({ items });
  } catch (err) {
    res.status(502).json({ error: { message: `Errore scanner: ${err.message}` } });
  }
}
