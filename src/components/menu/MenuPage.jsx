// src/components/menu/MenuPage.jsx — V11
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { TopBar }         from '../layout/TopBar';
import { UnitSelect }     from '../ui/UnitSelect';
import { StatusBadge }    from '../ui/StatusBadge';
import { AllergenBadges } from '../ui/AllergenBadges';
import {
  calcIngredientCost,
  calcPreparationInDish,
  calcDishFoodCost,
  calcMargin,
  calcNetRevenue,
} from '../../lib/calcEngine';
import { calcDishAllergens } from '../../lib/allergens';
import { saveToDB, deleteFromDB } from '../../lib/dataService';
import { ProductCard }     from '../foodcost/ProductCard';
import { SectionHeader }   from '../foodcost/SectionHeader';
import { FilterBar, applyFiltersAndSort } from '../foodcost/FilterBar';
import { PriceSuggestion } from '../foodcost/PriceSuggestion';
import { MAX_DISH_PRICE, DEFAULT_SECTIONS, DEFAULT_VAT_RATE } from '../../lib/config';
import { toNum } from '../../lib/num';

const uid  = () => Math.random().toString(36).slice(2, 10);
const euro = n => '€' + (parseFloat(n) || 0).toFixed(2);
const fmt1 = n => (parseFloat(n) || 0).toFixed(1);

// Fallback di visualizzazione = categorie di default centralizzate (con CONTORNO)
const FALLBACK_SECTIONS = DEFAULT_SECTIONS;

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
function PiattoModal({ dish, allIngredients, allPreparations, defaultCategory, sections, restaurant, onSave, onClose }) {
  const vatRate = restaurant?.vat_rate ?? DEFAULT_VAT_RATE;
  const [name,          setName]          = useState(dish?.name || '');
  const [category,      setCategory]      = useState(dish?.category || defaultCategory || (sections?.[0]?.name || 'PRIMO'));
  const [price,         setPrice]         = useState(dish?.price ?? dish?.selling_price ?? '');
  const [useManualCost, setUseManualCost] = useState(false);
  const [manualCost,    setManualCost]    = useState('');
  const [searchComp,    setSearchComp]    = useState('');
  const [internalNotes, setInternalNotes] = useState(dish?.internalNotes || '');
  const [isVisible,     setIsVisible]     = useState(dish?.isVisible !== false);
  const [error,         setError]         = useState(null);
  const [isSaving,      setIsSaving]      = useState(false);

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
    if (!comp.id_ref || !(toNum(comp.qty) > 0)) return 0;
    const item = pantryMap[comp.id_ref];
    if (!item) return 0;
    if (item._isPrep) {
      try { return calcPreparationInDish(item, toNum(comp.qty), comp.unit || item.unit); }
      catch { return 0; }
    }
    return calcIngredientCost(item, toNum(comp.qty), comp.unit || item.unit);
  }, [pantryMap]);

  const autoCost = useMemo(() => {
    const compsForCalc = components
      .filter(c => c.id_ref)
      .map(c => ({ type: c.type, id: c.id_ref, quantity: toNum(c.qty), unit: c.unit }));
    return calcDishFoodCost(compsForCalc, allIngredients || [], allPreparations || []);
  }, [components, allIngredients, allPreparations]);

  const foodCost = useManualCost ? (parseFloat(manualCost) || 0) : autoCost;
  const priceNum = parseFloat(price) || 0;
  // priceNum è il prezzo di menu IVA inclusa (quello che l'utente inserisce e
  // vede) — margine e food cost % si calcolano sul ricavo netto (Stage 10, Punto 1).
  const netRevenue = calcNetRevenue(priceNum, vatRate);
  const { marginEuro, marginPct, status } = calcMargin(netRevenue, foodCost);

  const allergens = useMemo(() => {
    const comps = components.filter(c => c.id_ref).map(c => ({ type: c.type, id: c.id_ref }));
    return calcDishAllergens(comps, allIngredients || [], allPreparations || []);
  }, [components, allIngredients, allPreparations]);

  const addComp = opt => {
    // Guard anti-duplicato: se l'ingrediente/preparazione è già in lista
    // (es. doppio click rapido sullo stesso risultato) non aggiungere una
    // seconda riga. Update funzionale sullo stato più recente.
    setComponents(prev => {
      if (prev.some(c => c.id_ref === opt.id)) return prev;
      return [...prev, {
        id: uid(), type: opt.type, id_ref: opt.id,
        name: opt.name, qty: '', unit: opt.unit || 'g', // qty vuota: mai un default plausibile come 1kg
      }];
    });
    setSearchComp('');
  };

  const updateComp = (i, field, val) => {
    // La quantità resta la STRINGA grezza digitata (permette "0.03", "0,03",
    // "0." intermedio): il parse robusto avviene solo al calcolo/salvataggio.
    setComponents(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  };

  const removeComp = i => setComponents(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    // Guard anti-doppio-submit: un doppio click/tap rapido (tipico su mobile,
    // specie mentre saveToDB() è ancora in volo) chiamerebbe questa funzione
    // due volte; per un piatto NUOVO ogni chiamata genera un id diverso
    // (`dish_${uid()}`), quindi produrrebbe due righe duplicate su Supabase
    // invece di aggiornare la stessa. Stessa classe di bug già risolta per
    // gli ingredienti in ricetta (guard anti-duplicato in addComp).
    if (isSaving) return;

    if (!name.trim())  { setError('Il nome è obbligatorio.'); return; }
    if (priceNum <= 0) { setError('Il prezzo di vendita deve essere > 0.'); return; }
    if (priceNum > MAX_DISH_PRICE) { setError(`Prezzo troppo alto: massimo ${MAX_DISH_PRICE} € per piatto.`); return; }

    const cleanComps = components.filter(c => c.id_ref && toNum(c.qty) > 0);
    const calculatedFoodCost = useManualCost
      ? toNum(manualCost)
      : calcDishFoodCost(
          cleanComps.map(c => ({ type: c.type, id: c.id_ref, quantity: toNum(c.qty), unit: c.unit })),
          allIngredients || [], allPreparations || []
        );

    // Ricalcolato qui (non riusato lo stato `netRevenue` sopra) perché
    // useManualCost può cambiare foodCost tra il preview e il salvataggio.
    const netRevenueAtSave = calcNetRevenue(priceNum, vatRate);
    const { marginEuro: me, marginPct: mp, status: st } = calcMargin(netRevenueAtSave, calculatedFoodCost);

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
        name: c.name, qty: toNum(c.qty),
        quantity: toNum(c.qty), unit: c.unit,
      })),
      updated_at: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      await saveToDB('dishes', dishData);
      onSave(dishData);
      onClose();
    } catch (err) {
      setError(err.message || 'Salvataggio non riuscito. Riprova.');
    } finally {
      setIsSaving(false);
    }
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
                      onMouseDown={e => { e.preventDefault(); addComp(opt); }}
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
                    type="text" inputMode="decimal" className="form-input"
                    value={comp.qty ?? ''}
                    onChange={e => updateComp(actualIdx, 'qty', e.target.value)}
                    placeholder="es. 150"
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

          {/* SUGGERIMENTO PREZZO — sotto la lista ingredienti, mai sopra la
              barra di ricerca: se stesse sopra, comparire/scomparire mentre
              si aggiungono ingredienti sposterebbe la barra e il suo dropdown
              proprio durante il flusso di selezione, causando click "a vuoto" (fix 4) */}
          {foodCost > 0 && <PriceSuggestion totalCost={foodCost} />}

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
                ['Prezzo menu (IVA incl.)', euro(priceNum)],
                [`Ricavo netto (IVA ${fmt1(vatRate)}%)`, euro(netRevenue)],
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
          <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvataggio...' : (dish ? 'Salva Modifiche' : 'Salva Prodotto')}
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
  recentlyUpdatedDishes,
  restaurant,
  onOpenScanner,
  targetMargin = 60,
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

  // ── Stage 10, Punto 3A: vista a categorie con drill-down ──────────
  // null = vista categorie (card cliccabili); stringa = categoria aperta.
  const [openCategory, setOpenCategory] = useState(null);
  // "Vedi tutti i piatti": lista intera in un colpo solo, come prima di 3A.
  const [showAllFlat,  setShowAllFlat]  = useState(false);
  // Ricerca globale sul nome piatto — indipendente dalla categoria aperta.
  const [searchQuery,  setSearchQuery]  = useState('');

  // ── Sections ordinati per display ────────────────────────────────
  const activeSections = useMemo(() => {
    const list = (sections && sections.length > 0) ? sections : FALLBACK_SECTIONS;
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [sections]);

  // Se la categoria aperta viene rinominata/eliminata mentre è in vista
  // drill-down, torna alla vista categorie invece di restare su un nome
  // che non esiste più (mai un setState durante il render).
  useEffect(() => {
    if (openCategory && !activeSections.some(s => s.name === openCategory)) {
      setOpenCategory(null);
    }
  }, [openCategory, activeSections]);

  // I filtri semaforo e la ricerca sono SEMPRE globali (across-category):
  // quando uno dei due è attivo si esce dalla vista a categorie/drill-down
  // e si mostra il risultato su tutte le sezioni, indipendentemente da
  // quale categoria fosse eventualmente aperta.
  const isNarrowing = activeFilters.length > 0 || searchQuery.trim() !== '';
  const isFlatView  = isNarrowing || showAllFlat;

  const matchesSearch = useCallback(dish => {
    const q = searchQuery.trim().toLowerCase();
    return !q || (dish.name || '').toLowerCase().includes(q);
  }, [searchQuery]);

  const enrichForDisplay = useCallback(rawList => rawList.map(dish => {
    const hasUpdatedIngredients = (dish.components || []).some(comp => {
      const ing = (ingredients || []).find(i => i.id === (comp.id_ref || comp.id));
      if (!ing?.updated_at || !dish.ingredientUpdatedAt) return false;
      return new Date(ing.updated_at) > new Date(dish.ingredientUpdatedAt);
    });
    return hasUpdatedIngredients ? { ...dish, hasUpdatedIngredients: true } : dish;
  }), [ingredients]);

  const getSectionDishes = useCallback(section => {
    const rawDishes = (dishes || []).filter(d =>
      (d.category || '').toUpperCase() === section.name.toUpperCase() && matchesSearch(d)
    );
    const sortedDishes = applyFiltersAndSort(enrichForDisplay(rawDishes), activeFilters, sortKey);
    return { rawDishes, sortedDishes };
  }, [dishes, matchesSearch, enrichForDisplay, activeFilters, sortKey]);

  // Sezioni con almeno un risultato, quando si sta effettivamente
  // restringendo (ricerca/filtro) — evita una parete di sezioni vuote.
  // Con "vedi tutti i piatti" invece si mostrano tutte, comprese le vuote,
  // com'era il comportamento di sempre.
  const sectionsToShow = useMemo(() => {
    if (!isNarrowing) return activeSections;
    return activeSections.filter(s => getSectionDishes(s).sortedDishes.length > 0);
  }, [isNarrowing, activeSections, getSectionDishes]);

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

  // Rendering di UNA sezione (header + piatti + bottone aggiungi) — condiviso
  // tra vista piatta (tutte le sezioni) e vista drill-down (una sola).
  const renderSection = (section, idx) => {
    const { rawDishes, sortedDishes } = getSectionDishes(section);
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
              {isNarrowing
                ? 'Nessun prodotto corrisponde alla ricerca/ai filtri.'
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
              flashKey={(recentlyUpdatedDishes || []).find(e => e.id === dish.id)?.ts || null}
              targetMargin={targetMargin}
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
  };

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
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', maxHeight: '100dvh', overflow: 'hidden', // pagina ferma: solo l'area lista scorre (Stage 10, Punto 3B)
      background: 'var(--bg-primary)',
    }}>

      {/* TOP BAR */}
      <TopBar currentPage={currentPage} onNavigate={onNavigate} onOpenSettings={onOpenSettings} restaurant={restaurant} />

      {/* HEADER */}
      <div style={{ padding: '16px 20px 12px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
          📋 Prodotti
        </h1>
      </div>

      {/* FILTER BAR — sempre globale: attivarla mostra i risultati across-category */}
      <FilterBar
        activeFilters={activeFilters}
        setActiveFilters={setActiveFilters}
        sortKey={sortKey}
        setSortKey={setSortKey}
      />

      {/* RICERCA — sempre globale, indipendente dalla categoria aperta */}
      <div style={{ padding: '10px 16px 0', background: 'var(--bg-primary)' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍  Cerca un piatto..."
            style={{
              width: '100%', padding: '10px 16px',
              border: '1px solid var(--border-color)', borderRadius: '10px',
              background: 'var(--bg-card)', color: 'var(--text-primary)',
              fontSize: '16px', minHeight: '44px', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              title="Cancella ricerca"
              style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                width: 32, height: 32, background: 'none', border: 'none',
                color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer',
              }}>
              ✕
            </button>
          )}
        </div>
      </div>

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
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowNewSection(true)}
              style={{
                flex: 1, padding: '9px', minHeight: 44,
                background: 'none', border: '2px dashed var(--border-color)',
                borderRadius: 8, color: 'var(--text-muted)',
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>
              + Aggiungi Sezione
            </button>
            <button
              onClick={() => onOpenScanner?.('dishes')}
              style={{
                padding: '9px 16px', minHeight: 44,
                background: 'none', border: '1px solid var(--border-color)',
                borderRadius: 8, color: 'var(--text-secondary)',
                fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              📷 Importa piatti
            </button>
          </div>
        )}
      </div>

      {/* EMPTY STATE GUIDATO — nessun piatto ancora */}
      {(dishes || []).length === 0 && (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🍽️</div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            Il tuo menù è vuoto
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 auto 20px', maxWidth: 340, lineHeight: 1.5 }}>
            Inizia in uno di questi modi:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 300, margin: '0 auto' }}>
            <button onClick={() => openAdd(activeSections[0]?.name || 'ANTIPASTO')} style={{
              padding: '12px 16px', minHeight: 48, background: 'var(--gold)', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              ➕ Aggiungi il primo piatto
            </button>
            <button onClick={() => onOpenScanner?.('dishes')} style={{
              padding: '12px 16px', minHeight: 48, background: 'none', color: 'var(--gold)',
              border: '1px solid var(--gold)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              📷 Scansiona un menù
            </button>
          </div>
        </div>
      )}

      {/* AREA PRINCIPALE — Stage 10, Punto 3A: tre viste possibili.
          1) ricerca/filtro attivi, o "vedi tutti" → lista piatta across-category
          2) categoria aperta (drill-down) → solo i piatti di quella categoria
          3) default → griglia categorie con conteggio, cliccabili */}
      <div id="product-list-demo" style={{ flex: 1, minHeight: 0, padding: '12px 16px 32px', overflowY: 'auto', display: (dishes || []).length === 0 ? 'none' : undefined }}>
        {isFlatView ? (
          <>
            {/* "← Torna alle categorie" solo per "vedi tutti": ricerca/filtro si
                azzerano dai loro stessi controlli, sempre visibili sopra. */}
            {showAllFlat && !isNarrowing && (
              <button
                onClick={() => setShowAllFlat(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, minHeight: 44,
                  background: 'none', border: 'none', color: 'var(--gold)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0,
                }}>
                ← Torna alle categorie
              </button>
            )}
            {sectionsToShow.length === 0 ? (
              <div className="empty-state" style={{ lineHeight: 1.6 }}>
                <div className="empty-state-icon">🔍</div>
                Nessun piatto corrisponde alla ricerca/ai filtri.
              </div>
            ) : (
              sectionsToShow.map((section, idx) => renderSection(section, idx))
            )}
          </>
        ) : openCategory ? (
          <>
            <button
              onClick={() => setOpenCategory(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, minHeight: 44,
                background: 'none', border: 'none', color: 'var(--gold)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0,
              }}>
              ← Tutte le categorie
            </button>
            {(() => {
              const idx = activeSections.findIndex(s => s.name === openCategory);
              return idx >= 0 ? renderSection(activeSections[idx], idx) : null;
            })()}
          </>
        ) : (
          /* VISTA CATEGORIE — card cliccabili con conteggio piatti */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {activeSections.map(section => {
              const count = (dishes || []).filter(d =>
                (d.category || '').toUpperCase() === section.name.toUpperCase()
              ).length;
              return (
                <button
                  key={section.id}
                  onClick={() => setOpenCategory(section.name)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '20px 12px', minHeight: 110,
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                  }}>
                  <span style={{ fontSize: 26 }}>🍽️</span>
                  <span style={{
                    fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 13,
                    color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    {section.name}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {count} piatt{count === 1 ? 'o' : 'i'}
                  </span>
                </button>
              );
            })}
            {/* VEDI TUTTI — lista intera in un colpo solo, per chi la preferisce */}
            <button
              onClick={() => setShowAllFlat(true)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '20px 12px', minHeight: 110,
                background: 'none', border: '2px dashed var(--border-color)',
                borderRadius: 12, cursor: 'pointer', textAlign: 'center', color: 'var(--text-muted)',
              }}>
              <span style={{ fontSize: 26 }}>📋</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Vedi tutti i piatti</span>
              <span style={{ fontSize: 12 }}>({(dishes || []).length})</span>
            </button>
          </div>
        )}
      </div>

      {/* MODAL PIATTO */}
      {showAddModal && (
        <PiattoModal
          dish={editingDish}
          allIngredients={ingredients || []}
          allPreparations={preparations || []}
          defaultCategory={addToCategory}
          sections={activeSections}
          restaurant={restaurant}
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

      <style>{`
        @keyframes productCardFlash {
          0%   { box-shadow: 0 0 0 3px rgba(234,179,8,0.55); background: rgba(234,179,8,0.14); }
          100% { box-shadow: 0 0 0 0 rgba(234,179,8,0); background: var(--bg-card); }
        }
      `}</style>
    </div>
  );
}

export default MenuPage;
