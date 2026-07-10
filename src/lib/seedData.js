// src/lib/seedData.js — Dati di esempio per ristoranti italiani
import { saveToDB } from './db';

const uid = prefix => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

export const SEED_INGREDIENTS = [
  { name: 'Farina 00',              unit: 'kg',  price_per_unit: 1.20,  waste: 0,  allergens: ['gluten']              },
  { name: 'Olio Extra Vergine',      unit: 'L',   price_per_unit: 9.00,  waste: 0,  allergens: []                      },
  { name: 'Pomodori San Marzano',    unit: 'kg',  price_per_unit: 3.50,  waste: 8,  allergens: []                      },
  { name: 'Mozzarella di Bufala',    unit: 'kg',  price_per_unit: 12.00, waste: 0,  allergens: ['milk']                },
  { name: 'Basilico fresco',         unit: 'kg',  price_per_unit: 18.00, waste: 5,  allergens: []                      },
  { name: 'Parmigiano Reggiano',     unit: 'kg',  price_per_unit: 22.00, waste: 0,  allergens: ['milk']                },
  { name: 'Guanciale',               unit: 'kg',  price_per_unit: 16.00, waste: 5,  allergens: []                      },
  { name: 'Pecorino Romano',         unit: 'kg',  price_per_unit: 18.00, waste: 0,  allergens: ['milk']                },
  { name: 'Uova fresche',            unit: 'pz',  price_per_unit: 0.35,  waste: 5,  allergens: ['eggs']                },
  { name: 'Spaghetti',               unit: 'kg',  price_per_unit: 2.40,  waste: 0,  allergens: ['gluten']              },
  { name: 'Rigatoni',                unit: 'kg',  price_per_unit: 2.20,  waste: 0,  allergens: ['gluten']              },
  { name: 'Penne rigate',            unit: 'kg',  price_per_unit: 2.00,  waste: 0,  allergens: ['gluten']              },
  { name: 'Bistecca di manzo',       unit: 'kg',  price_per_unit: 28.00, waste: 8,  allergens: []                      },
  { name: 'Petto di pollo',          unit: 'kg',  price_per_unit: 10.00, waste: 5,  allergens: []                      },
  { name: 'Branzino intero',         unit: 'kg',  price_per_unit: 18.00, waste: 40, allergens: ['fish']                },
  { name: 'Salmone fresco',          unit: 'kg',  price_per_unit: 22.00, waste: 15, allergens: ['fish']                },
  { name: 'Gamberi',                 unit: 'kg',  price_per_unit: 20.00, waste: 30, allergens: ['shellfish']           },
  { name: 'Vino bianco secco',       unit: 'L',   price_per_unit: 4.00,  waste: 0,  allergens: ['sulphites']           },
  { name: 'Vino rosso',              unit: 'L',   price_per_unit: 5.00,  waste: 0,  allergens: ['sulphites']           },
  { name: 'Burro',                   unit: 'kg',  price_per_unit: 7.00,  waste: 0,  allergens: ['milk']                },
  { name: 'Aglio',                   unit: 'kg',  price_per_unit: 5.00,  waste: 20, allergens: []                      },
  { name: 'Cipolla dorata',          unit: 'kg',  price_per_unit: 1.80,  waste: 10, allergens: []                      },
  { name: 'Limone',                  unit: 'pz',  price_per_unit: 0.50,  waste: 5,  allergens: []                      },
  { name: 'Sale marino',             unit: 'kg',  price_per_unit: 0.80,  waste: 0,  allergens: []                      },
  { name: 'Pepe nero macinato',      unit: 'kg',  price_per_unit: 25.00, waste: 0,  allergens: []                      },
  { name: 'Zucchero semolato',       unit: 'kg',  price_per_unit: 1.00,  waste: 0,  allergens: []                      },
  { name: 'Cacao amaro in polvere',  unit: 'kg',  price_per_unit: 12.00, waste: 0,  allergens: []                      },
  { name: 'Caffè espresso (macinato)', unit: 'kg', price_per_unit: 22.00, waste: 0, allergens: []                      },
  { name: 'Panna fresca',            unit: 'L',   price_per_unit: 3.00,  waste: 0,  allergens: ['milk']                },
  { name: 'Savoiardi',               unit: 'kg',  price_per_unit: 4.50,  waste: 0,  allergens: ['gluten', 'eggs', 'milk'] },
  { name: 'Mascarpone',              unit: 'kg',  price_per_unit: 6.00,  waste: 0,  allergens: ['milk']                },
  { name: 'Prosciutto di Parma',     unit: 'kg',  price_per_unit: 35.00, waste: 0,  allergens: []                      },
  { name: 'Bresaola',                unit: 'kg',  price_per_unit: 32.00, waste: 0,  allergens: []                      },
  { name: 'Funghi porcini secchi',   unit: 'kg',  price_per_unit: 80.00, waste: 0,  allergens: []                      },
  { name: 'Tartufo nero grattugiato', unit: 'g',  price_per_unit: 2.50,  waste: 0,  allergens: []                      },
  { name: 'Pane casereccio',         unit: 'kg',  price_per_unit: 3.50,  waste: 5,  allergens: ['gluten']              },
  { name: 'Pomodorini ciliegino',    unit: 'kg',  price_per_unit: 4.00,  waste: 5,  allergens: []                      },
  { name: 'Rucola',                  unit: 'kg',  price_per_unit: 8.00,  waste: 10, allergens: []                      },
  { name: 'Pinoli',                  unit: 'kg',  price_per_unit: 45.00, waste: 0,  allergens: ['nuts']                },
  { name: 'Aceto balsamico di Modena', unit: 'L', price_per_unit: 12.00, waste: 0,  allergens: ['sulphites']           },
];

export const SEED_DISHES = [
  {
    name: 'Bruschetta al Pomodoro',    category: 'Antipasto',  price: 7.00,  food_cost: 1.50, allergens: ['gluten']
  },
  {
    name: 'Tagliere Salumi e Formaggi', category: 'Antipasto', price: 14.00, food_cost: 4.20, allergens: ['milk']
  },
  {
    name: 'Carpaccio di Bresaola',     category: 'Antipasto',  price: 12.00, food_cost: 3.80, allergens: []
  },
  {
    name: 'Spaghetti alla Carbonara',  category: 'Primo',      price: 14.00, food_cost: 3.20, allergens: ['gluten', 'eggs', 'milk']
  },
  {
    name: 'Rigatoni all\'Amatriciana', category: 'Primo',      price: 13.00, food_cost: 2.80, allergens: ['gluten', 'milk']
  },
  {
    name: 'Penne al Pesto Genovese',   category: 'Primo',      price: 12.00, food_cost: 2.40, allergens: ['gluten', 'milk', 'nuts']
  },
  {
    name: 'Tagliatelle ai Porcini',    category: 'Primo',      price: 16.00, food_cost: 4.50, allergens: ['gluten', 'eggs']
  },
  {
    name: 'Bistecca alla Griglia 250g', category: 'Secondo',   price: 28.00, food_cost: 8.50, allergens: []
  },
  {
    name: 'Petto di Pollo al Limone',  category: 'Secondo',    price: 16.00, food_cost: 3.80, allergens: []
  },
  {
    name: 'Branzino al Forno',         category: 'Secondo',    price: 22.00, food_cost: 7.00, allergens: ['fish']
  },
  {
    name: 'Salmone in Crosta di Sale', category: 'Secondo',    price: 24.00, food_cost: 7.80, allergens: ['fish']
  },
  {
    name: 'Tiramisù della Casa',       category: 'Dolce',      price: 7.00,  food_cost: 2.10, allergens: ['gluten', 'eggs', 'milk']
  },
  {
    name: 'Panna Cotta al Caramello',  category: 'Dolce',      price: 6.50,  food_cost: 1.60, allergens: ['milk']
  },
  {
    name: 'Caffè Espresso',            category: 'Bevande/Bar', price: 1.50, food_cost: 0.30, allergens: []
  },
  {
    name: 'Acqua Minerale 0.5L',       category: 'Bevande/Bar', price: 2.50, food_cost: 0.40, allergens: []
  },
];

export async function insertSeedData() {
  const now = new Date().toISOString();

  const ingredients = SEED_INGREDIENTS.map(raw => {
    const id = uid('ing');
    return {
      id,
      name:           raw.name,
      unit:           raw.unit,
      price:          raw.price_per_unit,
      price_per_unit: raw.price_per_unit,
      waste:          raw.waste,
      allergens:      raw.allergens,
      updated_at:     now,
    };
  });

  const dishes = SEED_DISHES.map(raw => {
    const fc  = raw.food_cost;
    const pr  = raw.price;
    const mgE = pr - fc;
    const mgP = pr > 0 ? (mgE / pr) * 100 : 0;
    const st  = mgP >= 70 ? 'top' : mgP >= 50 ? 'media' : 'risk';
    return {
      id:            uid('dish'),
      name:          raw.name,
      category:      raw.category,
      price:         pr,
      selling_price: pr,
      food_cost:     fc,
      margin_euro:   Math.round(mgE * 100) / 100,
      margin_pct:    Math.round(mgP * 10) / 10,
      status:        st,
      allergens:     raw.allergens || [],
      components:    [],
      updated_at:    now,
    };
  });

  // Salva su IndexedDB in parallelo
  await Promise.all([
    ...ingredients.map(i => saveToDB('ingredients', i)),
    ...dishes.map(d => saveToDB('dishes', d)),
  ]);

  return { ingredients, dishes };
}
