// src/components/foodcost/FoodCostPage.jsx
import { useState, useMemo, useCallback, useEffect } from 'react';
import { TopBar }     from '../layout/TopBar';
import { UnitSelect } from '../ui/UnitSelect';
import { AllergenBadges } from '../ui/AllergenBadges';
import { ALLERGENS, detectAllergens } from '../../lib/allergens';
import {
  calcIngredientCost,
  calcPreparationCost,
  getUnitCategory,
  convertPrice,
  calcTotalFixedCosts,
  calcFixedCostRatio,
} from '../../lib/calcEngine';
import { saveToDB, deleteFromDB } from '../../lib/dataService';
import { MAX_INGREDIENT_PRICE } from '../../lib/config';

const uid = () => Math.random().toString(36).slice(2, 10);

const FIXED_TYPES = ['Affitto', 'Utenze', 'Personale', 'Software', 'Manutenzione', 'Altro'];

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
// MODAL PREPARAZIONE — fix Task 3
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

  // AGGIORNA — non aggiunge (fix bug Task 3)
  const updateLine = (i, field, val) =>
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      if (field === 'qty') {
        const q = parseFloat(val);
        return { ...l, qty: isNaN(q) ? '' : String(q < 0 ? 0 : q) };
      }
      return { ...l, [field]: val };
    }));

  const totalCost = useMemo(() => {
    return lines.reduce((sum, l) => {
      const ing = allIngredients.find(p => p.id === l.pantryId);
      if (!ing || !l.qty) return sum;
      return sum + calcIngredientCost(ing, parseFloat(l.qty) || 0, l.unit);
    }, 0);
  }, [lines, allIngredients]);

  const resa        = parseFloat(resaQty) || 0;
  const costPerUnit = resa > 0 ? totalCost / resa : 0;

  const handleSave = async () => {
    if (!name.trim()) { setError('Il nome è obbligatorio.'); return; }

    const parsedYield = parseFloat(resaQty);
    if (!parsedYield || parsedYield <= 0 || isNaN(parsedYield)) {
      setError(
        'Inserisci la resa totale della preparazione. ' +
        'Es: se questa ricetta produce 800g di salsa, inserisci "800" e seleziona "g".'
      );
      return;
    }

    const cleanLines = lines.filter(l => l.pantryId && parseFloat(l.qty) > 0);

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
        quantity:      parseFloat(l.qty) || 0,
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
              const lc  = sel && line.qty ? calcIngredientCost(sel, parseFloat(line.qty) || 0, line.unit) : 0;
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
                    type="number" min="0" step="0.001"
                    value={line.qty}
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
                type="number" min="0.001" step="0.001"
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
// FOOD COST PAGE
// ══════════════════════════════════════════
// Formato italiano per euro e percentuale (solo nel panel fissi)
const fmtEuro = n => '€ ' + (parseFloat(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct  = n => (parseFloat(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';

export function FoodCostPage({
  currentPage, onNavigate, onOpenSettings,
  ingredients,  setIngredients,
  preparations, setPreparations,
  fixedCosts,   setFixedCosts,
  estimatedRevenue       = 0,
  onEstimatedRevenueChange,
  restaurant,
  onOpenScanner,
  foodcostSection = 'dispensa',
  onFoodcostSection,
}) {
  // Segmento controllato dalla nav superiore (con fallback interno)
  const [sectionLocal, setSectionLocal] = useState('dispensa');
  const section = foodcostSection || sectionLocal;
  const setSection = onFoodcostSection || setSectionLocal;
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showIngModal,        setShowIngModal]        = useState(false);
  const [showPrepModal,       setShowPrepModal]       = useState(false);
  const [showFixModal,        setShowFixModal]        = useState(false);
  const [editItem,            setEditItem]            = useState(null);
  const [revenueInput,   setRevenueInput]   = useState('');

  // Sincronizza l'input testuale quando cambia il prop (caricamento da DB)
  useEffect(() => {
    setRevenueInput(estimatedRevenue > 0 ? String(estimatedRevenue) : '');
  }, [estimatedRevenue]);

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

  const handleSaveFixed = useCallback(saved => {
    setFixedCosts(prev => {
      const exists = prev.some(c => c.id === saved.id);
      return exists ? prev.map(c => c.id === saved.id ? saved : c) : [...prev, saved];
    });
  }, [setFixedCosts]);

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

  const handleDeleteFixed = useCallback(async (id, name) => {
    if (!window.confirm(`Eliminare "${name}"?`)) return;
    await deleteFromDB('fixed_costs', id);
    setFixedCosts(prev => prev.filter(c => c.id !== id));
  }, [setFixedCosts]);

  const openEditIngredient = item => { setEditItem(item); setShowIngModal(true); };
  const openEditPrep       = item => { setEditItem(item); setShowPrepModal(true); };
  const openEditFixed      = item => { setEditItem(item); setShowFixModal(true); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--bg-primary)' }}>

      {/* TOP BAR */}
      <TopBar currentPage={currentPage} foodcostSection={section} onNavigate={onNavigate} onOpenSettings={onOpenSettings} restaurant={restaurant} />

      {/* HEADER + SEGMENTED CONTROL */}
      <div style={{
        padding: '16px 20px 0',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <h1 style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: '22px', fontWeight: '700',
          margin: '0 0 14px', color: 'var(--text-primary)',
        }}>
          🧾 Food Cost
        </h1>
        <div style={{ display: 'flex' }}>
          {[
            { id: 'dispensa', label: '📦 Dispensa' },
            { id: 'fissi',    label: '💶 Costi Fissi' },
          ].map(seg => (
            <button
              key={seg.id}
              onClick={() => { setSection(seg.id); setSearchQuery(''); }}
              style={{
                flex: 1, padding: '10px', minHeight: '44px',
                background: 'none', border: 'none',
                borderBottom: section === seg.id ? '2px solid var(--gold)' : '2px solid transparent',
                color:     section === seg.id ? 'var(--gold)' : 'var(--text-muted)',
                fontWeight: section === seg.id ? '700' : '500',
                fontSize: '14px', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {seg.label}
            </button>
          ))}
        </div>
      </div>

      {/* BARRA RICERCA STICKY */}
      <div style={{
        position: 'sticky', top: '52px', zIndex: 50,
        padding: '10px 16px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
      }}>
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

        {/* ── SEZIONE DISPENSA ── */}
        {section === 'dispensa' && (
          <>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={() => { setEditItem(null); setShowIngModal(true); }}
                style={{
                  padding: '10px 16px', minHeight: '44px',
                  background: 'var(--gold)', color: '#fff',
                  border: 'none', borderRadius: '8px',
                  fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                }}
              >
                + Ingrediente
              </button>
              <button
                onClick={() => { setEditItem(null); setShowPrepModal(true); }}
                style={{
                  padding: '10px 16px', minHeight: '44px',
                  background: 'none', color: 'var(--gold)',
                  border: '1px solid var(--gold)', borderRadius: '8px',
                  fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                }}
              >
                + Preparazione
              </button>
              <button
                onClick={() => onOpenScanner?.('pantry')}
                style={{
                  padding: '10px 16px', minHeight: '44px',
                  background: 'none', color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)', borderRadius: '8px',
                  fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                }}
              >
                📷 Importa
              </button>
            </div>

            {/* INGREDIENTI A-Z */}
            {filteredIngredients.length > 0 && (
              <>
                <p style={{
                  fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700',
                  textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px',
                }}>
                  Ingredienti ({filteredIngredients.length})
                </p>
                {filteredIngredients.map(ing => (
                  <div key={ing.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 14px', background: 'var(--bg-card)',
                    borderRadius: '8px', marginBottom: '6px',
                    border: '1px solid var(--border-color)',
                  }}>
                    <span style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {ing.name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--gold)' }}>
                      €{parseFloat(ing.price_per_unit || ing.price || 0).toFixed(2)}/{ing.unit}
                    </span>
                    {ing.allergens?.length > 0 && (
                      <AllergenBadges allergenKeys={ing.allergens} size="sm" />
                    )}
                    <button
                      className="btn-icon"
                      onClick={() => openEditIngredient(ing)}
                      title="Modifica"
                    >✏️</button>
                    <button
                      className="btn-icon"
                      onClick={() => handleDeleteIngredient(ing.id, ing.name)}
                      style={{ color: 'var(--status-risk)' }}
                      title="Elimina"
                    >🗑️</button>
                  </div>
                ))}
              </>
            )}

            {/* PREPARAZIONI A-Z */}
            {filteredPreparations.length > 0 && (
              <>
                <p style={{
                  fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700',
                  textTransform: 'uppercase', letterSpacing: '0.8px', margin: '16px 0 8px',
                }}>
                  Preparazioni ({filteredPreparations.length})
                </p>
                {filteredPreparations.map(prep => (
                  <div key={prep.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 14px', background: 'var(--bg-card)',
                    borderRadius: '8px', marginBottom: '6px',
                    border: '1px solid rgba(230,157,67,0.3)',
                  }}>
                    <span style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {prep.name}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px',
                      background: 'var(--gold-badge)', color: 'var(--gold-text)',
                      fontSize: '11px', fontWeight: '700',
                    }}>PREP</span>
                    {prep.total_yield ? (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        resa: {prep.total_yield}{prep.yield_unit}
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--status-risk)' }}>⚠️ resa mancante</span>
                    )}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
                      €{parseFloat(prep.total_cost || 0).toFixed(2)}
                    </span>
                    <button className="btn-icon" onClick={() => openEditPrep(prep)} title="Modifica">✏️</button>
                    <button
                      className="btn-icon"
                      onClick={() => handleDeletePreparation(prep.id, prep.name)}
                      style={{ color: 'var(--status-risk)' }}
                      title="Elimina"
                    >🗑️</button>
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
          </>
        )}

        {/* ── SEZIONE COSTI FISSI ── */}
        {section === 'fissi' && (
          <>
            {/* Totale mensile */}
            <div style={{
              padding: '16px 20px', background: 'var(--bg-card)',
              borderRadius: '10px', border: '1px solid var(--gold)',
              marginBottom: '16px',
            }}>
              <p style={{
                fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 4px',
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                Totale Costi Fissi / Mese
              </p>
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: '700',
                color: 'var(--gold)', margin: 0,
              }}>
                €{totalFixed.toFixed(2)}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button
                onClick={() => { setEditItem(null); setShowFixModal(true); }}
                style={{
                  flex: 1, padding: '12px', minHeight: '44px',
                  background: 'var(--gold)', color: '#fff',
                  border: 'none', borderRadius: '8px',
                  fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                }}
              >
                + Aggiungi Costo Fisso
              </button>
              <button
                onClick={() => onOpenScanner?.('fixed_costs')}
                style={{
                  padding: '12px 16px', minHeight: '44px',
                  background: 'none', color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)', borderRadius: '8px',
                  fontWeight: '600', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                📷 Importa
              </button>
            </div>

            {filteredFixed.map(cost => (
              <div key={cost.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 14px', background: 'var(--bg-card)',
                borderRadius: '8px', marginBottom: '6px',
                border: '1px solid var(--border-color)',
              }}>
                <span style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                  {cost.name}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: '10px',
                  background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '11px',
                }}>
                  {cost.type}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  €{parseFloat(cost.amount_monthly || 0).toFixed(2)}/mese
                </span>
                <button className="btn-icon" onClick={() => openEditFixed(cost)} title="Modifica">✏️</button>
                <button
                  className="btn-icon"
                  onClick={() => handleDeleteFixed(cost.id, cost.name)}
                  style={{ color: 'var(--status-risk)' }}
                  title="Elimina"
                >🗑️</button>
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
                padding: '16px 18px',
                borderRadius: 'var(--radius-sm)',
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
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700,
                    color: ratio > 1 ? 'var(--status-risk)' : ratio > 0 ? 'var(--gold)' : 'var(--text-muted)',
                  }}>
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
          </>
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

export default FoodCostPage;
