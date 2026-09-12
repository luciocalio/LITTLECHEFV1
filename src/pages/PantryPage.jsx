// src/pages/PantryPage.jsx
// Pagina dedicata SOLO alla Dispensa (ingredienti + preparazioni).
// Indipendente da FixedCostsPage: stato locale proprio, nessun segmento.
import { useState, useMemo, useCallback } from 'react';
import { TopBar }     from '../components/layout/TopBar';
import { UnitSelect } from '../components/ui/UnitSelect';
import { AllergenBadges } from '../components/ui/AllergenBadges';
import { ALLERGENS, detectAllergens } from '../lib/allergens';
import {
  calcIngredientCost,
  getUnitCategory,
  convertPrice,
} from '../lib/calcEngine';
import { saveToDB, deleteFromDB } from '../lib/dataService';
import { MAX_INGREDIENT_PRICE } from '../lib/config';
import { toNum } from '../lib/num';

const uid = () => Math.random().toString(36).slice(2, 10);

// ──────────────────────────────────────────
// MODAL INGREDIENTE
// ──────────────────────────────────────────
function IngredienteModal({ item, onSave, onClose }) {
  const [name,      setName]      = useState(item?.name || '');
  const [unit,      setUnit]      = useState(item?.unit || 'kg');
  const [price,     setPrice]     = useState(item?.price_per_unit ?? item?.price ?? '');
  const [waste,     setWaste]     = useState(item?.waste ?? 0);
  const [allergens, setAllergens] = useState(item?.allergens || []);
  const [error,     setError]     = useState(null);

  const autoAllergens = useMemo(() => detectAllergens(name), [name]);

  const toggleAllergen = key => {
    setAllergens(prev => prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key]);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Il nome è obbligatorio.'); return; }
    const priceVal = parseFloat(price);
    if (isNaN(priceVal) || priceVal < 0) { setError('Prezzo non valido.'); return; }
    if (priceVal > MAX_INGREDIENT_PRICE) { setError(`Prezzo troppo alto: massimo ${MAX_INGREDIENT_PRICE} € per unità.`); return; }

    let finalPrice = priceVal;
    if (item && item.unit && item.unit !== unit) {
      const oldCat = getUnitCategory(item.unit);
      const newCat = getUnitCategory(unit);
      if (oldCat && newCat && oldCat !== newCat) {
        setError(`Non puoi cambiare unità da ${item.unit} (${oldCat}) a ${unit} (${newCat}).`);
        return;
      }
      if (oldCat === newCat && oldCat) {
        finalPrice = convertPrice(priceVal, item.unit, unit);
      }
    }

    const finalAllergens = [...new Set([...autoAllergens, ...allergens])];
    const saved = {
      id:             item?.id || `ing_${uid()}`,
      name:           name.trim(),
      unit,
      price:          finalPrice,
      price_per_unit: finalPrice,
      waste:          parseFloat(waste) || 0,
      allergens:      finalAllergens,
      _isPrep:        false,
      updated_at:     new Date().toISOString(),
    };
    await saveToDB('ingredients', saved);
    onSave(saved);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <span className="modal-title">{item ? 'Modifica Ingrediente' : 'Aggiungi Ingrediente'}</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && (
            <div style={{
              background: 'var(--status-risk-bg)', borderLeft: '3px solid var(--status-risk)',
              borderRadius: 'var(--radius-sm)', padding: '10px 12px',
              fontSize: 13, color: 'var(--status-risk)',
            }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Nome ingrediente</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Es: Farina 00, Pomodori San Marzano..."
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Unità di misura</label>
              <UnitSelect value={unit} onChange={setUnit} style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Prezzo per {unit} (€)</label>
              <input
                className="form-input"
                type="number" min="0" step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Scarto % (perdita di lavorazione)</label>
            <input
              className="form-input"
              type="number" min="0" max="99" step="1"
              value={waste}
              onChange={e => setWaste(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Allergeni</label>
            {autoAllergens.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--gold-text)', marginBottom: 8 }}>
                ✨ Rilevati automaticamente: {autoAllergens.map(k => ALLERGENS[k]?.emoji).join(' ')}
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(ALLERGENS).map(([key, val]) => {
                const isAuto    = autoAllergens.includes(key);
                const isChecked = allergens.includes(key) || isAuto;
                return (
                  <button
                    key={key}
                    onClick={() => !isAuto && toggleAllergen(key)}
                    title={val.name}
                    style={{
                      padding: '4px 10px', border: '1px solid', borderRadius: 100,
                      fontSize: 12, cursor: isAuto ? 'default' : 'pointer',
                      background:  isChecked ? 'var(--gold-light)'  : 'var(--bg-secondary)',
                      borderColor: isChecked ? 'var(--gold)'        : 'var(--border-color)',
                      color:       isChecked ? 'var(--gold-text)'   : 'var(--text-muted)',
                      fontWeight:  isAuto ? 700 : 400,
                      minHeight:   '32px',
                    }}
                  >
                    {val.emoji} {isAuto ? '✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Annulla</button>
          <button className="btn-primary" onClick={handleSave}>
            {item ? 'Salva Modifiche' : 'Salva Ingrediente'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// MODAL PREPARAZIONE
// ──────────────────────────────────────────
function PreparazioneModal({ item, allIngredients, onSave, onClose }) {
  const isEdit = Boolean(item);

  const [name,      setName]      = useState(item?.name || '');
  const [resaQty,   setResaQty]   = useState(item?.total_yield?.toString() || '');
  const [resaUnit,  setResaUnit]  = useState(item?.yield_unit || item?.unit || 'g');
  const [lines, setLines] = useState(() => {
    if (item?.components?.length) {
      return item.components.map(c => ({
        id:       uid(),
        pantryId: c.ingredient_id || c.pantryId || c.id || '',
        qty:      String(c.quantity ?? c.qty ?? ''),
        unit:     c.unit || 'g',
      }));
    }
    return [{ id: uid(), pantryId: '', qty: '', unit: 'g' }];
  });
  const [error, setError] = useState(null);

  const addLine    = () => setLines(prev => [...prev, { id: uid(), pantryId: '', qty: '', unit: 'g' }]);
  const removeLine = i  => setLines(prev => prev.filter((_, idx) => idx !== i));

  // Quantità come stringa grezza (permette "0.03", "0,03", "0." intermedio):
  // il parse robusto avviene solo al calcolo/salvataggio.
  const updateLine = (i, field, val) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const totalCost = useMemo(() => {
    return lines.reduce((sum, l) => {
      const ing = allIngredients.find(p => p.id === l.pantryId);
      if (!ing || !toNum(l.qty)) return sum;
      return sum + calcIngredientCost(ing, toNum(l.qty), l.unit);
    }, 0);
  }, [lines, allIngredients]);

  const resa        = toNum(resaQty);
  const costPerUnit = resa > 0 ? totalCost / resa : 0;

  const handleSave = async () => {
    if (!name.trim()) { setError('Il nome è obbligatorio.'); return; }

    const parsedYield = toNum(resaQty);
    if (!parsedYield || parsedYield <= 0) {
      setError(
        'Inserisci la resa totale della preparazione. ' +
        'Es: se questa ricetta produce 800g di salsa, inserisci "800" e seleziona "g".'
      );
      return;
    }

    const cleanLines = lines.filter(l => l.pantryId && toNum(l.qty) > 0);

    const saved = {
      id:             item?.id || `prep_${uid()}`,
      name:           name.trim(),
      unit:           resaUnit,
      yield_unit:     resaUnit,
      price:          costPerUnit,
      price_per_unit: costPerUnit,
      waste:          0,
      allergens:      item?.allergens || [],
      _isPrep:        true,
      total_cost:     totalCost,
      total_yield:    parsedYield,
      components:     cleanLines.map(l => ({
        ingredient_id: l.pantryId,
        id:            l.pantryId,
        name:          allIngredients.find(p => p.id === l.pantryId)?.name || '',
        quantity:      toNum(l.qty),
        unit:          l.unit,
      })),
      updated_at: new Date().toISOString(),
    };
    await saveToDB('preparations', saved);
    onSave(saved);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Modifica Preparazione' : 'Aggiungi Preparazione'}</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && (
            <div style={{
              background: 'var(--status-risk-bg)', borderLeft: '3px solid var(--status-risk)',
              borderRadius: 'var(--radius-sm)', padding: '10px 12px',
              fontSize: 13, color: 'var(--status-risk)',
            }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Nome preparazione</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Es: Fondo bruno, Salsa pomodoro..."
              autoFocus
            />
          </div>

          {/* LISTA INGREDIENTI */}
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>Ingredienti usati</div>
            {lines.map((line, i) => {
              const sel = allIngredients.find(p => p.id === line.pantryId);
              const lc  = sel && toNum(line.qty) ? calcIngredientCost(sel, toNum(line.qty), line.unit) : 0;
              return (
                <div key={line.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 130px auto auto',
                  gap: 8, marginBottom: 8, alignItems: 'center',
                }}>
                  <select
                    className="form-select"
                    value={line.pantryId}
                    onChange={e => updateLine(i, 'pantryId', e.target.value)}
                    style={{ padding: '7px 10px' }}
                  >
                    <option value="">Seleziona ingrediente...</option>
                    {allIngredients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input
                    className="form-input"
                    type="text" inputMode="decimal"
                    value={line.qty ?? ''}
                    onChange={e => updateLine(i, 'qty', e.target.value)}
                    placeholder="Qtà"
                    style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', textAlign: 'right' }}
                  />
                  <UnitSelect
                    value={line.unit}
                    onChange={val => updateLine(i, 'unit', val)}
                    filterUnit={sel?.unit}
                  />
                  <span style={{
                    fontSize: 12, color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)', minWidth: 52, textAlign: 'right',
                  }}>
                    {lc > 0 ? `€${lc.toFixed(3)}` : '—'}
                  </span>
                  {lines.length > 1 && (
                    <button
                      className="btn-icon"
                      onClick={() => removeLine(i)}
                      style={{ color: 'var(--status-risk)' }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              );
            })}
            <button className="btn-secondary" onClick={addLine} style={{ fontSize: 12, padding: '6px 12px' }}>
              + Aggiungi riga
            </button>
          </div>

          {/* RESA TOTALE — obbligatoria */}
          <div style={{
            background: 'var(--gold-light)', border: '1px solid var(--gold-badge)',
            borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginTop: 8,
          }}>
            <p style={{
              fontSize: 11, fontWeight: 700, color: 'var(--gold-text)',
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6,
            }}>
              ⚖️ Resa totale (obbligatoria)
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Quanta preparazione produci con questi ingredienti?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
              <input
                className="form-input"
                type="text" inputMode="decimal"
                value={resaQty}
                onChange={e => setResaQty(e.target.value)}
                placeholder="Es: 800"
                style={{ border: !resaQty ? '2px solid var(--status-risk)' : undefined }}
              />
              <UnitSelect value={resaUnit} onChange={setResaUnit} style={{ width: 130 }} />
            </div>
            {resa > 0 && totalCost > 0 && (
              <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                → Costo per {resaUnit}:{' '}
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold-text)' }}>
                  €{costPerUnit.toFixed(4)}
                </strong>
              </p>
            )}
          </div>

          {/* TOTALE */}
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
            padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Costo totale ingredienti</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600 }}>
              €{totalCost.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Annulla</button>
          <button className="btn-primary" onClick={handleSave}>
            {isEdit ? 'Salva Modifiche' : 'Salva Preparazione'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// PANTRY PAGE (Dispensa)
// ══════════════════════════════════════════
export function PantryPage({
  currentPage, onNavigate, onOpenSettings,
  ingredients,  setIngredients,
  preparations, setPreparations,
  restaurant,
  onOpenScanner,
}) {
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showIngModal,  setShowIngModal]  = useState(false);
  const [showPrepModal, setShowPrepModal] = useState(false);
  const [editItem,      setEditItem]      = useState(null);

  const filteredIngredients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return [...(ingredients || [])]
      .filter(i => i.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [ingredients, searchQuery]);

  const filteredPreparations = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return [...(preparations || [])]
      .filter(p => p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [preparations, searchQuery]);

  const handleSaveIngredient = useCallback(saved => {
    setIngredients(prev => {
      const exists = prev.some(i => i.id === saved.id);
      return exists ? prev.map(i => i.id === saved.id ? saved : i) : [...prev, saved];
    });
  }, [setIngredients]);

  const handleSavePreparation = useCallback(saved => {
    setPreparations(prev => {
      const exists = prev.some(p => p.id === saved.id);
      return exists ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved];
    });
  }, [setPreparations]);

  const handleDeleteIngredient = useCallback(async (id, name) => {
    if (!window.confirm(`Eliminare "${name}"?`)) return;
    await deleteFromDB('ingredients', id);
    setIngredients(prev => prev.filter(i => i.id !== id));
  }, [setIngredients]);

  const handleDeletePreparation = useCallback(async (id, name) => {
    if (!window.confirm(`Eliminare "${name}"?`)) return;
    await deleteFromDB('preparations', id);
    setPreparations(prev => prev.filter(p => p.id !== id));
  }, [setPreparations]);

  const openEditIngredient = item => { setEditItem(item); setShowIngModal(true); };
  const openEditPrep       = item => { setEditItem(item); setShowPrepModal(true); };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', maxHeight: '100dvh', overflow: 'hidden', // pagina ferma: solo l'area lista scorre (Stage 10, Punto 3B)
      background: 'var(--bg-primary)',
    }}>

      {/* TOP BAR */}
      <TopBar currentPage={currentPage} onNavigate={onNavigate} onOpenSettings={onOpenSettings} restaurant={restaurant} />

      {/* HEADER */}
      <div style={{ padding: '16px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
          🧺 Dispensa
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

      {/* CONTENUTO — unica area che scorre (minHeight:0 necessario in flex-column) */}
      <div style={{ flex: 1, minHeight: 0, padding: '12px 16px 32px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setEditItem(null); setShowIngModal(true); }}
            style={{ padding: '10px 16px', minHeight: '44px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
          >
            + Ingrediente
          </button>
          <button
            onClick={() => { setEditItem(null); setShowPrepModal(true); }}
            style={{ padding: '10px 16px', minHeight: '44px', background: 'none', color: 'var(--gold)', border: '1px solid var(--gold)', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
          >
            + Preparazione
          </button>
          <button
            onClick={() => onOpenScanner?.('pantry')}
            style={{ padding: '10px 16px', minHeight: '44px', background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
          >
            📷 Importa
          </button>
        </div>

        {/* INGREDIENTI A-Z */}
        {filteredIngredients.length > 0 && (
          <>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' }}>
              Ingredienti ({filteredIngredients.length})
            </p>
            {filteredIngredients.map(ing => (
              <div key={ing.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'var(--bg-card)', borderRadius: '8px', marginBottom: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{ing.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--gold)' }}>
                  €{parseFloat(ing.price_per_unit || ing.price || 0).toFixed(2)}/{ing.unit}
                </span>
                {ing.allergens?.length > 0 && <AllergenBadges allergenKeys={ing.allergens} size="sm" />}
                <button className="btn-icon" onClick={() => openEditIngredient(ing)} title="Modifica">✏️</button>
                <button className="btn-icon" onClick={() => handleDeleteIngredient(ing.id, ing.name)} style={{ color: 'var(--status-risk)' }} title="Elimina">🗑️</button>
              </div>
            ))}
          </>
        )}

        {/* PREPARAZIONI A-Z */}
        {filteredPreparations.length > 0 && (
          <>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '16px 0 8px' }}>
              Preparazioni ({filteredPreparations.length})
            </p>
            {filteredPreparations.map(prep => (
              <div key={prep.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'var(--bg-card)', borderRadius: '8px', marginBottom: '6px', border: '1px solid rgba(230,157,67,0.3)' }}>
                <span style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{prep.name}</span>
                <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'var(--gold-badge)', color: 'var(--gold-text)', fontSize: '11px', fontWeight: '700' }}>PREP</span>
                {prep.total_yield ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>resa: {prep.total_yield}{prep.yield_unit}</span>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--status-risk)' }}>⚠️ resa mancante</span>
                )}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
                  €{parseFloat(prep.total_cost || 0).toFixed(2)}
                </span>
                <button className="btn-icon" onClick={() => openEditPrep(prep)} title="Modifica">✏️</button>
                <button className="btn-icon" onClick={() => handleDeletePreparation(prep.id, prep.name)} style={{ color: 'var(--status-risk)' }} title="Elimina">🗑️</button>
              </div>
            ))}
          </>
        )}

        {filteredIngredients.length === 0 && filteredPreparations.length === 0 && (
          <div className="empty-state" style={{ lineHeight: 1.6 }}>
            <div className="empty-state-icon">{searchQuery ? '🔍' : '🧺'}</div>
            {searchQuery
              ? `Nessun risultato per "${searchQuery}"`
              : <>La tua dispensa è vuota.<br />Aggiungi il primo ingrediente con <strong>+ Ingrediente</strong>,<br />oppure importa una fattura o un listino con <strong>📷 Importa</strong>.</>}
          </div>
        )}
      </div>

      {/* MODALI */}
      {showIngModal && (
        <IngredienteModal
          item={editItem}
          onSave={handleSaveIngredient}
          onClose={() => { setShowIngModal(false); setEditItem(null); }}
        />
      )}
      {showPrepModal && (
        <PreparazioneModal
          item={editItem}
          allIngredients={ingredients || []}
          onSave={handleSavePreparation}
          onClose={() => { setShowPrepModal(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}

export default PantryPage;
