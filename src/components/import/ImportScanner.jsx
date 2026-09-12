// ══════════════════════════════════════════════════════════════
//  LITTLECHEF · ImportScanner — scanner documenti contestuale (Stage 6A)
//  Foto/PDF → /api/scan (Claude, chiave lato server) · Excel/CSV → xlsx.
//  PARAMETRICO sul tipo di destinazione, deciso da CHI lo apre:
//    kind='pantry'      → dispensa / ingredienti (pantry_items)
//    kind='fixed_costs' → voci di costo fisso (fixed_costs)
//    kind='dishes'      → piatti del menù (dishes)
//  Prompt di estrazione e colonne di revisione si adattano al tipo.
//  SEMPRE una revisione modificabile PRIMA di scrivere su Supabase.
//  Nessun salvataggio automatico o silenzioso, mai.
// ══════════════════════════════════════════════════════════════
import { useState, useRef, Fragment } from 'react';
import * as XLSX from 'xlsx';
import { saveToDB } from '../../lib/dataService';
import { MAX_DISH_PRICE, MAX_INGREDIENT_PRICE } from '../../lib/config';

const uid = () => Math.random().toString(36).slice(2, 10);
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? '' : n; };

// Oltre questa soglia il base64 (+33% di peso) supera il limite di payload
// delle funzioni serverless Vercel (4.5MB): la richiesta verrebbe rifiutata
// dalla piattaforma prima ancora di raggiungere /api/scan, con un errore
// poco chiaro. Blocchiamo qui con un messaggio esplicito (Problema 2).
const MAX_SCAN_FILE_BYTES = 3 * 1024 * 1024; // 3MB

// Configurazione per tipo di destinazione
const KINDS = {
  pantry: {
    title: '📷 Importa ingredienti in Dispensa',
    secondCol: { key: 'unit', label: 'Unità' },
    priceLabel: 'Prezzo €/unità',
    emptyMsg: 'Non ho trovato ingredienti o materie prime in questo documento. Prova con una fattura o un listino fornitore.',
    store: 'ingredients',
  },
  fixed_costs: {
    title: '📷 Importa voci di costo fisso',
    secondCol: null,
    priceLabel: 'Importo €/mese',
    emptyMsg: 'Non ho trovato voci di costo fisso in questo documento. Prova con una fattura di affitto, utenze o servizi.',
    store: 'fixed_costs',
  },
  dishes: {
    title: '📷 Importa piatti nel Menù',
    secondCol: { key: 'category', label: 'Categoria' },
    priceLabel: 'Prezzo €',
    emptyMsg: 'Non ho trovato piatti di menù in questo documento. Prova con la foto di un menù.',
    store: 'dishes',
  },
};

// Mappa best-effort le colonne di un foglio in base al tipo
function mapSpreadsheet(sheetRows, kind) {
  if (!sheetRows.length) return [];
  const keys = Object.keys(sheetRows[0]);
  const find = (...cands) => keys.find(k => cands.some(c => k.toLowerCase().includes(c)));
  const kName   = find('nome', 'name', 'prodotto', 'piatto', 'voce', 'descr', 'articolo');
  const kPrice  = find('prezzo', 'price', 'costo', 'importo', '€', 'eur', 'amount');
  const kUnit   = find('unità', 'unita', 'unit', 'um', 'misura');
  const kCat    = find('categoria', 'category', 'reparto', 'sezione');
  return sheetRows.map(r => {
    const base = { id: uid(), name: (r[kName] || '').toString(), price: num(r[kPrice]) };
    if (kind === 'dishes')      return { ...base, category: (r[kCat] || '').toString().toUpperCase() };
    if (kind === 'pantry')      return { ...base, unit: (r[kUnit] || '').toString() };
    return base; // fixed_costs
  }).filter(x => x.name.trim());
}

// Normalizza gli item ritornati da /api/scan in base al tipo
function mapScanned(items, kind) {
  return (items || []).map(it => {
    const base = { id: uid(), name: (it.name || '').toString() };
    if (kind === 'dishes')      return { ...base, price: num(it.price), category: (it.category || '').toString().toUpperCase() };
    if (kind === 'pantry')      return {
      ...base, price: num(it.price), unit: (it.unit || '').toString(),
      // Trasparenza calcolo (Problema 1, punto 3 / Problema 3) — mai solo il
      // numero finale: calcExplanation arriva già pronta da computePantryItem.
      calcExplanation: it.calcExplanation || null,
      packageWarning:  it.packageWarning || null,
      crossCheckOk:    it.crossCheckOk ?? null,
    };
    return { ...base, price: num(it.amount) }; // fixed_costs: amount → price
  }).filter(x => x.name.trim());
}

export function ImportScanner({ kind = 'dishes', onClose, onImported }) {
  const cfg = KINDS[kind] || KINDS.dishes;
  const [step,  setStep]  = useState('pick');   // pick | loading | review | saving | empty
  const [rows,  setRows]  = useState([]);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const fileToBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const name = file.name.toLowerCase();
    const isSheet = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv') || file.type.includes('sheet') || file.type === 'text/csv';

    if (isSheet) {
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const mapped = mapSpreadsheet(json, kind);
        if (!mapped.length) { setStep('empty'); return; }
        setRows(mapped);
        setStep('review');
      } catch (err) {
        setError('Impossibile leggere il file: ' + err.message);
      }
      return;
    }

    // Immagine o PDF → /api/scan (prompt specifico per tipo)
    if (file.size > MAX_SCAN_FILE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      const maxMb = (MAX_SCAN_FILE_BYTES / (1024 * 1024)).toFixed(0);
      setError(`File troppo grande (${mb}MB): il limite per foto/PDF è ${maxMb}MB. Comprimi il file o scatta una foto a risoluzione più bassa.`);
      return;
    }

    setStep('loading');
    try {
      const b64 = await fileToBase64(file);
      const resp = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: b64, mediaType: file.type || 'image/jpeg', kind }),
      });
      // La piattaforma (Vercel) può rifiutare la richiesta PRIMA che /api/scan
      // la veda (es. payload troppo pesante): in quel caso il corpo non è
      // JSON e resp.json() lancerebbe un errore poco chiaro — lo gestiamo
      // esplicitamente invece di far fallire il parsing in modo silenzioso.
      let data;
      try {
        data = await resp.json();
      } catch {
        throw new Error(
          resp.status === 413
            ? 'File troppo grande per essere elaborato dal server. Riducilo e riprova.'
            : `Errore del server (${resp.status}). Riprova con un file più leggero o in un altro formato.`
        );
      }
      if (!resp.ok) throw new Error(data?.error?.message || 'Estrazione non riuscita');
      const mapped = mapScanned(data.items, kind);
      if (!mapped.length) { setStep('empty'); return; }
      setRows(mapped);
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('pick');
    }
  }

  const updateRow = (i, field, val) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const removeRow = i => setRows(prev => prev.filter((_, idx) => idx !== i));

  async function handleConfirm() {
    setStep('saving');
    setError(null);
    try {
      let saved = 0;
      for (const r of rows) {
        if (!r.name?.trim()) continue;
        const price = num(r.price);
        if (kind === 'dishes') {
          if (price === '' || price <= 0 || price > MAX_DISH_PRICE) continue;
          await saveToDB('dishes', {
            id: `dish_${uid()}`, name: r.name.trim(),
            category: (r.category || 'ANTIPASTO').toUpperCase(),
            price, selling_price: price, food_cost: 0,
            components: [], isVisible: true,
            ingredientUpdatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } else if (kind === 'pantry') {
          if (price !== '' && (price < 0 || price > MAX_INGREDIENT_PRICE)) continue;
          await saveToDB('ingredients', {
            id: `ing_${uid()}`, name: r.name.trim(),
            unit: r.unit || 'kg', price: price || 0, price_per_unit: price || 0,
            waste: 0, _isPrep: false, updated_at: new Date().toISOString(),
          });
        } else { // fixed_costs
          if (price === '' || price <= 0) continue;
          await saveToDB('fixed_costs', {
            id: `fc_${uid()}`, name: r.name.trim(),
            type: 'Altro', amount_monthly: price, note: '',
            updated_at: new Date().toISOString(),
          });
        }
        saved++;
      }
      onImported?.(saved, kind);
      onClose();
    } catch (err) {
      setError('Errore durante il salvataggio: ' + err.message);
      setStep('review');
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 640, width: '100%' }}>
        <div className="modal-header">
          <span className="modal-title">{cfg.title}</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && (
            <div style={{ background: 'var(--status-risk-bg)', borderLeft: '3px solid var(--status-risk)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--status-risk)', marginBottom: 12 }}>
              {error}
            </div>
          )}

          {step === 'pick' && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf,.xlsx,.xls,.csv"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', minHeight: 48 }} onClick={() => fileRef.current?.click()}>
                📎 Scegli file o scatta una foto
              </button>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12, textAlign: 'center' }}>
                {kind === 'pantry'      && 'Estrarrò solo gli ingredienti/materie prime da una fattura o listino.'}
                {kind === 'fixed_costs' && 'Estrarrò solo le voci di costo fisso mensile (affitto, utenze, personale…).'}
                {kind === 'dishes'      && 'Estrarrò solo i piatti con il prezzo di vendita da un menù.'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                Accetta foto (JPG/PNG), PDF, Excel o CSV, fino a 3MB. Su telefono puoi scattare la foto al momento.
              </p>
            </>
          )}

          {step === 'loading' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Sto leggendo il documento…</p>
            </div>
          )}

          {step === 'empty' && (
            <div style={{ textAlign: 'center', padding: '24px 8px' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🤔</div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{cfg.emptyMsg}</p>
              <button className="btn-secondary" style={{ marginTop: 16, minHeight: 44 }} onClick={() => { setRows([]); setError(null); setStep('pick'); }}>
                Riprova con un altro file
              </button>
            </div>
          )}

          {step === 'review' && (
            <>
              <div style={{ background: 'var(--gold-light)', border: '1px solid var(--gold-badge)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--gold-text)', margin: 0, lineHeight: 1.5 }}>
                  ⚠️ <strong>Controlla i dati estratti prima di confermare.</strong> I dati da foto possono contenere errori di lettura: correggi o elimina le righe sbagliate. Nulla viene salvato finché non premi Conferma.
                </p>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '46vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11 }}>
                      <th style={{ padding: '6px 4px' }}>Nome</th>
                      {cfg.secondCol && <th style={{ padding: '6px 4px' }}>{cfg.secondCol.label}</th>}
                      <th style={{ padding: '6px 4px', width: 96 }}>{cfg.priceLabel}</th>
                      <th style={{ width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const calc = kind === 'pantry' ? r.calcExplanation : null;
                      const showCrossCheckWarning = kind === 'pantry' && r.crossCheckOk === false;
                      const hasNote = calc || r.packageWarning || showCrossCheckWarning;
                      return (
                        <Fragment key={r.id}>
                          <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '4px' }}>
                              <input className="form-input" value={r.name} onChange={e => updateRow(i, 'name', e.target.value)} style={{ padding: '6px 8px', fontSize: 16 }} />
                            </td>
                            {cfg.secondCol && (
                              <td style={{ padding: '4px' }}>
                                <input className="form-input" value={r[cfg.secondCol.key] || ''} onChange={e => updateRow(i, cfg.secondCol.key, e.target.value)} style={{ padding: '6px 8px', fontSize: 16 }} />
                              </td>
                            )}
                            <td style={{ padding: '4px' }}>
                              <input className="form-input" type="number" step="0.01" value={r.price} onChange={e => updateRow(i, 'price', e.target.value)} style={{ padding: '6px 8px', fontSize: 16, fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button className="btn-icon" onClick={() => removeRow(i)} style={{ color: 'var(--status-risk)', minWidth: 44, minHeight: 44 }}>🗑️</button>
                            </td>
                          </tr>
                          {hasNote && (
                            <tr>
                              <td colSpan={cfg.secondCol ? 4 : 3} style={{ padding: '0 4px 8px' }}>
                                {calc && (
                                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, fontFamily: 'var(--font-mono)' }}>
                                    🧮 {calc}
                                  </p>
                                )}
                                {r.packageWarning && (
                                  <p style={{ fontSize: 11, color: 'var(--gold-text)', margin: '2px 0 0', fontWeight: 600 }}>
                                    ⚠️ {r.packageWarning}
                                  </p>
                                )}
                                {showCrossCheckWarning && (
                                  <p style={{ fontSize: 11, color: 'var(--status-risk)', margin: '2px 0 0' }}>
                                    ⚠️ Il calcolo non coincide con l'importo di riga in fattura: verifica sconto e quantità.
                                  </p>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 0' }}>{rows.length} righe pronte da importare.</p>
            </>
          )}

          {step === 'saving' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>💾</div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Salvataggio in corso…</p>
            </div>
          )}
        </div>

        {step === 'review' && (
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose} style={{ minHeight: 44 }}>Annulla</button>
            <button className="btn-primary" onClick={handleConfirm} disabled={rows.length === 0} style={{ minHeight: 44 }}>
              Conferma e importa {rows.length}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportScanner;
