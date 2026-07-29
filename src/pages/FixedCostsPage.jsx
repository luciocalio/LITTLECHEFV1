// src/pages/FixedCostsPage.jsx
// Pagina dedicata SOLO ai Costi Fissi (lista + totale + incidenza).
// Indipendente da PantryPage: stato locale proprio, nessun segmento.
import { useState, useMemo, useCallback, useEffect } from 'react';
import { TopBar } from '../components/layout/TopBar';
import { calcFixedCostRatio } from '../lib/calcEngine';
import { saveToDB, deleteFromDB } from '../lib/dataService';

const uid = () => Math.random().toString(36).slice(2, 10);
const FIXED_TYPES = ['Affitto', 'Utenze', 'Personale', 'Software', 'Manutenzione', 'Altro'];

const fmtEuro = n => '€ ' + (parseFloat(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct  = n => (parseFloat(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';

// ──────────────────────────────────────────
// MODAL COSTO FISSO
// ──────────────────────────────────────────
function FixedCostModal({ item, onSave, onClose }) {
  const [name,   setName]   = useState(item?.name || '');
  const [type,   setType]   = useState(item?.type || 'Altro');
  const [amount, setAmount] = useState(item?.amount_monthly ?? '');
  const [note,   setNote]   = useState(item?.note || '');
  const [error,  setError]  = useState(null);

  const handleSave = async () => {
    if (!name.trim())      { setError('Il nome è obbligatorio.'); return; }
    const amtVal = parseFloat(amount);
    if (isNaN(amtVal) || amtVal < 0) { setError('Importo non valido.'); return; }

    const saved = {
      id:             item?.id || `fc_${uid()}`,
      name:           name.trim(),
      type,
      amount_monthly: amtVal,
      note:           note.trim(),
      updated_at:     new Date().toISOString(),
    };
    await saveToDB('fixed_costs', saved);
    onSave(saved);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <span className="modal-title">{item ? 'Modifica Costo Fisso' : 'Aggiungi Costo Fisso'}</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && (
            <div style={{
              background: 'var(--status-risk-bg)', borderLeft: '3px solid var(--status-risk)',
              borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--status-risk)',
            }}>{error}</div>
          )}

          <div className="form-group">
            <label className="form-label">Nome</label>
            <input
              className="form-input" value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Es: Affitto, Luce, Personale..."
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                {FIXED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Importo mensile (€)</label>
              <input
                className="form-input" type="number" min="0" step="0.01"
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Note (opzionale)</label>
            <input
              className="form-input" value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Es: contratto in scadenza luglio..."
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Annulla</button>
          <button className="btn-primary" onClick={handleSave}>
            {item ? 'Salva Modifiche' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// FIXED COSTS PAGE (Costi Fissi)
// ══════════════════════════════════════════
export function FixedCostsPage({
  currentPage, onNavigate, onOpenSettings,
  fixedCosts, setFixedCosts,
  estimatedRevenue = 0,
  onEstimatedRevenueChange,
  restaurant,
  onOpenScanner,
}) {
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showFixModal, setShowFixModal] = useState(false);
  const [editItem,     setEditItem]     = useState(null);
  const [revenueInput, setRevenueInput] = useState('');

  // Sincronizza l'input testuale quando cambia il prop (caricamento da DB)
  useEffect(() => {
    setRevenueInput(estimatedRevenue > 0 ? String(estimatedRevenue) : '');
  }, [estimatedRevenue]);

  const filteredFixed = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return [...(fixedCosts || [])]
      .filter(c => c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [fixedCosts, searchQuery]);

  const totalFixed = useMemo(() =>
    (fixedCosts || []).reduce((s, c) => s + (parseFloat(c.amount_monthly) || 0), 0),
    [fixedCosts]
  );

  const ratio = useMemo(() =>
    calcFixedCostRatio(totalFixed, parseFloat(revenueInput) || estimatedRevenue),
    [totalFixed, revenueInput, estimatedRevenue]
  );

  const handleSaveFixed = useCallback(saved => {
    setFixedCosts(prev => {
      const exists = prev.some(c => c.id === saved.id);
      return exists ? prev.map(c => c.id === saved.id ? saved : c) : [...prev, saved];
    });
  }, [setFixedCosts]);

  const handleDeleteFixed = useCallback(async (id, name) => {
    if (!window.confirm(`Eliminare "${name}"?`)) return;
    await deleteFromDB('fixed_costs', id);
    setFixedCosts(prev => prev.filter(c => c.id !== id));
  }, [setFixedCosts]);

  const openEditFixed = item => { setEditItem(item); setShowFixModal(true); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--bg-primary)' }}>

      {/* TOP BAR */}
      <TopBar currentPage={currentPage} onNavigate={onNavigate} onOpenSettings={onOpenSettings} restaurant={restaurant} />

      {/* HEADER */}
      <div style={{ padding: '16px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
          💶 Costi Fissi
        </h1>
      </div>

      {/* BARRA RICERCA STICKY */}
      <div style={{ position: 'sticky', top: '52px', zIndex: 50, padding: '10px 16px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
        <input
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍  Cerca..."
          style={{
            width: '100%', padding: '10px 16px',
            border: '1px solid var(--border-color)', borderRadius: '10px',
            background: 'var(--bg-card)', color: 'var(--text-primary)',
            fontSize: '16px', minHeight: '44px', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* CONTENUTO */}
      <div style={{ flex: 1, padding: '12px 16px 32px', overflowY: 'auto' }}>

        {/* Totale mensile */}
        <div style={{ padding: '16px 20px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--gold)', marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Totale Costi Fissi / Mese
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: '700', color: 'var(--gold)', margin: 0 }}>
            €{totalFixed.toFixed(2)}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => { setEditItem(null); setShowFixModal(true); }}
            style={{ flex: 1, padding: '12px', minHeight: '44px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
          >
            + Aggiungi Costo Fisso
          </button>
          <button
            onClick={() => onOpenScanner?.('fixed_costs')}
            style={{ padding: '12px 16px', minHeight: '44px', background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            📷 Importa
          </button>
        </div>

        {filteredFixed.map(cost => (
          <div key={cost.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'var(--bg-card)', borderRadius: '8px', marginBottom: '6px', border: '1px solid var(--border-color)' }}>
            <span style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{cost.name}</span>
            <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '11px' }}>{cost.type}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
              €{parseFloat(cost.amount_monthly || 0).toFixed(2)}/mese
            </span>
            <button className="btn-icon" onClick={() => openEditFixed(cost)} title="Modifica">✏️</button>
            <button className="btn-icon" onClick={() => handleDeleteFixed(cost.id, cost.name)} style={{ color: 'var(--status-risk)' }} title="Elimina">🗑️</button>
          </div>
        ))}

        {filteredFixed.length === 0 && (
          <div className="empty-state" style={{ lineHeight: 1.6 }}>
            <div className="empty-state-icon">{searchQuery ? '🔍' : '💶'}</div>
            {searchQuery
              ? `Nessun risultato per "${searchQuery}"`
              : <>Nessun costo fisso ancora.<br />Aggiungine uno con <strong>+ Aggiungi Costo Fisso</strong>,<br />oppure importa una fattura con <strong>📷 Importa</strong>.</>}
          </div>
        )}

        {/* ─── PANEL TOTALE + RICAVI + INCIDENZA ─── */}
        <div style={{ marginTop: 24, borderTop: '1px solid var(--border-color)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* TOTALE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>
              Totale Costi Fissi
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: totalFixed > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
              {fmtEuro(totalFixed)}
            </span>
          </div>

          {/* RICAVI STIMATI */}
          <div>
            <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>
              📊 Ricavi Mensili Stimati
            </label>
            <input
              type="number" min="0" step="100"
              className="form-input"
              value={revenueInput}
              onChange={e => setRevenueInput(e.target.value)}
              onBlur={e => {
                const val = parseFloat(e.target.value) || 0;
                setRevenueInput(val > 0 ? String(val) : '');
                if (onEstimatedRevenueChange) onEstimatedRevenueChange(val);
              }}
              placeholder="Es: 15000"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Aggiorna in base al tuo registratore di cassa mensile
            </p>
          </div>

          {/* INCIDENZA % */}
          <div style={{
            padding: '16px 18px', borderRadius: 'var(--radius-sm)',
            background: ratio > 1 ? 'var(--status-risk-bg)' : 'var(--bg-secondary)',
            border: `1px solid ${ratio > 1 ? 'var(--status-risk)' : 'var(--border-color)'}`,
          }}>
            {ratio > 1 && (
              <p style={{ color: 'var(--status-risk)', fontWeight: 700, fontSize: 13, margin: '0 0 12px' }}>
                ⚠️ I costi fissi superano i ricavi stimati
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>
                Incidenza Costi Fissi
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: ratio > 1 ? 'var(--status-risk)' : ratio > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                {ratio > 0 ? fmtPct(ratio * 100) : '—'}
              </span>
            </div>
            {ratio > 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '10px 0 0', lineHeight: 1.5 }}>
                Ogni € incassato → <strong style={{ fontFamily: 'var(--font-mono)' }}>€ {ratio.toFixed(3)}</strong> vanno ai costi fissi
                <br />
                Applicato proporzionalmente su ogni prodotto del menù
              </p>
            )}
            {ratio === 0 && (totalFixed > 0 || (parseFloat(revenueInput) || 0) > 0) && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
                {totalFixed === 0
                  ? 'Aggiungi i costi fissi per attivare il calcolo.'
                  : 'Inserisci i ricavi stimati per attivare il calcolo.'}
              </p>
            )}
          </div>

          {/* Hint passivo — solo se tutto è vuoto */}
          {totalFixed === 0 && !(parseFloat(revenueInput) > 0) && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
              Aggiungi i tuoi costi fissi mensili e la stima dei ricavi<br />
              per attivare il calcolo completo su ogni prodotto.
            </p>
          )}
        </div>
      </div>

      {/* MODALE */}
      {showFixModal && (
        <FixedCostModal
          item={editItem}
          onSave={handleSaveFixed}
          onClose={() => { setShowFixModal(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}

export default FixedCostsPage;
