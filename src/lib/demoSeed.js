// src/lib/demoSeed.js — V13
// Dataset completo ristorante italiano medio (cibo + beverage)
// 47 piatti · 43 ingredienti · 15 costi fissi
// Ratio fissi: 15780 / 46000 = 0.343 (~34,3%) — calcolato via calcFixedCostRatio, mai hardcodato

import { dbSetAll, dbSetSetting } from './db';
import { calcDishWithFixedCosts, calcFixedCostRatio } from './calcEngine';

// ── SEZIONI ──────────────────────────────────────────────────────────────────
const DEMO_SECTIONS = [
  { id: 'demo_sec_antipasto', name: 'ANTIPASTO', order: 0 },
  { id: 'demo_sec_primo',     name: 'PRIMO',     order: 1 },
  { id: 'demo_sec_secondo',   name: 'SECONDO',   order: 2 },
  { id: 'demo_sec_dolce',     name: 'DOLCE',     order: 3 },
  { id: 'demo_sec_bevande',   name: 'BEVANDE',   order: 4 },
];

// ── INGREDIENTI ──────────────────────────────────────────────────────────────
const DEMO_INGREDIENTS_SPEC = [
  // Secchi / Base
  { name: 'Pasta di semola',             unit: 'kg',  price_per_unit: 1.80,  waste: 0  },
  { name: 'Riso Carnaroli',              unit: 'kg',  price_per_unit: 3.50,  waste: 0  },
  { name: 'Farina 00',                   unit: 'kg',  price_per_unit: 0.90,  waste: 0  },
  { name: 'Pangrattato',                 unit: 'kg',  price_per_unit: 2.00,  waste: 0  },
  // Pomodoro
  { name: 'Pomodori pelati',             unit: 'kg',  price_per_unit: 2.20,  waste: 5  },
  { name: 'Passata di pomodoro',         unit: 'kg',  price_per_unit: 1.50,  waste: 0  },
  // Condimenti e liquidi
  { name: 'Olio extravergine oliva',     unit: 'L',   price_per_unit: 8.50,  waste: 0  },
  { name: 'Olio per friggere',           unit: 'L',   price_per_unit: 2.50,  waste: 0  },
  { name: 'Aceto balsamico',             unit: 'L',   price_per_unit: 6.00,  waste: 0  },
  // Aromatici
  { name: 'Aglio',                       unit: 'kg',  price_per_unit: 4.00,  waste: 15 },
  { name: 'Cipolla',                     unit: 'kg',  price_per_unit: 1.50,  waste: 12 },
  { name: 'Basilico fresco',             unit: 'g',   price_per_unit: 0.02,  waste: 10 },
  { name: 'Prezzemolo',                  unit: 'g',   price_per_unit: 0.015, waste: 10 },
  { name: 'Rucola',                      unit: 'kg',  price_per_unit: 8.00,  waste: 8  },
  // Ortaggi
  { name: 'Patate',                      unit: 'kg',  price_per_unit: 1.20,  waste: 10 },
  { name: 'Funghi porcini',              unit: 'kg',  price_per_unit: 25.00, waste: 10 },
  { name: 'Limoni',                      unit: 'kg',  price_per_unit: 2.00,  waste: 20 },
  // Latticini
  { name: 'Mozzarella fior di latte',    unit: 'kg',  price_per_unit: 6.50,  waste: 3  },
  { name: 'Parmigiano Reggiano',         unit: 'kg',  price_per_unit: 16.00, waste: 2  },
  { name: 'Pecorino Romano',             unit: 'kg',  price_per_unit: 14.00, waste: 2  },
  { name: 'Mascarpone',                  unit: 'kg',  price_per_unit: 9.00,  waste: 0  },
  { name: 'Panna fresca',               unit: 'L',   price_per_unit: 4.50,  waste: 0  },
  { name: 'Burro',                       unit: 'kg',  price_per_unit: 8.00,  waste: 0  },
  { name: 'Uova',                        unit: 'pz',  price_per_unit: 0.35,  waste: 0  },
  // Carne
  { name: 'Manzo controfiletto',         unit: 'kg',  price_per_unit: 28.00, waste: 8  },
  { name: 'Filetto di manzo',            unit: 'kg',  price_per_unit: 38.00, waste: 6  },
  { name: 'Petto di pollo',             unit: 'kg',  price_per_unit: 8.50,  waste: 5  },
  { name: 'Guanciale',                   unit: 'kg',  price_per_unit: 18.00, waste: 5  },
  { name: 'Salumi misti',               unit: 'kg',  price_per_unit: 22.00, waste: 3  },
  { name: 'Ossobuco di vitello',         unit: 'kg',  price_per_unit: 16.00, waste: 12 },
  // Pesce
  { name: 'Pesce misto grigliata',       unit: 'kg',  price_per_unit: 18.00, waste: 15 },
  { name: 'Calamari',                    unit: 'kg',  price_per_unit: 12.00, waste: 20 },
  { name: 'Vongole veraci',              unit: 'kg',  price_per_unit: 30.00, waste: 5  },
  // Dolci
  { name: 'Savoiardi',                   unit: 'kg',  price_per_unit: 6.00,  waste: 0  },
  { name: 'Caffe in polvere',            unit: 'kg',  price_per_unit: 20.00, waste: 0  },
  { name: 'Cacao amaro',                 unit: 'kg',  price_per_unit: 12.00, waste: 0  },
  { name: 'Cioccolato fondente',         unit: 'kg',  price_per_unit: 11.00, waste: 0  },
  { name: 'Frutti di bosco',             unit: 'kg',  price_per_unit: 9.00,  waste: 5  },
  // Bevande
  { name: 'Acqua minerale 0.75L',        unit: 'pz',  price_per_unit: 0.30,  waste: 0  },
  { name: 'Coca-Cola lattina',           unit: 'pz',  price_per_unit: 0.50,  waste: 0  },
  { name: 'Birra alla spina fusto',      unit: 'L',   price_per_unit: 3.20,  waste: 0  },
  { name: 'Vino della casa sfuso',       unit: 'L',   price_per_unit: 3.00,  waste: 0  },
  { name: 'Vino Chianti bottiglia',      unit: 'pz',  price_per_unit: 7.00,  waste: 0  },
];

// ── COSTI FISSI ──────────────────────────────────────────────────────────────
// Totale: €15.780 · Ricavi stimati: €46.000 · Ratio: 15780/46000 = 0,343 (~34,3%)
const DEMO_FIXED_COSTS_SPEC = [
  { name: 'Affitto locale',             category: 'Affitto',       amount_monthly: 2000 },
  { name: 'Utenze (luce, gas, acqua)',  category: 'Utenze',        amount_monthly: 800  },
  { name: 'Personale',                  category: 'Personale',     amount_monthly: 5500 },
  { name: 'Manutenzione attrezzature',  category: 'Manutenzione',  amount_monthly: 250  },
  { name: 'Assicurazione locale',       category: 'Assicurazioni', amount_monthly: 180  },
  { name: 'Commercialista',             category: 'Altro',         amount_monthly: 200  },
  { name: 'Software gestionale',        category: 'Software',      amount_monthly: 120  },
  { name: 'TARI rifiuti',              category: 'Utenze',        amount_monthly: 150  },
  { name: 'Stipendio chef',             category: 'Personale',     amount_monthly: 2800 },
  { name: 'Stipendio cuoco',            category: 'Personale',     amount_monthly: 1800 },
  { name: 'Stipendio cameriere',        category: 'Personale',     amount_monthly: 1200 },
  { name: 'Telefono e internet',        category: 'Utenze',        amount_monthly: 80   },
  { name: 'Pulizie professionali',      category: 'Manutenzione',  amount_monthly: 300  },
  { name: 'Marketing e pubblicità',     category: 'Altro',         amount_monthly: 250  },
  { name: 'Licenza e permessi',         category: 'Altro',         amount_monthly: 150  },
];

// ── PIATTI ───────────────────────────────────────────────────────────────────
// I commenti % sotto sono riferiti al VECCHIO ratio 0,20 (dataset originale a 26 piatti).
// Con il nuovo ratio ~0,343 i colori reali sono più spostati verso arancio/rosso
// (marginPct = (1 - ratio - foodCost/price) * 100) — verificati a runtime, non hardcodati.
const DEMO_DISHES_SPEC = [
  // ANTIPASTO
  { section: 'ANTIPASTO', name: 'Bruschetta al pomodoro',          price: 5.00,  foodCost: 0.75  }, // 🟢 65.0%
  { section: 'ANTIPASTO', name: 'Insalata caprese',                price: 8.00,  foodCost: 2.80  }, // 🟡 45.0%
  { section: 'ANTIPASTO', name: 'Tagliere di salumi',              price: 12.00, foodCost: 6.00  }, // 🟠 30.0%
  { section: 'ANTIPASTO', name: 'Frittura di calamari',            price: 12.00, foodCost: 6.60  }, // 🟠 25.0%
  { section: 'ANTIPASTO', name: 'Focaccia con rosmarino',          price: 4.50,  foodCost: 0.60  },
  { section: 'ANTIPASTO', name: 'Burrata con pomodorini',          price: 10.00, foodCost: 3.50  },
  { section: 'ANTIPASTO', name: 'Carpaccio di manzo',              price: 14.00, foodCost: 7.00  },
  { section: 'ANTIPASTO', name: 'Panettone salato',                price: 6.00,  foodCost: 2.00  },
  // PRIMO
  { section: 'PRIMO', name: 'Spaghetti aglio olio e peperoncino',  price: 8.00,  foodCost: 1.00  }, // 🟢 67.5%
  { section: 'PRIMO', name: 'Spaghetti al pomodoro',               price: 9.00,  foodCost: 1.35  }, // 🟢 65.0%
  { section: 'PRIMO', name: 'Spaghetti alla carbonara',            price: 11.00, foodCost: 3.00  }, // 🟡 52.7%
  { section: 'PRIMO', name: 'Lasagna alla bolognese',              price: 10.00, foodCost: 3.20  }, // 🟡 48.0%
  { section: 'PRIMO', name: 'Risotto ai funghi porcini',           price: 13.00, foodCost: 4.50  }, // 🟡 45.4%
  { section: 'PRIMO', name: 'Pizza Margherita',                    price: 7.00,  foodCost: 1.75  }, // 🟡 55.0%
  { section: 'PRIMO', name: 'Pasta alle vongole',                  price: 14.00, foodCost: 8.40  }, // 🟠 20.0%
  { section: 'PRIMO', name: 'Gnocchi al ragù',                     price: 10.50, foodCost: 3.50  },
  { section: 'PRIMO', name: 'Risotto al nero di seppia',           price: 14.00, foodCost: 6.00  },
  { section: 'PRIMO', name: 'Pappardelle al cinghiale',            price: 12.00, foodCost: 4.80  },
  // SECONDO
  { section: 'SECONDO', name: 'Petto di pollo alla griglia',       price: 11.00, foodCost: 4.00  }, // 🟡 43.6%
  { section: 'SECONDO', name: 'Cotoletta alla milanese',           price: 13.00, foodCost: 6.50  }, // 🟠 30.0%
  { section: 'SECONDO', name: 'Filetto al pepe verde',             price: 24.00, foodCost: 15.60 }, // 🔴 15.0%
  { section: 'SECONDO', name: 'Tagliata di manzo',                 price: 18.00, foodCost: 12.60 }, // 🔴 10.0%
  { section: 'SECONDO', name: 'Ossobuco alla milanese',            price: 16.00, foodCost: 11.20 }, // 🔴 10.0%
  { section: 'SECONDO', name: 'Grigliata mista di pesce',          price: 22.00, foodCost: 15.40 }, // 🔴 10.0%
  { section: 'SECONDO', name: 'Branzino al forno',                 price: 16.00, foodCost: 9.20  },
  { section: 'SECONDO', name: 'Coda di rospo in umido',            price: 18.00, foodCost: 10.80 },
  { section: 'SECONDO', name: 'Tacchino ripieno',                  price: 15.00, foodCost: 9.00  },
  // DOLCE
  { section: 'DOLCE', name: 'Panna cotta',                         price: 5.00,  foodCost: 0.75  }, // 🟢 65.0%
  { section: 'DOLCE', name: 'Tortino al cioccolato',               price: 6.50,  foodCost: 1.30  }, // 🟢 60.0%
  { section: 'DOLCE', name: 'Tiramisu',                            price: 6.00,  foodCost: 1.05  }, // 🟢 62.5%
  { section: 'DOLCE', name: 'Panna cotta ai frutti di bosco',      price: 6.00,  foodCost: 1.20  },
  { section: 'DOLCE', name: 'Semifreddo al pistacchio',            price: 7.00,  foodCost: 2.10  },
  { section: 'DOLCE', name: 'Zabaione',                            price: 5.50,  foodCost: 1.10  },
  // BEVANDE
  { section: 'BEVANDE', name: 'Caffe espresso',                    price: 1.20,  foodCost: 0.12  }, // 🟢 70.0%
  { section: 'BEVANDE', name: 'Acqua minerale',                    price: 2.50,  foodCost: 0.30  }, // 🟢 68.0%
  { section: 'BEVANDE', name: 'Coca-Cola',                         price: 3.00,  foodCost: 0.50  }, // 🟢 63.3%
  { section: 'BEVANDE', name: 'Calice vino della casa',            price: 4.50,  foodCost: 1.10  }, // 🟡 55.6%
  { section: 'BEVANDE', name: 'Birra media alla spina',            price: 5.00,  foodCost: 1.60  }, // 🟡 48.0%
  { section: 'BEVANDE', name: 'Bottiglia vino Chianti',            price: 18.00, foodCost: 7.00  }, // 🟡 41.1%
  { section: 'BEVANDE', name: 'Prosecco calice',                   price: 6.50,  foodCost: 2.00  },
  { section: 'BEVANDE', name: 'Vino bianco calice',                price: 5.00,  foodCost: 1.40  },
  { section: 'BEVANDE', name: 'Grappa',                            price: 4.00,  foodCost: 1.50  },
  { section: 'BEVANDE', name: 'Amaro',                             price: 3.50,  foodCost: 1.20  },
  { section: 'BEVANDE', name: 'Limoncello',                        price: 4.50,  foodCost: 1.50  },
  { section: 'BEVANDE', name: 'Espresso doppio',                   price: 2.00,  foodCost: 0.20  },
  { section: 'BEVANDE', name: 'Cappuccino',                        price: 3.00,  foodCost: 0.60  },
  { section: 'BEVANDE', name: 'Smoothie frutta',                   price: 5.50,  foodCost: 1.80  },
];
// TOT=47 piatti (26 originali + 21 nuovi)

export async function seedDemoData() {
  const now = new Date().toISOString();

  const ingredients = DEMO_INGREDIENTS_SPEC.map(ing => ({
    id:             `demo_ing_${ing.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
    name:           ing.name,
    unit:           ing.unit,
    price:          ing.price_per_unit,
    price_per_unit: ing.price_per_unit,
    waste:          ing.waste,
    allergens:      [],
    _isPrep:        false,
    updated_at:     now,
  }));

  const fixedCosts = DEMO_FIXED_COSTS_SPEC.map(fc => ({
    id:             `demo_fc_${fc.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
    name:           fc.name,
    type:           fc.category,
    amount_monthly: fc.amount_monthly,
    note:           '',
    updated_at:     now,
  }));

  const estimatedRevenue = 46000;
  const totalFixed = fixedCosts.reduce((s, c) => s + c.amount_monthly, 0); // 15780
  const ratio = calcFixedCostRatio(totalFixed, estimatedRevenue);           // ~0.343 esatto, mai hardcodato

  const getComponentsForDish = (dishName) => {
    const mapping = {
      'Bruschetta al pomodoro': [
        { ingName: 'Farina 00', qty: 100, unit: 'g' },
        { ingName: 'Pomodori pelati', qty: 150, unit: 'g' },
        { ingName: 'Aglio', qty: 8, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 20, unit: 'ml' },
        { ingName: 'Basilico fresco', qty: 2, unit: 'g' },
      ],
      'Insalata caprese': [
        { ingName: 'Pomodori pelati', qty: 120, unit: 'g' },
        { ingName: 'Mozzarella fior di latte', qty: 150, unit: 'g' },
        { ingName: 'Basilico fresco', qty: 5, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 25, unit: 'ml' },
      ],
      'Tagliere di salumi': [
        { ingName: 'Salumi misti', qty: 200, unit: 'g' },
      ],
      'Frittura di calamari': [
        { ingName: 'Calamari', qty: 300, unit: 'g' },
        { ingName: 'Pangrattato', qty: 150, unit: 'g' },
        { ingName: 'Olio per friggere', qty: 150, unit: 'ml' },
        { ingName: 'Aglio', qty: 10, unit: 'g' },
      ],
      'Focaccia con rosmarino': [
        { ingName: 'Farina 00', qty: 200, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 15, unit: 'ml' },
      ],
      'Burrata con pomodorini': [
        { ingName: 'Mozzarella fior di latte', qty: 180, unit: 'g' },
        { ingName: 'Pomodori pelati', qty: 100, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 30, unit: 'ml' },
      ],
      'Carpaccio di manzo': [
        { ingName: 'Filetto di manzo', qty: 250, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 25, unit: 'ml' },
      ],
      'Panettone salato': [
        { ingName: 'Farina 00', qty: 250, unit: 'g' },
        { ingName: 'Uova', qty: 1, unit: 'pz' },
        { ingName: 'Burro', qty: 50, unit: 'g' },
      ],
      'Spaghetti aglio olio e peperoncino': [
        { ingName: 'Pasta di semola', qty: 100, unit: 'g' },
        { ingName: 'Aglio', qty: 15, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 30, unit: 'ml' },
      ],
      'Spaghetti al pomodoro': [
        { ingName: 'Pasta di semola', qty: 100, unit: 'g' },
        { ingName: 'Pomodori pelati', qty: 150, unit: 'g' },
        { ingName: 'Aglio', qty: 8, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 20, unit: 'ml' },
        { ingName: 'Basilico fresco', qty: 2, unit: 'g' },
      ],
      'Spaghetti alla carbonara': [
        { ingName: 'Pasta di semola', qty: 100, unit: 'g' },
        { ingName: 'Guanciale', qty: 100, unit: 'g' },
        { ingName: 'Uova', qty: 2, unit: 'pz' },
        { ingName: 'Pecorino Romano', qty: 40, unit: 'g' },
      ],
      'Lasagna alla bolognese': [
        { ingName: 'Pasta di semola', qty: 120, unit: 'g' },
        { ingName: 'Filetto di manzo', qty: 80, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 20, unit: 'ml' },
      ],
      'Risotto ai funghi porcini': [
        { ingName: 'Riso Carnaroli', qty: 150, unit: 'g' },
        { ingName: 'Funghi porcini', qty: 100, unit: 'g' },
        { ingName: 'Burro', qty: 40, unit: 'g' },
      ],
      'Pizza Margherita': [
        { ingName: 'Farina 00', qty: 300, unit: 'g' },
        { ingName: 'Pomodori pelati', qty: 100, unit: 'g' },
        { ingName: 'Mozzarella fior di latte', qty: 80, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 20, unit: 'ml' },
      ],
      'Pasta alle vongole': [
        { ingName: 'Pasta di semola', qty: 120, unit: 'g' },
        { ingName: 'Vongole veraci', qty: 250, unit: 'g' },
        { ingName: 'Aglio', qty: 10, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 30, unit: 'ml' },
      ],
      'Gnocchi al ragù': [
        { ingName: 'Patate', qty: 100, unit: 'g' },
        { ingName: 'Farina 00', qty: 50, unit: 'g' },
        { ingName: 'Filetto di manzo', qty: 80, unit: 'g' },
      ],
      'Risotto al nero di seppia': [
        { ingName: 'Riso Carnaroli', qty: 150, unit: 'g' },
        { ingName: 'Calamari', qty: 80, unit: 'g' },
        { ingName: 'Burro', qty: 35, unit: 'g' },
      ],
      'Pappardelle al cinghiale': [
        { ingName: 'Pasta di semola', qty: 130, unit: 'g' },
        { ingName: 'Filetto di manzo', qty: 120, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 25, unit: 'ml' },
      ],
      'Petto di pollo alla griglia': [
        { ingName: 'Petto di pollo', qty: 250, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 20, unit: 'ml' },
      ],
      'Cotoletta alla milanese': [
        { ingName: 'Petto di pollo', qty: 200, unit: 'g' },
        { ingName: 'Pangrattato', qty: 80, unit: 'g' },
        { ingName: 'Uova', qty: 1, unit: 'pz' },
        { ingName: 'Olio per friggere', qty: 80, unit: 'ml' },
      ],
      'Filetto al pepe verde': [
        { ingName: 'Filetto di manzo', qty: 350, unit: 'g' },
        { ingName: 'Burro', qty: 50, unit: 'g' },
      ],
      'Tagliata di manzo': [
        { ingName: 'Manzo controfiletto', qty: 400, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 25, unit: 'ml' },
      ],
      'Ossobuco alla milanese': [
        { ingName: 'Ossobuco di vitello', qty: 350, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 25, unit: 'ml' },
      ],
      'Grigliata mista di pesce': [
        { ingName: 'Pesce misto grigliata', qty: 400, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 30, unit: 'ml' },
      ],
      'Branzino al forno': [
        { ingName: 'Pesce misto grigliata', qty: 350, unit: 'g' },
        { ingName: 'Olio extravergine oliva', qty: 20, unit: 'ml' },
        { ingName: 'Limoni', qty: 1, unit: 'pz' },
      ],
      'Coda di rospo in umido': [
        { ingName: 'Pesce misto grigliata', qty: 350, unit: 'g' },
        { ingName: 'Pomodori pelati', qty: 100, unit: 'g' },
      ],
      'Tacchino ripieno': [
        { ingName: 'Petto di pollo', qty: 300, unit: 'g' },
        { ingName: 'Burro', qty: 40, unit: 'g' },
      ],
      'Panna cotta': [
        { ingName: 'Panna fresca', qty: 150, unit: 'ml' },
        { ingName: 'Mascarpone', qty: 100, unit: 'g' },
      ],
      'Tortino al cioccolato': [
        { ingName: 'Farina 00', qty: 80, unit: 'g' },
        { ingName: 'Burro', qty: 80, unit: 'g' },
        { ingName: 'Uova', qty: 2, unit: 'pz' },
      ],
      'Tiramisu': [
        { ingName: 'Farina 00', qty: 100, unit: 'g' },
        { ingName: 'Mascarpone', qty: 150, unit: 'g' },
        { ingName: 'Uova', qty: 3, unit: 'pz' },
      ],
      'Panna cotta ai frutti di bosco': [
        { ingName: 'Panna fresca', qty: 180, unit: 'ml' },
        { ingName: 'Mascarpone', qty: 80, unit: 'g' },
      ],
      'Semifreddo al pistacchio': [
        { ingName: 'Panna fresca', qty: 200, unit: 'ml' },
        { ingName: 'Mascarpone', qty: 100, unit: 'g' },
        { ingName: 'Uova', qty: 2, unit: 'pz' },
      ],
      'Zabaione': [
        { ingName: 'Uova', qty: 6, unit: 'pz' },
        { ingName: 'Burro', qty: 20, unit: 'g' },
      ],
    };
    return mapping[dishName] || [];
  };

  const dishes = DEMO_DISHES_SPEC.map(spec => {
    const ingredientSpecs = getComponentsForDish(spec.name);
    const components = ingredientSpecs.map(comp => {
      const ing = ingredients.find(i => i.name === comp.ingName);
      return {
        type: 'ingredient',
        id: ing?.id || comp.ingName,
        quantity: comp.qty,
        unit: comp.unit,
      };
    });

    const derived = calcDishWithFixedCosts(spec.foodCost, spec.price, ratio);
    return {
      id:                  `demo_dish_${spec.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
      name:                spec.name,
      category:            spec.section,
      price:               spec.price,
      selling_price:       spec.price,
      food_cost:           parseFloat(spec.foodCost.toFixed(4)),
      isVisible:           true,
      isSpecial:           false,
      internalNotes:       '',
      ingredientUpdatedAt: now,
      updated_at:          now,
      components,
      ...derived,
    };
  });

  await dbSetAll('sections',     DEMO_SECTIONS);
  await dbSetAll('ingredients',  ingredients);
  await dbSetAll('fixed_costs',  fixedCosts);
  await dbSetAll('dishes',       dishes);
  await dbSetAll('preparations', []);
  await dbSetSetting('estimatedMonthlyRevenue', estimatedRevenue);

  console.log(
    `✅ Demo V13: ${ingredients.length} ingredienti, ${fixedCosts.length} costi fissi, ` +
    `${dishes.length} piatti · fissi totali: €${totalFixed} · ratio: ${(ratio * 100).toFixed(1)}%`
  );

  return { ingredients, fixedCosts, dishes, sections: DEMO_SECTIONS };
}
