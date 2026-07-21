# LittleChef V9 — Sous Chef AI — Session Continuation

## Contesto
Progetto: **LittleChef**, gestionale food-cost per ristoranti (React 18 + Vite 5,
JavaScript puro, IndexedDB come storage locale). Repo git già collegato e pushato:
- Path locale: `C:\Users\pc-evo\Downloads\littlechef\LITTLECHEFV1`
- Remote: `https://github.com/luciocalio/LITTLECHEFV1.git`, branch `main`
- Ultimo commit pushato: `86c30d7` — working tree pulito (solo `.claude/` untracked,
  cartella di config locale del preview server, non ancora deciso se versionarla)

L'utente lavora in italiano, si aspetta verifiche concrete (non solo "dovrebbe
funzionare") — vedi sezione Known Issues per il pattern di test che ha richiesto.

**Confermato dall'utente: il prossimo lavoro è una continuazione di LittleChef**
(non un progetto separato) — probabilmente completamento ROLE 4/5 del piano V9 o
nuove feature sullo stesso codebase.

## Decisioni & Architettura (locked)
- **calcEngine.js**: formula di conversione unità `(toBase(qty, unitFrom) / toBase(1, unitTo)) * price`
  — divisione, mai moltiplicazione. `calcDishWithFixedCosts(ingredientsCost, sellingPrice, fixedCostRatio)`
  ritorna `{fixedCostOnDish, totalCost, grossMargin, marginPct}`.
- **fixedCostRatio** = totale costi fissi mensili / ricavo mensile stimato, mai hardcodato
  tranne un fallback `0.343` lasciato in `ChatPage.jsx` per i tool handler (da rivedere:
  idealmente andrebbe passato come prop invece che ricalcolato localmente).
- **Sous Chef** (`src/components/chat/ChatPage.jsx`) usa **native Anthropic tool calling**
  (parametro `tools`, non JSON parsing manuale) con agentic loop while-based.
- **4 tool implementati**: `get_critical_dishes`, `get_dish_details`, `update_dish_price`,
  `get_most_profitable_dish` — TUTTI leggono fresco da IndexedDB (`getAllFromDB('dishes')`)
  a ogni invocazione, MAI da variabili React catturate in closure.
- **IndexedDB** (`src/lib/db.js`): `DB_NAME='littlechef_v1'`, store `dishes` con `keyPath:'id'`.
  `saveToDB()` fa `put()` su singolo record con `tx.oncomplete` awaited (pattern corretto,
  non full-array overwrite).
- **.env.local** contiene `VITE_ANTHROPIC_API_KEY` valida e funzionante (confermato con
  test end-to-end reali, non mockati).

## Stato Attuale — Cosa È Stato Fatto
Piano originale in 5 ROLE (V9 master prompt):
- ✅ **ROLE 1 AUDITOR**: schema verificato, `components[]` array pronto per ingredienti reali
- ✅ **ROLE 2 DATA ENGINEER**: tutti i 47 piatti demo popolati con ingredienti reali e quantità
  (`src/lib/demoSeed.js`, funzione `getComponentsForDish()`)
- ✅ **ROLE 3 BACKEND ENGINEER**: tool calling nativo implementato e **tre bug critici
  risolti dopo test end-to-end reali**:
  1. Il testo finale della chat veniva letto dal turno sbagliato del loop agentico
     (dal primo turno con tool_use invece che dall'ultimo turno solo-testo) → risposte
     vuote o troncate. Fix: estrae `finalText` solo quando `stop_reason !== 'tool_use'`.
  2. `saveToDB()` non era awaited prima di riportare successo → il tool_result mentiva.
     Fix: await + rilettura di verifica da DB prima di dichiarare successo.
  3. **(fix più recente, commit 86c30d7)** Aggiornamenti multipli in un solo turno
     (es. "sistema i prezzi di 3 piatti") si sovrascrivevano a vicenda nello stato React,
     perché ogni tool handler leggeva `dishes` da una variabile catturata UNA VOLTA
     all'inizio del turno. Fix: ogni handler ora fa `getAllFromDB()` fresco a ogni
     chiamata, e `setDishes` usa la forma funzionale `prev => ...` invece di un array
     stale, così chiamate parallele non si cancellano a vicenda.
- ⬜ **ROLE 4 FRONTEND ENGINEER** (MAI iniziato): loading indicator dedicato durante le
  chiamate tool (attualmente c'è solo il typing indicator generico), flash visivo sul
  piatto quando viene aggiornato da chat (es. su pagina Prodotti).
- ⬜ **ROLE 5 QA** (MAI fatto formalmente): checklist a 8 punti dal piano originale
  (build, ingredienti popolati, accuratezza colori, query piatti critici, update prezzo +
  verifica DB, calcolo redditività, persistenza seed demo, regression testing generale).

## 🔴 Alta priorità
- Chiedere all'utente il dettaglio esatto del "grosso lavoro" (confermato essere su
  LittleChef, ma non ancora specificato COSA nello specifico — feature nuova? ROLE 4/5?
  Refactoring? Va chiesto come primo messaggio della nuova sessione.)

## 🟡 Media priorità (probabile, se si riprende il piano V9)
- ROLE 4 (UX: loading indicator dedicato, flash visivo su update da chat) mai fatto
- ROLE 5 (QA checklist formale a 8 punti) mai fatto
- `fixedCostRatio = 0.343` hardcodato in `ChatPage.jsx` come fallback — andrebbe passato
  come prop/context invece che duplicato

## 🟢 Bassa priorità
- Decidere se versionare `.claude/launch.json` (config preview server, oggi untracked)
- `src/components/foodcost/FoodCostPage.jsx` letto in passato ma non toccato in questa
  sessione — verificare se serve allinearlo alle stesse logiche fresh-read se anche lì
  ci sono chiamate multiple concorrenti a IndexedDB
- Questo file (`SESSION_CONTINUITY.md`) è untracked — cancellalo o aggiungilo a
  `.gitignore` quando non serve più

## Known Issues / Note tecniche
- **Automazione browser (Claude Browser tool)**: `form_input` NON innesca in modo
  affidabile l'evento React `onChange` su questo progetto — il bottone invio restava
  disabilitato pur con testo "impostato". Workaround verificato: usare il setter nativo
  DOM + `dispatchEvent(new Event('input', {bubbles:true}))` via `javascript_tool`, poi
  `button.click()` via JS anziché coordinate. Utile saperlo per QUALSIASI test futuro
  della chat via browser automation.
- **screenshot/zoom del Browser tool**: a volte va in timeout su questo progetto senza
  motivo apparente; `get_page_text` e `javascript_tool` restano affidabili come fallback.
- **`.env.local`**: NON toccare a meno che l'utente non fornisca esplicitamente una nuova
  chiave — l'utente è stato molto chiaro su questo in passato dopo un fix mirato.
- **`node_modules` era tracciato in git** (bug storico, causava diff da -30000 righe a
  ogni riavvio del dev server) — risolto nel commit `3d45b1d`, ora è in `.gitignore`
  (ASCII puro, il file originale era in UTF-16LE e non funzionava).
- Verificato con test reali (non solo "build passa"): aggiornamento simultaneo di 3 piatti
  diversi via chat, con controllo diretto di IndexedDB (non solo la risposta della chat)
  — tutti e 3 persistiti correttamente, nessuno sovrascritto.

## Preferenze di collaborazione dell'utente
- Vuole **verifica reale con i propri occhi**, non affermazioni di "risolto" senza prova:
  ha richiesto esplicitamente test con Chrome DevTools → IndexedDB aperto, non fidarsi
  della sola risposta in chat.
- Quando dà un bug fix mirato, elenca passi numerati con verifica ad ogni step prima di
  procedere al successivo — rispettare questo formato se richiede fix simili in futuro.
- Fa commit e push solo quando esplicitamente richiesto, mai in autonomia.
- Messaggi in italiano, risposte concise, preferisce riepiloghi diretti a spiegazioni lunghe.

## File chiave da conoscere (nel repo, non serve incollarli — leggerli da disco)
- `src/components/chat/ChatPage.jsx` — Sous Chef, tool calling, agentic loop
- `src/lib/demoSeed.js` — 47 piatti demo con ingredienti popolati (V13 + V9 ingredients)
- `src/lib/calcEngine.js` — motore di calcolo food cost (V4.0, locked)
- `src/lib/db.js` — layer IndexedDB (`littlechef_v1`, versione 4)
- `.claude/launch.json` — config per avviare il dev server via preview tool (nome
  `littlechef-dev`, `npm run dev`, porta 5173)

## Prima domanda da fare all'utente nella nuova sessione
Qual è nello specifico il "grosso lavoro" su LittleChef che ha in mente? (nuova feature,
completamento ROLE 4/5, refactoring, altro?)
