// ══════════════════════════════════════════════════════════════
//  LITTLECHEF · dataService — layer dati su Supabase (Stage 2)
//
//  Espone la STESSA API di db.js (getAllFromDB / saveToDB /
//  deleteFromDB) così i componenti cambiano solo l'import.
//  RLS filtra automaticamente per ristorante loggato: un semplice
//  select * torna solo le righe dell'account corrente.
//
//  Ogni scrittura passa da una whitelist di colonne per tabella:
//  i campi derivati a runtime (fixedCostOnDish, totalCost, ...)
//  non esistono nello schema e vanno scartati prima dell'insert.
// ══════════════════════════════════════════════════════════════
import { supabase, getMyRestaurant } from './supabase';
import { buildDemoData } from './demoSeed';
import { MAX_DISH_PRICE, MAX_INGREDIENT_PRICE } from './config';

// Validazione prezzi lato dati: blocca valori negativi e assurdi PRIMA
// di scrivere su Supabase. Non ci si fida del solo controllo visivo.
function validateBeforeSave(table, item) {
  const num = v => (v === undefined || v === null || v === '') ? null : parseFloat(v);
  const bad = (v, max) => v !== null && (v < 0 || v > max);

  if (table === 'dishes') {
    const sp = num(item.selling_price ?? item.price);
    if (sp !== null && sp <= 0) throw new Error('Il prezzo di vendita deve essere maggiore di 0.');
    if (bad(sp, MAX_DISH_PRICE)) throw new Error(`Prezzo non valido: deve essere tra 0 e ${MAX_DISH_PRICE} €.`);
  }
  if (table === 'pantry_items' || table === 'preparations') {
    const pp = num(item.price_per_unit ?? item.price);
    if (bad(pp, MAX_INGREDIENT_PRICE)) throw new Error(`Prezzo non valido: deve essere tra 0 e ${MAX_INGREDIENT_PRICE} €.`);
  }
  if (table === 'fixed_costs') {
    const am = num(item.amount_monthly);
    if (am !== null && am < 0) throw new Error('Il costo mensile non può essere negativo.');
  }
}

// Mappa nome store IndexedDB → tabella Supabase
const TABLE = {
  ingredients:  'pantry_items',
  pantry_items: 'pantry_items',
  preparations: 'preparations',
  dishes:       'dishes',
  fixed_costs:  'fixed_costs',
  sections:     'sections',
};

// Colonne ammesse per tabella (tutto il resto viene scartato in scrittura)
const COLUMNS = {
  pantry_items: ['id', 'restaurant_id', 'name', 'unit', 'price', 'price_per_unit', 'waste', 'allergens', '_isPrep', 'updated_at'],
  preparations: ['id', 'restaurant_id', 'name', 'unit', 'yield_unit', 'price', 'price_per_unit', 'waste', 'allergens', '_isPrep', 'total_cost', 'total_yield', 'components', 'updated_at'],
  dishes:       ['id', 'restaurant_id', 'name', 'category', 'price', 'selling_price', 'food_cost', 'margin_euro', 'margin_pct', 'status', 'allergens', 'internalNotes', 'isVisible', 'isSpecial', 'ingredientUpdatedAt', 'components', 'updated_at'],
  fixed_costs:  ['id', 'restaurant_id', 'name', 'type', 'amount_monthly', 'note', 'updated_at'],
  sections:     ['id', 'restaurant_id', 'name', 'order'],
};

function pick(table, item) {
  const allowed = COLUMNS[table] || Object.keys(item);
  const out = {};
  for (const k of allowed) {
    if (item[k] !== undefined) out[k] = item[k];
  }
  return out;
}

// ── Ristorante corrente (cache in memoria, azzerata al logout) ──
let _restaurantId = null;
export async function getRestaurantId() {
  if (_restaurantId) return _restaurantId;
  const r = await getMyRestaurant();
  _restaurantId = r?.id || null;
  return _restaurantId;
}
export function clearRestaurantCache() { _restaurantId = null; }

// ── API compatibile con db.js ──────────────────────────────────
export async function getAllFromDB(store) {
  const table = TABLE[store] || store;
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return data || [];
}

export async function saveToDB(store, item) {
  const table = TABLE[store] || store;
  validateBeforeSave(table, item);
  const rid = await getRestaurantId();
  if (!rid) throw new Error('Nessun ristorante attivo: impossibile salvare');
  const row = pick(table, { ...item, restaurant_id: rid });
  const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteFromDB(store, id) {
  const table = TABLE[store] || store;
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

// ── Ricavi mensili stimati → colonna su restaurants ────────────
export async function dbGetSetting(key) {
  if (key === 'estimatedMonthlyRevenue') {
    const r = await getMyRestaurant();
    return r?.estimated_monthly_revenue ?? 0;
  }
  return undefined;
}

export async function dbSetSetting(key, value) {
  if (key === 'estimatedMonthlyRevenue') {
    const rid = await getRestaurantId();
    if (!rid) return;
    const { error } = await supabase
      .from('restaurants')
      .update({ estimated_monthly_revenue: parseFloat(value) || 0 })
      .eq('id', rid);
    if (error) throw error;
  }
}

// ── Seed demo su Supabase per il ristorante loggato ────────────
// Sostituisce tutti i dati del ristorante corrente con il dataset demo.
export async function seedDemoSupabase() {
  const rid = await getRestaurantId();
  if (!rid) throw new Error('Nessun ristorante attivo: impossibile caricare la demo');

  const demo = buildDemoData();

  // Gli id demo sono stringhe fisse globali (demo_ing_xxx): con PK globale
  // ristoranti diversi collidono. Rendo ogni id unico per ristorante e
  // rimappo i riferimenti dei components (dish → ingrediente).
  const p = rid.slice(0, 8);
  const rid8 = id => `${p}_${id}`;

  const ingredients = demo.ingredients.map(i => ({ ...i, id: rid8(i.id) }));
  const fixedCosts  = demo.fixedCosts.map(c => ({ ...c, id: rid8(c.id) }));
  const sections    = demo.sections.map(s => ({ ...s, id: rid8(s.id) }));
  const dishes      = demo.dishes.map(d => ({
    ...d,
    id: rid8(d.id),
    components: (d.components || []).map(c => ({
      ...c,
      ...(c.id     !== undefined ? { id:     rid8(c.id) }     : {}),
      ...(c.id_ref !== undefined ? { id_ref: rid8(c.id_ref) } : {}),
    })),
  }));
  const estimatedRevenue = demo.estimatedRevenue;

  // 1) Pulizia dati esistenti del ristorante (RLS limita al proprio)
  for (const table of ['dishes', 'preparations', 'pantry_items', 'fixed_costs', 'sections']) {
    const { error } = await supabase.from(table).delete().eq('restaurant_id', rid);
    if (error) throw error;
  }

  // 2) Inserimento nuovo dataset con restaurant_id
  const withRid = (table, arr) => arr.map(x => pick(table, { ...x, restaurant_id: rid }));

  const ins = async (table, rows) => {
    if (!rows.length) return;
    const { error } = await supabase.from(table).insert(rows);
    if (error) throw error;
  };

  await ins('sections',     withRid('sections', sections));
  await ins('pantry_items', withRid('pantry_items', ingredients));
  await ins('fixed_costs',  withRid('fixed_costs', fixedCosts));
  await ins('dishes',       withRid('dishes', dishes));

  // 3) Ricavi stimati sul ristorante
  await supabase.from('restaurants')
    .update({ estimated_monthly_revenue: estimatedRevenue })
    .eq('id', rid);

  return { ingredients, fixedCosts, dishes, sections };
}
