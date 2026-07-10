// src/lib/allergens.js

export const ALLERGENS = {
  gluten:    { emoji: '🌾', name: 'Cereali con glutine',         ingredients_hint: ['farina','pasta','pane','grano','orzo','segale','avena','farro','spelta','kamut'] },
  shellfish: { emoji: '🦐', name: 'Crostacei',                   ingredients_hint: ['gambero','gamberetto','granchio','aragosta','astice','scampo','mazzancolla'] },
  eggs:      { emoji: '🥚', name: 'Uova',                        ingredients_hint: ['uovo','uova','albume','tuorlo','maionese','besciamella'] },
  fish:      { emoji: '🐟', name: 'Pesce',                       ingredients_hint: ['pesce','tonno','salmone','merluzzo','branzino','orata','alici','acciughe','baccalà','sogliola','spada','cernia'] },
  peanuts:   { emoji: '🥜', name: 'Arachidi',                    ingredients_hint: ['arachide','arachidi','burro di arachidi'] },
  soy:       { emoji: '🫘', name: 'Soia',                        ingredients_hint: ['soia','tofu','edamame','miso','salsa di soia','tempeh'] },
  dairy:     { emoji: '🥛', name: 'Latte e latticini',           ingredients_hint: ['latte','panna','burro','formaggio','mozzarella','ricotta','grana','parmigiano','pecorino','gorgonzola','mascarpone','yogurt','besciamella'] },
  nuts:      { emoji: '🌰', name: 'Frutta a guscio',             ingredients_hint: ['noce','noci','mandorla','mandorle','nocciola','nocciole','pistacchio','anacardo','pinolo','pinoli','castagna'] },
  celery:    { emoji: '🌿', name: 'Sedano',                      ingredients_hint: ['sedano','sedano rapa','celeriac'] },
  mustard:   { emoji: '🌱', name: 'Senape',                      ingredients_hint: ['senape','mostarda'] },
  sesame:    { emoji: '🍞', name: 'Sesamo',                      ingredients_hint: ['sesamo','tahini'] },
  sulfites:  { emoji: '🍷', name: 'Solfiti/Anidride solforosa',  ingredients_hint: ['vino','aceto','frutta secca','succo di limone conservato'] },
  lupin:     { emoji: '🌼', name: 'Lupini',                      ingredients_hint: ['lupino','lupini','farina di lupino'] },
  mollusks:  { emoji: '🐙', name: 'Molluschi',                   ingredients_hint: ['polpo','calamaro','seppia','cozza','vongola','ostrica','lumaca'] },
};

export function detectAllergens(ingredientName) {
  if (!ingredientName) return [];
  const name = ingredientName.toLowerCase().trim();
  const found = [];
  for (const [key, allergen] of Object.entries(ALLERGENS)) {
    if (allergen.ingredients_hint.some(hint => name.includes(hint))) found.push(key);
  }
  return found;
}

export function mergeAllergens(...allergenArrays) {
  const set = new Set();
  allergenArrays.forEach(arr => (arr || []).forEach(a => set.add(a)));
  return Array.from(set);
}

export function allergenEmojis(allergenKeys) {
  if (!allergenKeys?.length) return '';
  return allergenKeys.filter(k => ALLERGENS[k]).map(k => ALLERGENS[k].emoji).join(' ');
}

export function calcDishAllergens(components, ingredients, preparations) {
  if (!components?.length) return [];
  const all = [];
  for (const comp of components) {
    if (comp.type === 'ingredient') {
      const ing = ingredients?.find(i => i.id === comp.id);
      if (ing) all.push(...(ing.allergens || ing.allergens_json || detectAllergens(ing.name)));
    }
    if (comp.type === 'preparation') {
      const prep = preparations?.find(p => p.id === comp.id);
      if (prep) {
        if (prep.allergens) all.push(...prep.allergens);
        else {
          const prepComps = prep.ingredients_json || prep.components || [];
          for (const pc of prepComps) {
            const ing = ingredients?.find(i => i.id === (pc.ingredient_id ?? pc.id));
            if (ing) all.push(...(ing.allergens || detectAllergens(ing.name)));
          }
        }
      }
    }
  }
  return [...new Set(all)];
}
