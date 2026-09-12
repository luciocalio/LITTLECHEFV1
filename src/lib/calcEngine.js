// src/lib/calcEngine.js — V4.0
// Regola: ogni ingrediente usa SOLO unità della stessa categoria.
// Peso: kg, g, dag | Volume: L, dl, cl, ml | Pezzi: pz, porzione, fetta

export const UNIT_CATEGORIES = {
  weight: ['kg', 'g', 'dag'],
  volume: ['L', 'dl', 'cl', 'ml'],
  count:  ['pz', 'porzione', 'fetta'],
};

export const AVAILABLE_UNITS = [
  { value: 'kg',       label: 'Kilogrammi (kg)',  category: 'weight' },
  { value: 'g',        label: 'Grammi (g)',        category: 'weight' },
  { value: 'dag',      label: 'Decagrammi (dag)', category: 'weight' },
  { value: 'L',        label: 'Litri (L)',         category: 'volume' },
  { value: 'dl',       label: 'Decilitri (dl)',   category: 'volume' },
  { value: 'cl',       label: 'Centilitri (cl)',  category: 'volume' },
  { value: 'ml',       label: 'Millilitri (ml)',  category: 'volume' },
  { value: 'pz',       label: 'Pezzi (pz)',        category: 'count'  },
  { value: 'porzione', label: 'Porzioni',          category: 'count'  },
  { value: 'fetta',    label: 'Fette',             category: 'count'  },
];

// Base: grammi per peso, millilitri per volume, unità per pezzi
const TO_BASE_FACTOR = {
  'kg': 1000, 'g': 1, 'dag': 10,
  'L': 1000,  'dl': 100, 'cl': 10, 'ml': 1,
  'pz': 1, 'porzione': 1, 'fetta': 1,
};

export function getUnitCategory(unit) {
  if (!unit) return null;
  for (const [cat, units] of Object.entries(UNIT_CATEGORIES)) {
    if (units.includes(unit)) return cat;
  }
  return null;
}

export function getCompatibleUnits(unit) {
  const cat = getUnitCategory(unit);
  if (!cat) return AVAILABLE_UNITS;
  return AVAILABLE_UNITS.filter(u => u.category === cat);
}

// toBase(120, 'ml') = 120 | toBase(1, 'L') = 1000
// toBase(50, 'g')   = 50  | toBase(1, 'kg') = 1000
function toBase(qty, unit) {
  const factor = TO_BASE_FACTOR[unit];
  if (factor == null) {
    console.warn(`[calcEngine] Unità sconosciuta: "${unit}"`);
    return parseFloat(qty) || 0;
  }
  return (parseFloat(qty) || 0) * factor;
}

/**
 * FORMULA: costo = (toBase(qty, unitUsata) / toBase(1, unitPrezzo)) * prezzo
 *
 * Olio €9/L, 120ml:  (120/1000) * 9 = €1.08  ✅
 * Pasta €1.50/kg, 120g: (120/1000) * 1.50 = €0.18 ✅
 * Ricci €70/kg, 50g:  (50/1000)  * 70 = €3.50  ✅
 */
export function calcIngredientCost(ingredient, quantityUsed, unitUsed) {
  if (!ingredient) return 0;
  const price = parseFloat(ingredient.price_per_unit);
  if (!price || price <= 0 || isNaN(price)) return 0;
  const qty = parseFloat(quantityUsed);
  if (!qty || qty <= 0 || isNaN(qty)) return 0;
  const unitFrom = unitUsed || ingredient.unit;
  const unitTo   = ingredient.unit;
  if (!unitFrom || !unitTo) return 0;
  const catFrom = getUnitCategory(unitFrom);
  const catTo   = getUnitCategory(unitTo);
  if (catFrom && catTo && catFrom !== catTo) {
    console.warn(`[calcEngine] INCOMPATIBILITÀ: "${ingredient.name}" usa "${unitFrom}" vs "${unitTo}"`);
    return 0;
  }
  const qtyBase  = toBase(qty, unitFrom);
  const unitBase = toBase(1, unitTo);
  const cost     = (qtyBase / unitBase) * price;  // DIVISIONE — mai moltiplicazione
  if (isNaN(cost) || !isFinite(cost) || cost < 0) return 0;
  return Math.round(cost * 10000) / 10000;
}

export function calcPreparationCost(components, allIngredients) {
  if (!Array.isArray(components) || components.length === 0) return 0;
  if (!Array.isArray(allIngredients) || allIngredients.length === 0) return 0;
  return components.reduce((total, comp) => {
    const ingredient = allIngredients.find(i => i.id === (comp.ingredient_id || comp.id));
    if (!ingredient) return total;
    return total + calcIngredientCost(ingredient, comp.quantity, comp.unit || ingredient.unit);
  }, 0);
}

/**
 * Calcola il costo proporzionale di una preparazione usata in un piatto.
 * Esempio: Fondo Ricci total_cost=€6, total_yield=800g, uso 200g → ratio=0.25 → €1.50
 */
export function calcPreparationInDish(preparation, qtyUsed, unitUsed) {
  if (!preparation || !qtyUsed || qtyUsed <= 0) return 0;
  const totalCost  = parseFloat(preparation.total_cost) || 0;
  const totalYield = parseFloat(preparation.total_yield);
  const yieldUnit  = preparation.yield_unit || preparation.unit || 'g';
  if (!totalYield || totalYield <= 0 || isNaN(totalYield)) return totalCost;
  const unitToUse = unitUsed || yieldUnit;
  const usedBase  = toBase(parseFloat(qtyUsed), unitToUse);
  const yieldBase = toBase(totalYield, yieldUnit);
  if (!yieldBase || yieldBase <= 0) return totalCost;
  const ratio = usedBase / yieldBase;
  return Math.round(totalCost * ratio * 10000) / 10000;
}

export function calcDishFoodCost(components, allIngredients, allPreparations) {
  if (!Array.isArray(components) || components.length === 0) return 0;
  return components.reduce((total, comp) => {
    const qty = parseFloat(comp.quantity) || 0;
    if (qty <= 0) return total;
    if (comp.type === 'ingredient') {
      const ingredient = (allIngredients || []).find(i => i.id === comp.id);
      if (!ingredient) return total;
      return total + calcIngredientCost(ingredient, qty, comp.unit || ingredient.unit);
    }
    if (comp.type === 'preparation') {
      const prep = (allPreparations || []).find(p => p.id === comp.id);
      if (!prep) return total;
      const totalCost  = parseFloat(prep.total_cost) || 0;
      const totalYield = parseFloat(prep.total_yield);
      const yieldUnit  = prep.yield_unit || 'g';
      if (!totalYield || totalYield <= 0 || isNaN(totalYield)) return total + totalCost;
      const ratio = toBase(qty, comp.unit || yieldUnit) / toBase(totalYield, yieldUnit);
      const cost  = totalCost * ratio;
      return total + (isNaN(cost) || !isFinite(cost) ? 0 : cost);
    }
    return total;
  }, 0);
}

/**
 * Stage 10, Punto 1 — UNICA eccezione motivata al divieto di toccare
 * calcEngine.js: aggiunge un livello di calcolo SOPRA la logica esistente,
 * non modifica calcMargin/calcDishWithFixedCosts né le loro soglie.
 *
 * Il prezzo che il ristoratore inserisce per un piatto è IVA inclusa (quello
 * che vede sul proprio menu) — non è ricavo pieno, una parte va allo Stato.
 * Questa funzione calcola il ricavo NETTO da passare a calcMargin/
 * calcDishWithFixedCosts al posto del prezzo lordo, così margine e food
 * cost % riflettono quello che resta davvero al ristorante.
 *
 * ricavo_netto = prezzo_vendita / (1 + aliquota_iva/100)
 * Es: €12,00 a IVA 10% → 12 / 1.10 = €10,91
 */
export function calcNetRevenue(sellingPrice, vatRatePct) {
  const price = parseFloat(sellingPrice) || 0;
  const vat = parseFloat(vatRatePct);
  if (!isFinite(vat) || vat < 0) return price; // aliquota non valida: nessuna detrazione, fail-safe
  return price / (1 + vat / 100);
}

export function calcMargin(sellingPrice, foodCost) {
  const price = parseFloat(sellingPrice) || 0;
  const cost  = parseFloat(foodCost)     || 0;
  if (price <= 0) return { marginEuro: 0, marginPct: 0, status: 'risk' };
  const marginEuro = Math.round((price - cost) * 100) / 100;
  const marginPct  = Math.round(((price - cost) / price) * 1000) / 10;
  const status     = marginPct > 50 ? 'top' : marginPct >= 30 ? 'media' : 'risk';
  return { marginEuro, marginPct, status };
}

export function calcAvgFoodCostPct(dishes) {
  const valid = (dishes || []).filter(d => parseFloat(d.selling_price) > 0);
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, d) => {
    const pct = (parseFloat(d.food_cost) / parseFloat(d.selling_price)) * 100;
    return acc + (isNaN(pct) ? 0 : pct);
  }, 0);
  return Math.round((sum / valid.length) * 10) / 10;
}

export function getTopByMargin(dishes, n = 5) {
  return (dishes || [])
    .filter(d => parseFloat(d.selling_price) > 0)
    .map(d => ({ ...d, ...calcMargin(d.selling_price, d.food_cost) }))
    .sort((a, b) => b.marginPct - a.marginPct)
    .slice(0, n);
}

export function convertPrice(price, oldUnit, newUnit) {
  const oldBase = TO_BASE_FACTOR[oldUnit] || 1;
  const newBase = TO_BASE_FACTOR[newUnit] || 1;
  return (parseFloat(price) || 0) * (newBase / oldBase);
}

export function safeNum(val, fallback = 0) {
  const n = parseFloat(val);
  return isNaN(n) || !isFinite(n) ? fallback : n;
}

// ─── FIXED COSTS ENGINE ─────────────────────────────────────────────────────

export function calcTotalFixedCosts(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const amount = item.amount;
    return sum + (isFinite(amount) && amount > 0 ? amount : 0);
  }, 0);
}

export function calcFixedCostRatio(totalFixedCosts, estimatedMonthlyRevenue) {
  if (
    !isFinite(totalFixedCosts)      || totalFixedCosts      <= 0 ||
    !isFinite(estimatedMonthlyRevenue) || estimatedMonthlyRevenue <= 0
  ) return 0;
  return totalFixedCosts / estimatedMonthlyRevenue; // piena precisione, NO toFixed
}

export function calcDishWithFixedCosts(ingredientsCost, sellingPrice, fixedCostRatio) {
  const fixedCostOnDish = sellingPrice * fixedCostRatio;
  const totalCost = ingredientsCost + fixedCostOnDish;
  const grossMargin = sellingPrice - totalCost;
  const marginPct = (grossMargin / sellingPrice) * 100;

  return {
    fixedCostOnDish: Math.round(fixedCostOnDish * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    grossMargin: Math.round(grossMargin * 100) / 100,
    marginPct: Math.round(marginPct * 10) / 10,
  };
}

export function recalcAllDishes(allDishes, fixedCostRatio) {
  return allDishes.map(dish => {
    const derived = calcDishWithFixedCosts(
      dish.ingredientsCost ?? dish.food_cost ?? 0,
      dish.sellingPrice    ?? dish.selling_price ?? dish.price ?? 0,
      fixedCostRatio
    );
    return { ...dish, ...derived };
  });
}
