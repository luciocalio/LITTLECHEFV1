// ══════════════════════════════════════════════════════════════
//  LITTLECHEF · Config — valori regolabili in UN SOLO posto
// ══════════════════════════════════════════════════════════════

// Email dell'account PROPRIETARIO: l'unico che vede il bottone "Carica Dati
// Demo" (serve per le dimostrazioni dal vivo). NON è una misura di sicurezza —
// è solo per nascondere una funzione di comodità; le policy RLS restano la
// vera protezione dei dati. Il caso peggiore è che qualcuno riempia il PROPRIO
// account di dati demo.
export const OWNER_EMAIL = 'luciocalio8@gmail.com';

// Sezioni/categorie di default del menù — UN SOLO posto (usate da App per il
// seed iniziale, da MenuPage come fallback di visualizzazione, e da demoSeed).
// CONTORNO incluso (3A): insalate/patate hanno la loro categoria naturale.
export const DEFAULT_SECTIONS = [
  { id: 'sec_antipasto', name: 'ANTIPASTO', order: 0 },
  { id: 'sec_primo',     name: 'PRIMO',     order: 1 },
  { id: 'sec_secondo',   name: 'SECONDO',   order: 2 },
  { id: 'sec_contorno',  name: 'CONTORNO',  order: 3 },
  { id: 'sec_dolce',     name: 'DOLCE',     order: 4 },
  { id: 'sec_bevande',   name: 'BEVANDE',   order: 5 },
];

// Limite messaggi Sous Chef per ristorante al giorno (reset mezzanotte Europe/Rome)
export const DAILY_MESSAGE_LIMIT = 100;

// Prezzo massimo plausibile per un piatto (blocca inserimenti assurdi)
export const MAX_DISH_PRICE = 500;

// Prezzo massimo plausibile per un ingrediente/preparazione (€/unità)
export const MAX_INGREDIENT_PRICE = 1000;
