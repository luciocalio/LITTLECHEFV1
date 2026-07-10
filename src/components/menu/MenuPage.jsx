// src/components/menu/MenuPage.jsx — V11
import { useState, useMemo, useCallback, useRef } from 'react';
import { TopBar }         from '../layout/TopBar';
import { UnitSelect }     from '../ui/UnitSelect';
import { StatusBadge }    from '../ui/StatusBadge';
import { AllergenBadges } from '../ui/AllergenBadges';
import {
  calcIngredientCost,
  calcPreparationInDish,
  calcDishFoodCost,
  calcMargin,
} from '../../lib/calcEngine';
import { calcDishAllergens } from '../../lib/allergens';
import { saveToDB, deleteFromDB } from '../../lib/db';
import { ProductCard }     from '../foodcost/ProductCard';
import { SectionHeader }   from '../foodcost/SectionHeader';
import { FilterBar, applyFiltersAndSort } from '../foodcost/FilterBar';
import { PriceSuggestion } from '../foodcost/PriceSuggestion';
import { DemoBanner }      from '../demo/DemoBanner';
import { DemoTour }        from '../demo/DemoTour';

const uid  = () => Math.random().toString(36).slice(2, 10);
const euro = n => '€' + (parseFloat(n) || 0).toFixed(2);
const fmt1 = n => (parseFloat(n) || 0).toFixed(1);

const FALLBACK_SECTIONS = [
  { id: 'Antipasto',   name: 'ANTIPASTO',   order: 0 },
  { id: 'Primo',       name: 'PRIMO',       order: 1 },
  { id: 'Secondo',     name: 'SECONDO',     order: 2 },
  { id: 'Dolce',       name: 'DOLCE',       order: 3 },
  { id: 'Bevande/Bar', name: 'BEVANDE/BAR', order: 4 },
  { id: 'Altro',       name: 'ALTRO',       order: 5 },
];

// ──────────────────────────────────────────
// MODALE DI CONFERMA GENERICA
// ──────────────────────────────────────────
function ConfirmModal({ title, message, subMessage, onConfirm, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300, padding: 16,
    }}>
      <div style={{
        background: 'var(--bg-modal)', borderRadius: 14, padding: 28,
        maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-lg)',
      }}>
        <h3 style={{
          fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700,
          color: 'var(--text-primary)', marginBottom: 16,
        }}>{title}</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: subMessage ? 8 : 24 }}>
          {message}
        </p>
        {subMessage && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            {subMessage}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', minHeight: 44, background: 'none',
            border: '1px solid var(--border-color)', borderRadius: 8,
            cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)',
          }}>Annulla</button>
          <button onClick={onConfirm} style={{
            padding: '10px 20px', minHeight: 44, background: 'var(--status-risk)',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            fontSize: 14, fontWeight: 700, color: '#fff',
          }}>Sì, elimina</button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// MODAL PIATTO
// ──────────────────────────────────────────
function PiattoModal({ dish, allIngredients, allPreparations, defaultCategory, sections, onSave, onClose }) {
  const [name,          setName]          = useState(dish?.name || '');
  const [category,      setCategory]      = useState(dish?.category || defaultCategory || (sections?.[0]?.name || 'PRIMO'));
  const [price,         setPrice]         = useState(dish?.price ?? dish?.selling_price ?? '');
  const [useManualCost, setUseManualCost] = useState(false);
  const [manualCost,    setManualCost]    = useState('');
  const [searchComp,    setSearchComp]    = useState('');
  const [internalNotes, setInternalNotes] = useState(dish?.internalNotes || '');
  const [isVisible,     setIsVisible]     = useState(dish?.isVisible !== false);
  const [error,         setError]         = useState(null);

  const sectionNames = (sections && sections.length > 0)
    ? [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(s => s.name)
    : FALLBACK_SECTIONS.map(s => s.name);

  const pantryAll = useMemo(() => [...(allIngredients || []), ...(allPreparations || [])], [allIngredients, allPreparations]);
  const pantryMap = useMemo(() => {
    const m = {};
    pantryAll.forEach(p => { m[p.id] = p; });
    return m;
  }, [pantryAll]);

  const [components, setComponents] = useState(() => {
    if (dish?.components?.length) {
      return dish.components.map(c => ({
        id:     c.id || uid(),
        type:   c.type || 'ingredient',
        id_ref: c.id_ref || c.id,
        name:   c.name || pantryMap[c.id_ref || c.id]?.name || '',
        qty:    c.qty ?? c.quantity ?? 1,
        unit:   c.unit || 'g',
      }));
    }
    return [];
  });

  const allOptions = useMemo(() => [
    ...(allIngredients || []).map(p => ({ ...p, type: 'ingredient', label: p.name })),
    ...(allPreparations || []).map(p => ({ ...p, type: 'preparation', label: `★ ${p.name}` })),
  ].filter(opt => !searchComp || opt.label.toLowerCase().includes(searchComp.toLowerCase())), [allIngredients, allPreparations, searchComp]);

  const computeCompCost = useCallback(comp => {
    if (!comp.id_ref || !(parseFloat(comp.qty) > 0)) return 0;
    const item = pantryMap[comp.id_ref];
    if (!item) return 0;
    if (item._isPrep) {
      try { return calcPreparationInDish(item, parseFloat(comp.qty) || 0, comp.unit || item.unit); }
      catch { return 0; }
    }
    return calcIngredientCost(item, parseFloat(comp.qty) || 0, comp.unit || item.unit);
  }, [pantryMap]);

  const autoCost = useMemo(() => {
    const compsForCalc = components
      .filter(c => c.id_ref)
      .map(c => ({ type: c.type, id: c.id_ref, quantity: parseFloat(c.qty) || 0, unit: c.unit }));
    return calcDishFoodCost(compsForCalc, allIngredients || [], allPreparations || []);
  }, [components, allIngredients, allPreparations]);

  const foodCost = useManualCost ? (parseFloat(manualCost) || 0) : autoCost;
  const priceNum = parseFloat(price) || 0;
  const { marginEuro, marginPct, status } = calcMargin(priceNum, foodCost);

  const allergens = useMemo(() => {
    const comps = components.filter(c => c.id_ref).map(c => ({ type: c.type, id: c.id_ref }));
    return calcDishAllergens(comps, allIngredients || [], allPreparations || []);
  }, [components, allIngredients, allPreparations]);

  const addComp = opt => {
    setComponents(prev => [...prev, {
      id: uid(), type: opt.type, id_ref: opt.id,
      name: opt.name, qty: 1, unit: opt.unit || 'g',
    }]);
    setSearchComp('');
  };

  const updateComp = (i, field, val) => {
    setComponents(prev => prev.map((c, idx) => {
      if (idx !== i) return c;
      if (field === 'qty') return { ...c, qty: parseFloat(val) || 0 };
      return { ...c, [field]: val };
    }));
  };

  const removeComp = i => setComponents(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!name.trim())  { setError('Il nome è obbligatorio.'); return; }
    if (priceNum <= 0) { setError('Il prezzo di vendita deve essere > 0.'); return; }

    const cleanComps = components.filter(c => c.id_ref && parseFloat(c.qty) > 0);
    const calculatedFoodCost = useManualCost
      ? (parseFloat(manualCost) || 0)
      : calcDishFoodCost(
          cleanComps.map(c => ({ type: c.type, id: c.id_ref, quantity: parseFloat(c.qty) || 0, unit: c.unit })),
          allIngredients || [], allPreparations || []
        );

    const { marginEuro: me, marginPct: mp, status: st } = calcMargin(priceNum, calculatedFoodCost);

    const dishData = {
      id:             dish?.id || `dish_${uid()}`,
      name:           name.trim(),
      category,
      price:          priceNum,
      selling_price:  priceNum,
      food_cost:      calculatedFoodCost,
      margin_euro:    me,
      margin_pct:     mp,
      status:         st,
      allergens,
      internalNotes:       internalNotes.trim(),
      isVisible,
      ingredientUpdatedAt: new Date().toISOString(),
      components:     cleanComps.map(c => ({
        id: c.id, type: c.type, id_ref: c.id_ref,
        name: c.name, qty: parseFloat(c.qty) || 0,
        quantity: parseFloat(c.qty) || 0, unit: c.unit,
      })),
      updated_at: new Date().toISOString(),
    };

    await saveToDB('dishes', dishData);
    onSave(dishData);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <span className="modal-title">{dish ? 'Modifica Prodotto' : 'Aggiungi Prodotto'}</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && (
            <div style={{
              background: 'var(--status-risk-bg)', borderLeft: '3px solid var(--status-risk)',
              borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--status-risk)',
            }}>{error}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Nome del piatto</label>
              <input
                className="form-input" value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Es: Risotto al tartufo..."
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sezione</label>
              <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                {sectionNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Prezzo di vendita (€)</label>
              <input
                className="form-input" type="number" min="0" step="0.5"
                value={price} onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* SUGGERIMENTO PREZZO */}
          {foodCost > 0 && <PriceSuggestion totalCost={foodCost} />}

          {/* RICERCA COMPONENTI */}
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>Ingredienti e Preparazioni</div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input
                className="form-input"
                value={searchComp}
                onChange={e => setSearchComp(e.target.value)}
                placeholder="Cerca dalla Dispensa per aggiungere..."
              />
              {searchComp && allOptions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: 'var(--bg-modal)', border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)',
                  zIndex: 10, maxHeight: 200, overflowY: 'auto',
                }}>
                  {allOptions.slice(0, 8).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => addComp(opt)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 14px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 13, color: 'var(--text-primary)',
                        borderBottom: '1px solid var(--border-color)', minHeight: 'auto',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--gold-light)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {opt.label}
                      <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                        {opt.type === 'preparation' ? 'Preparazione' : opt.unit}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {components.filter(c => c.id_ref).map((comp, i) => {
              const actualIdx = components.findIndex(c => c.id === comp.id);
              const item = pantryMap[comp.id_ref];
              const lc   = computeCompCost(comp);
              return (
                <div key={comp.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 80px 130px auto auto',
                  gap: 8, marginBottom: 6, alignItems: 'center',
                  padding: '8px 10px', background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {comp.name}{item?._isPrep ? ' ★' : ''}
                  </span>
                  <input
                    type="number" min="0" step="0.1" className="form-input"
                    value={comp.qty || ''}
                    onChange={e => updateComp(actualIdx, 'qty', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', textAlign: 'right' }}
                  />
                  <UnitSelect
                    value={comp.unit || item?.unit || 'g'}
                    onChange={val => updateComp(actualIdx, 'unit', val)}
                    filterUnit={item?.unit}
                    style={{ width: '130px' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: 56, textAlign: 'right' }}>
                    {lc > 0 ? `€${lc.toFixed(2)}` : '—'}
                  </span>
                  <button className="btn-icon" onClick={() => removeComp(actualIdx)} style={{ color: 'var(--status-risk)' }}>✕</button>
                </div>
              );
            })}
          </div>

          {/* FOOD COST MANUALE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useManualCost}
                onChange={e => setUseManualCost(e.target.checked)}
                style={{ accentColor: 'var(--gold)', width: 16, height: 16 }}
              />
              Imposta food cost manuale
            </label>
            {useManualCost && (
              <input
                type="number" min="0" step="0.01" className="form-input"
                value={manualCost}
                onChange={e => setManualCost(e.target.value)}
                placeholder="Food cost €"
                style={{ width: 120 }}
              />
            )}
          </div>

          {/* PREVIEW REAL-TIME */}
          {(foodCost > 0 || priceNum > 0) && (
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
              padding: '14px 16px', display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
              border: '1px solid var(--border-color)',
            }}>
              {[
                ['Prezzo',    euro(priceNum)],
                ['Food Cost', euro(foodCost)],
                ['Guadagno',  `${euro(marginEuro)} (${fmt1(marginPct)}%)`],
              ].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 3 }}>{l}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{v}</div>
                </div>
              ))}
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 3 }}>Status</div>
                <StatusBadge status={status} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Allergeni</div>
                <AllergenBadges allergenKeys={allergens} size="sm" />
              </div>
            </div>
          )}

          {/* VISIBILITÀ + NOTE INTERNE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0 0' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>👁️ Visibile nel menù cliente</span>
            <button
              onClick={() => setIsVisible(v => !v)}
              style={{
                padding: '4px 14px', minHeight: 32, borderRadius: 20,
                background: isVisible ? 'var(--gold)' : 'var(--bg-secondary)',
                border: `1px solid ${isVisible ? 'var(--gold)' : 'var(--border-color)'}`,
                color: isVisible ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
              {isVisible ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">📝 Note interne (solo per te)</label>
            <input
              className="form-input"
              value={internalNotes}
              onChange={e => setInternalNotes(e.target.value)}
              placeholder="Es: Stagionale, rivalutare prezzo a settembre..."
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Annulla</button>
          <button className="btn-primary" onClick={handleSave}>
            {dish ? 'Salva Modifiche' : 'Salva Prodotto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// MENU PAGE
// ══════════════════════════════════════════
export function MenuPage({
  currentPage, onNavigate, onOpenSettings,
  dishes, setDishes,
  ingredients, preparations,
  sections, setSections,
  isDemoMode, handleResetDemo,
}) {
  const [showAddModal,       setShowAddModal]       = useState(false);
  const [editingDish,        setEditingDish]        = useState(null);
  const [addToCategory,      setAddToCategory]      = useState('');
  const [activeFilters,      setActiveFilters]      = useState([]);
  const [sortKey,            setSortKey]            = useState('profit_desc');
  const [showNewSection,     setShowNewSection]     = useState(false);
  const [newSectionName,     setNewSectionName]     = useState('');
  const [deleteSectionModal, setDeleteSectionModal] = useState(null); // { section, dishCount }
  const [deleteDishModal,    setDeleteDishModal]    = useState(null); // { id, name }
  const newSectionInputRef = useRef(null);

  // ── Sections ordinati per display ────────────────────────────────
  const activeSections = useMemo(() => {
    const list = (sections && sections.length > 0) ? sections : FALLBACK_SECTIONS;
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [sections]);

  // ── ID del primo piatto rosso (per joyride demo) ─────────────────
  const firstRedId = useMemo(() => {
    if (!isDemoMode) return null;
    for (const section of activeSections) {
      const sectionDishes = (dishes || []).filter(d =>
        (d.category || '').toUpperCase() === section.name.toUpperCase()
      );
      const red = sectionDishes.find(d => {
        const sp = parseFloat(d.selling_price || d.price || 0);
        const tc = parseFloat(d.totalCost || d.food_cost || 0);
        return sp > 0 ? ((sp - tc) / sp) * 100 < 20 : false;
      });
      if (red) return red.id;
    }
    return null;
  }, [isDemoMode, dishes, activeSections]);

  // ── DISH HANDLERS ────────────────────────────────────────────────
  const handleSaveDish = useCallback(saved => {
    setDishes(prev => {
      const exists = prev.some(d => d.id === saved.id);
      return exists ? prev.map(d => d.id === saved.id ? saved : d) : [...prev, saved];
    });
  }, [setDishes]);

  const requestDeleteDish = useCallback((id, name) => {
    setDeleteDishModal({ id, name });
  }, []);

  const confirmDeleteDish = useCallback(async () => {
    if (!deleteDishModal) return;
    await deleteFromDB('dishes', deleteDishModal.id);
    setDishes(prev => prev.filter(d => d.id !== deleteDishModal.id));
    setDeleteDishModal(null);
  }, [deleteDishModal, setDishes]);

  const handleDuplicateDish = useCallback(async dish => {
    const newDish = {
      ...dish,
      id:         `dish_${uid()}`,
      name:       `Copia di ${dish.name}`,
      updated_at: new Date().toISOString(),
    };
    await saveToDB('dishes', newDish);
    setDishes(prev => [...prev, newDish]);
    // Apri il modale di modifica sul duplicato
    setEditingDish(newDish);
    setShowAddModal(true);
  }, [setDishes]);

  const handleToggleVisible = useCallback(async dish => {
    const updated = { ...dish, isVisible: dish.isVisible !== false ? false : true, updated_at: new Date().toISOString() };
    await saveToDB('dishes', updated);
    setDishes(prev => prev.map(d => d.id === updated.id ? updated : d));
  }, [setDishes]);

  // ── SECTION HANDLERS ─────────────────────────────────────────────
  const handleAddSection = useCallback(async () => {
    const name = newSectionName.trim().toUpperCase();
    if (!name) { setShowNewSection(false); setNewSectionName(''); return; }
    const maxOrder = activeSections.reduce((m, s) => Math.max(m, s.order ?? 0), 0);
    const newSection = { id: `sec_${uid()}`, name, order: maxOrder + 1 };
    await saveToDB('sections', newSection);
    setSections(prev => [...(prev || []), newSection]);
    setNewSectionName('');
    setShowNewSection(false);
  }, [newSectionName, activeSections, setSections]);

  const handleRenameSection = useCallback(async (sectionId, newName) => {
    const section = (sections || []).find(s => s.id === sectionId);
    if (!section) return;
    const oldName = section.name;
    const updated = { ...section, name: newName };
    await saveToDB('sections', updated);
    setSections(prev => (prev || []).map(s => s.id === sectionId ? updated : s));
    const toUpdate = (dishes || []).filter(d => (d.category || '').toUpperCase() === oldName.toUpperCase());
    await Promise.all(toUpdate.map(d => saveToDB('dishes', { ...d, category: newName })));
    if (toUpdate.length > 0) setDishes(prev => prev.map(d =>
      (d.category || '').toUpperCase() === oldName.toUpperCase() ? { ...d, category: newName } : d
    ));
  }, [sections, dishes, setSections, setDishes]);

  const requestDeleteSection = useCallback(section => {
    const dishCount = (dishes || []).filter(d =>
      (d.category || '').toUpperCase() === section.name.toUpperCase()
    ).length;
    setDeleteSectionModal({ section, dishCount });
  }, [dishes]);

  const confirmDeleteSection = useCallback(async () => {
    if (!deleteSectionModal) return;
    const { section } = deleteSectionModal;
    const inSection = (dishes || []).filter(d =>
      (d.category || '').toUpperCase() === section.name.toUpperCase()
    );
    if (inSection.length > 0) {
      const uncatName = 'NON CATEGORIZZATO';
      let uncatSection = (sections || []).find(s => s.name === uncatName);
      if (!uncatSection) {
        const maxOrder = activeSections.reduce((m, s) => Math.max(m, s.order ?? 0), 0);
        uncatSection = { id: `sec_${uid()}`, name: uncatName, order: maxOrder + 1 };
        await saveToDB('sections', uncatSection);
        setSections(prev => [...(prev || []), uncatSection]);
      }
      await Promise.all(inSection.map(d => saveToDB('dishes', { ...d, category: uncatName })));
      setDishes(prev => prev.map(d =>
        (d.category || '').toUpperCase() === section.name.toUpperCase() ? { ...d, category: uncatName } : d
      ));
    }
    await deleteFromDB('sections', section.id);
    setSections(prev => (prev || []).filter(s => s.id !== section.id));
    setDeleteSectionModal(null);
  }, [deleteSectionModal, dishes, sections, activeSections, setSections, setDishes]);

  const handleMoveSection = useCallback(async (sectionId, direction) => {
    const sorted = [...activeSections];
    const idx    = sorted.findIndex(s => s.id === sectionId);
    const newIdx = idx + direction;
    if (idx < 0 || newIdx < 0 || newIdx >= sorted.length) return;
    [sorted[idx], sorted[newIdx]] = [sorted[newIdx], sorted[idx]];
    const withOrder = sorted.map((s, i) => ({ ...s, order: i }));
    await Promise.all(withOrder.map(s => saveToDB('sections', s)));
    setSections(withOrder);
  }, [activeSections, setSections]);

  const openAdd = sectionName => {
    setAddToCategory(sectionName || activeSections[0]?.name || '');
    setEditingDish(null);
    setShowAddModal(true);
  };

  const openEdit = dish => {
    setEditingDish(dish);
    setShowAddModal(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--bg-primary)' }}>

      {/* TOP BAR */}
      <TopBar currentPage={currentPage} onNavigate={onNavigate} onOpenSettings={onOpenSettings} />

      {/* DEMO BANNER */}
      {isDemoMode && <DemoBanner onReset={handleResetDemo} />}

      {/* HEADER */}
      <div style={{ padding: '16px 20px 12px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
          📋 Prodotti
        </h1>
      </div>

      {/* FILTER BAR */}
      <FilterBar
        activeFilters={activeFilters}
        setActiveFilters={setActiveFilters}
        sortKey={sortKey}
        setSortKey={setSortKey}
      />

      {/* BOTTONE + AGGIUNGI SEZIONE (in cima, sotto FilterBar) */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
        {showNewSection ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={newSectionInputRef}
              autoFocus
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value.toUpperCase())}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddSection();
                if (e.key === 'Escape') { setShowNewSection(false); setNewSectionName(''); }
              }}
              placeholder="Nome sezione (es. COCKTAIL, PIZZA, BRUNCH...)"
              style={{
                flex: 1, padding: '9px 14px', minHeight: 44,
                border: '2px solid var(--gold)', borderRadius: 8,
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                fontSize: 14, outline: 'none', fontWeight: 700, letterSpacing: 1,
              }}
            />
            <button onClick={handleAddSection} style={{
              padding: '9px 16px', minHeight: 44, minWidth: 44,
              background: 'var(--gold)', border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 18, cursor: 'pointer',
            }}>✓</button>
            <button onClick={() => { setShowNewSection(false); setNewSectionName(''); }} style={{
              padding: '9px 16px', minHeight: 44, minWidth: 44,
              background: 'none', border: '1px solid var(--border-color)', borderRadius: 8,
              color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer',
            }}>✕</button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewSection(true)}
            style={{
              width: '100%', padding: '9px', minHeight: 44,
              background: 'none', border: '2px dashed var(--border-color)',
              borderRadius: 8, color: 'var(--text-muted)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>
            + Aggiungi Sezione
          </button>
        )}
      </div>

      {/* LISTA SEZIONI */}
      <div id="product-list-demo" style={{ flex: 1, padding: '12px 16px 32px', overflowY: 'auto' }}>
        {activeSections.map((section, idx) => {
          const rawDishes = (dishes || []).filter(d =>
            (d.category || '').toUpperCase() === section.name.toUpperCase()
          );
          const enrichedDishes = rawDishes.map(dish => {
            const hasUpdatedIngredients = (dish.components || []).some(comp => {
              const ing = (ingredients || []).find(i => i.id === (comp.id_ref || comp.id));
              if (!ing?.updated_at || !dish.ingredientUpdatedAt) return false;
              return new Date(ing.updated_at) > new Date(dish.ingredientUpdatedAt);
            });
            return hasUpdatedIngredients ? { ...dish, hasUpdatedIngredients: true } : dish;
          });
          const sortedDishes = applyFiltersAndSort(enrichedDishes, activeFilters, sortKey);
          return (
            <div key={section.id} style={{ marginBottom: 24 }}>
              <SectionHeader
                section={section}
                dishes={rawDishes}
                onRename={handleRenameSection}
                onDelete={requestDeleteSection}
                onMoveUp={() => handleMoveSection(section.id, -1)}
                onMoveDown={() => handleMoveSection(section.id, 1)}
                isFirst={idx === 0}
                isLast={idx === activeSections.length - 1}
              />
              {sortedDishes.length === 0 ? (
                <div style={{
                  padding: '16px', background: 'var(--bg-card)',
                  borderRadius: '8px', border: '1px dashed var(--border-color)',
                  textAlign: 'center', marginBottom: 6,
                }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                    {activeFilters.length > 0
                      ? 'Nessun prodotto corrisponde ai filtri.'
                      : 'Nessun prodotto in questa sezione.'}
                  </p>
                </div>
              ) : (
                sortedDishes.map(dish => (
                  <ProductCard
                    key={dish.id}
                    dish={dish}
                    onEdit={() => openEdit(dish)}
                    onDuplicate={() => handleDuplicateDish(dish)}
                    onToggleVisible={() => handleToggleVisible(dish)}
                    onDelete={() => requestDeleteDish(dish.id, dish.name)}
                    isFirstRedDemo={isDemoMode && dish.id === firstRedId}
                  />
                ))
              )}
              <button
                onClick={() => openAdd(section.name)}
                style={{
                  display: 'block', width: '100%', padding: '8px', minHeight: '36px',
                  background: 'none', border: '1px dashed var(--border-color)',
                  borderRadius: '8px', color: 'var(--text-muted)',
                  fontSize: '12px', fontWeight: '600', cursor: 'pointer', marginTop: 4,
                }}>
                + Aggiungi prodotto in {section.name}
              </button>
            </div>
          );
        })}
      </div>

      {/* MODAL PIATTO */}
      {showAddModal && (
        <PiattoModal
          dish={editingDish}
          allIngredients={ingredients || []}
          allPreparations={preparations || []}
          defaultCategory={addToCategory}
          sections={activeSections}
          onSave={handleSaveDish}
          onClose={() => { setShowAddModal(false); setEditingDish(null); }}
        />
      )}

      {/* CONFERMA ELIMINA SEZIONE */}
      {deleteSectionModal && (
        <ConfirmModal
          title="Elimina sezione"
          message={`Sei sicuro di voler eliminare "${deleteSectionModal.section.name}"?`}
          subMessage={
            deleteSectionModal.dishCount > 0
              ? `I ${deleteSectionModal.dishCount} prodotti al suo interno verranno spostati in "Non categorizzato".`
              : null
          }
          onConfirm={confirmDeleteSection}
          onClose={() => setDeleteSectionModal(null)}
        />
      )}

      {/* CONFERMA ELIMINA PRODOTTO */}
      {deleteDishModal && (
        <ConfirmModal
          title="Elimina prodotto"
          message={`Sei sicuro di voler eliminare "${deleteDishModal.name}"?`}
          onConfirm={confirmDeleteDish}
          onClose={() => setDeleteDishModal(null)}
        />
      )}

      {/* DEMO TOUR */}
      {isDemoMode && <DemoTour hasData={(dishes || []).length > 0} />}
    </div>
  );
}

export default MenuPage;
