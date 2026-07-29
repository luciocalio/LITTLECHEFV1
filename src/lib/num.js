// ══════════════════════════════════════════════════════════════
//  LITTLECHEF · num — parsing numerico robusto (UN SOLO posto)
//  Accetta sia il punto che la virgola decimale (input italiano),
//  non tronca i decimali, ritorna 0 su valore non valido.
//  Usato per quantità e importi in tutta l'app.
// ══════════════════════════════════════════════════════════════

// Parse tollerante → number (0 se non valido). "0,03" e "0.03" → 0.03
export function toNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const n = parseFloat(String(v).trim().replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// Parse che preserva la stringa vuota (per i campi di input controllati):
// ritorna '' se vuoto, altrimenti il number parsato. Utile a distinguere
// "campo vuoto" da "zero".
export function toNumOrEmpty(v) {
  if (v === null || v === undefined || String(v).trim() === '') return '';
  return toNum(v);
}
