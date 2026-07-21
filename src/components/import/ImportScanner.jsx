// ══════════════════════════════════════════════════════════════
//  LITTLECHEF · ImportScanner — scanner documenti (Stage 5)
//  Foto/PDF → /api/scan (Claude, chiave lato server) · Excel/CSV → xlsx.
//  SEMPRE una schermata di revisione modificabile PRIMA di scrivere
//  qualsiasi cosa su Supabase. Nessun salvataggio automatico.
// ══════════════════════════════════════════════════════════════
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { saveToDB } from '../../lib/dataService';
import { MAX_DISH_PRICE, MAX_INGREDIENT_PRICE } from '../../lib/config';

const uid = () => Math.random().toString(36).slice(2, 10);
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? '' : n; };

// Mappa best-effort delle colonne di un foglio a nome/prezzo/unità/quantità
function mapSpreadsheet(rows, kind) {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  const find = (...cands) => keys.find(k => cands.some(c => k.toLowerCase().includes(c)));
  const kName  = find('nome', 'name', 'prodotto', 'piatto', 'descr', 'articolo');
  const kPrice = find('prezzo', 'price', 'costo', 'importo', '€', 'eur');
  const kUnit  = find('unità', 'unita', 'unit', 'um', 'misura');
  const kQty   = find('quantità', 'quantita', 'qty', 'quant');
  const kCat   = find('categoria', 'category', 'reparto', 'sezione');
  return rows.map(r => kind === 'menu'
    ? { id: uid(), name: r[kName] || '', price: num(r[kPrice]), category: (r[kCat] || '').toString().toUpperCase() }
    : { id: uid(), name: r[kName] || '', price: num(r[kPrice]), unit: (r[kUnit] || '').toString(), quantity: kQty ? num(r[kQty]) : '' }
  ).filter(x => x.name);
}

export function ImportScanner({ onClose, onImported }) {
  const [kind,   setKind]   = useState('menu');       // 'menu' | 'invoice'
  const [step,   setStep]   = useState('pick');        // pick | loading | review | saving
  const [rows,   setRows]   = useState([]);
  const [error,  setError]  = useState(null);
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
        if (!mapped.length) { setError('Nessuna riga riconosciuta nel foglio. Controlla che ci siano colonne con nome e prezzo.'); return; }
        setRows(mapped);
        setStep('review');
      } catch (err) {
        setError('Impossibile leggere il file: ' + err.message);
      }
      return;
    }

    // Immagine o PDF → /api/scan
    setStep('loading');
    try {
      const b64 = await fileToBase64(file);
      const resp = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: b64, mediaType: file.type || 'image/jpeg', kind }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || 'Estrazione non riuscita');
      const mapped = (data.items || []).map(it => kind === 'menu'
        ? { id: uid(), name: it.name || '', price: num(it.price), category: (it.category || '').toString().toUpperCase() }
        : { id: uid(), name: it.name || '', price: num(it.price), unit: (it.unit || '').toString(), quantity: num(it.quantity) }
      ).filter(x => x.name);
      if (!mapped.length) { setError('Nessun dato riconosciuto nel documento.'); setStep('pick'); return; }
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
        if (kind === 'menu') {
          if (price === '' || price <= 0 || price > MAX_DISH_PRICE) continue;
          await saveToDB('dishes', {
            id: `dish_${uid()}`, name: r.name.trim(),
            category: r.category || 'ANTIPASTO',
            price, selling_price: price, food_cost: 0,
            components: [], isVisible: true,
            ingredientUpdatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } else {
          if (price !== '' && (price < 0 || price > MAX_INGREDIENT_PRICE)) continue;
          await saveToDB('ingredients', {
            id: `ing_${uid()}`, name: r.name.trim(),
            unit: r.unit || 'kg', price: price || 0, price_per_unit: price || 0,
            waste: 0, _isPrep: false, updated_at: new Date().toISOString(),
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
          <span className="modal-title">📷 Importa da documento</span>
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
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Cosa vuoi importare?</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[{ id: 'menu', label: '🍽️ Menù (piatti)' }, { id: 'invoice', label: '🧾 Listino/Fattura (ingredienti)' }].map(opt => (
                  <button key={opt.id} onClick={() => setKind(opt.id)} style={{
                    flex: 1, padding: '10px', minHeight: 44, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: kind === opt.id ? '2px solid var(--gold)' : '1px solid var(--border-color)',
                    background: kind === opt.id ? 'var(--gold-light)' : 'var(--bg-secondary)',
                    color: kind === opt.id ? 'var(--gold-text)' : 'var(--text-muted)',
                  }}>{opt.label}</button>
                ))}
              </div>
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
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
                Accetta foto (JPG/PNG), PDF, Excel o CSV. Su telefono puoi scattare la foto al momento.
              </p>
            </>
          )}

          {step === 'loading' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Sto leggendo il documento…</p>
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
                      {kind === 'menu'
                        ? <th style={{ padding: '6px 4px' }}>Categoria</th>
                        : <th style={{ padding: '6px 4px' }}>Unità</th>}
                      <th style={{ padding: '6px 4px', width: 80 }}>Prezzo €</th>
                      <th style={{ width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '4px' }}>
                          <input className="form-input" value={r.name} onChange={e => updateRow(i, 'name', e.target.value)} style={{ padding: '6px 8px', fontSize: 13 }} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input className="form-input" value={kind === 'menu' ? r.category : r.unit} onChange={e => updateRow(i, kind === 'menu' ? 'category' : 'unit', e.target.value)} style={{ padding: '6px 8px', fontSize: 13 }} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input className="form-input" type="number" step="0.01" value={r.price} onChange={e => updateRow(i, 'price', e.target.value)} style={{ padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button className="btn-icon" onClick={() => removeRow(i)} style={{ color: 'var(--status-risk)' }}>🗑️</button>
                        </td>
                      </tr>
                    ))}
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
            <button className="btn-secondary" onClick={onClose}>Annulla</button>
            <button className="btn-primary" onClick={handleConfirm} disabled={rows.length === 0}>
              Conferma e importa {rows.length}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportScanner;
