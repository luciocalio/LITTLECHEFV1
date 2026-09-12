// src/components/chat/ChatPage.jsx
import { useState, useEffect, useRef } from 'react';
import { TopBar }   from '../layout/TopBar';
import { saveToDB, getAllFromDB } from '../../lib/dataService';
import { supabase } from '../../lib/supabase';
import { DAILY_MESSAGE_LIMIT, DEFAULT_VAT_RATE } from '../../lib/config';
import { calcDishFoodCost, calcMargin, calcDishWithFixedCosts, calcNetRevenue, getUnitCategory } from '../../lib/calcEngine';
import { toNum } from '../../lib/num';
import { detectAllergens } from '../../lib/allergens';

// La chiave Anthropic vive lato server (funzione /api/chat), mai nel bundle.

const QUICK_REPLIES = [
  { label: '🔄 Aggiorna prezzo ingredienti', prompt: 'Voglio aggiornare il prezzo di un ingrediente' },
  { label: '➕ Aggiungi prodotto',            prompt: 'Voglio aggiungere un nuovo prodotto al menù'  },
  { label: '💰 Cambia costo fisso',           prompt: 'Voglio modificare un costo fisso'             },
  { label: '📊 Controlla margini',            prompt: 'Analizza i margini dei miei prodotti'         },
];

// ── Markdown leggero per i messaggi del Sous Chef (fix 2D) ──────────────
// Gestisce **grassetto**, elenchi "- ", intestazioni #, divisori --- e a capo.
// Costruisce nodi React (niente dangerouslySetInnerHTML → nessun rischio XSS).
function renderInline(text, kp) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    return m ? <strong key={`${kp}-${i}`}>{m[1]}</strong> : <span key={`${kp}-${i}`}>{p}</span>;
  });
}
function renderMarkdown(text) {
  if (!text) return null;
  const lines = String(text).split('\n');
  const blocks = [];
  let list = null;
  const flushList = key => { if (list) { blocks.push(<ul key={`ul-${key}`} style={{ margin: '4px 0', paddingLeft: 18 }}>{list}</ul>); list = null; } };
  lines.forEach((line, idx) => {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
    const rule = /^\s*-{3,}\s*$/.test(line);
    if (bullet) { (list ||= []).push(<li key={`li-${idx}`} style={{ marginBottom: 2 }}>{renderInline(bullet[1], `li${idx}`)}</li>); return; }
    flushList(idx);
    if (rule) { blocks.push(<div key={`hr-${idx}`} style={{ borderTop: '1px solid var(--border-color)', margin: '8px 0' }} />); return; }
    if (heading) { blocks.push(<div key={`h-${idx}`} style={{ fontWeight: 700, margin: '4px 0 2px' }}>{renderInline(heading[1], `h${idx}`)}</div>); return; }
    if (line.trim() === '') { blocks.push(<div key={`sp-${idx}`} style={{ height: 6 }} />); return; }
    blocks.push(<div key={`p-${idx}`}>{renderInline(line, `p${idx}`)}</div>);
  });
  flushList('end');
  return <>{blocks}</>;
}

// Etichette in italiano mostrate nell'indicatore dedicato mentre il Sous Chef
// sta effettivamente chiamando un tool (distinto dal generico "sta scrivendo").
const TOOL_LABELS = {
  get_critical_dishes:      '🔍 Controllo i piatti con margine basso...',
  get_dish_details:         '📋 Recupero i dettagli del piatto...',
  update_dish_price:        '💾 Aggiorno il prezzo e ricalcolo i margini...',
  get_most_profitable_dish: '🏆 Cerco il piatto più redditizio...',
  update_dish_ingredients:  '🧂 Modifico la ricetta e ricalcolo il food cost...',
  add_pantry_ingredient:    '🧺 Aggiungo l\'ingrediente in Dispensa...',
};

function welcomeMessage(name) {
  return {
    id:        crypto.randomUUID(),
    role:      'assistant',
    text:      `Ciao ${name || 'Chef'}, sono il tuo partner sotto copertura. Cosa posso fare per te oggi?`,
    time:      new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    isWelcome: true,
  };
}

export function ChatPage({
  currentPage, onNavigate, onOpenSettings,
  ingredients, setIngredients,
  preparations,
  dishes, setDishes,
  fixedCosts, setFixedCosts,
  fixedCostRatio = 0,
  restaurant,
  onDishUpdated,
  chatMessages, setChatMessages, // 2C: cronologia tenuta in App → sopravvive al cambio sezione
}) {
  const restaurantName = restaurant?.name ||
    localStorage.getItem('lc-restaurant-name') ||
    (() => { try { return JSON.parse(localStorage.getItem('lc-settings') || '{}').restaurantName || 'Chef'; } catch { return 'Chef'; } })();

  // La cronologia vive in App (stato sollevato). Qui usiamo quello stato;
  // fallback locale solo se, per qualche motivo, i prop non fossero passati.
  const [localMessages, setLocalMessages] = useState([]);
  const messages    = chatMessages    ?? localMessages;
  const setMessages = setChatMessages ?? setLocalMessages;

  // Seed del messaggio di benvenuto una sola volta (se la cronologia è vuota)
  useEffect(() => {
    if (messages.length === 0) setMessages([welcomeMessage(restaurantName)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [toolStatus, setToolStatus] = useState(null); // testo dedicato durante le chiamate tool
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function buildContext() {
    return {
      restaurantName,
      ingredients: (ingredients || []).slice(0, 30).map(i => ({
        id: i.id, name: i.name, price_per_unit: i.price_per_unit, unit: i.unit
      })),
      dishes: (dishes || []).slice(0, 20).map(d => ({
        id: d.id, name: d.name, selling_price: d.selling_price,
        food_cost: d.food_cost, status: d.status, category: d.category,
        // margini derivati già calcolati da App (dishesWithFixed): così il
        // Sous Chef cita numeri coerenti fin dalla prima risposta (fix 1D)
        marginPct: d.marginPct != null ? Number(d.marginPct).toFixed(1) : undefined,
        grossMarginEuro: d.grossMargin != null ? Number(d.grossMargin).toFixed(2) : undefined,
      })),
      fixedCosts: (fixedCosts || []).slice(0, 10).map(c => ({
        id: c.id, name: c.name, amount_monthly: c.amount_monthly
      })),
    };
  }
  async function applyActions(actions) {
    console.log('🔄 applyActions called with:', actions);
    
    if (!Array.isArray(actions) || actions.length === 0) {
      console.log('❌ Actions non è array o vuoto');
      return;
    }
  
    for (const action of actions) {
      console.log('📋 Processing action:', action.type, action);
  
      // ── UPDATE INGREDIENTE ──
      if (action.type === 'UPDATE_INGREDIENT_PRICE') {
        console.log('🔍 UPDATE_INGREDIENT_PRICE:', action);
        const nameToFind = action.ingredientName?.toLowerCase().trim();
        const newPrice = parseFloat(action.newPrice);
  
        if (!nameToFind || isNaN(newPrice)) {
          console.warn('❌ Dati incompleti:', action);
          continue;
        }
  
        const updated = ingredients.map(i =>
          i.name.toLowerCase().trim() === nameToFind
            ? { ...i, price_per_unit: newPrice, updated_at: new Date().toISOString() }
            : i
        );
  
        setIngredients(updated);
        const changed = updated.filter(i => i.name.toLowerCase().trim() === nameToFind);
        await Promise.all(changed.map(i => saveToDB('ingredients', i)));
        console.log('✅ INGREDIENTE AGGIORNATO:', nameToFind, '→ €' + newPrice);
      }
  
      // ── UPDATE COSTO FISSO ──
      if (action.type === 'UPDATE_FIXED_COST') {
        console.log('🔍 UPDATE_FIXED_COST:', action);
        const nameToFind = action.costName?.toLowerCase().trim();
        const newAmount = parseFloat(action.newAmount);
  
        if (!nameToFind || isNaN(newAmount)) {
          console.warn('❌ Dati incompleti:', action);
          continue;
        }
  
        const updated = fixedCosts.map(c =>
          c.name.toLowerCase().trim() === nameToFind
            ? { ...c, amount_monthly: newAmount, updated_at: new Date().toISOString() }
            : c
        );
  
        setFixedCosts(updated);
        const changed = updated.filter(c => c.name.toLowerCase().trim() === nameToFind);
        await Promise.all(changed.map(c => saveToDB('fixed_costs', c)));
        console.log('✅ COSTO FISSO AGGIORNATO:', nameToFind, '→ €' + newAmount);
      }

      // ── AGGIUNGERE COSTO FISSO ──
      if (action.type === 'ADD_FIXED_COST') {
        console.log('➕ ADD_FIXED_COST:', action);
        const newCost = {
          id:             crypto.randomUUID(),
          name:           action.costName,
          type:           action.costType || 'Altro',
          amount_monthly: parseFloat(action.amount),
          created_at:     new Date().toISOString(),
        };
        setFixedCosts(prev => [...prev, newCost]);
        await saveToDB('fixed_costs', newCost);
        console.log('✅ COSTO FISSO AGGIUNTO:', action.costName, '→ €' + action.amount);
      }

      // ── AGGIUNGERE PRODOTTO ──
      if (action.type === 'ADD_PRODUCT') {
        console.log('➕ ADD_PRODUCT:', action);
        // calcDishFoodCost e calcMargin sono importate staticamente in cima
        const foodCost = calcDishFoodCost(action.components || [], ingredients, preparations);
        const { marginEuro, marginPct, status } = calcMargin(action.sellingPrice, foodCost);
        const newProduct = {
          id:              crypto.randomUUID(),
          name:            action.productName,
          category:        action.category || 'Altro',
          selling_price:   parseFloat(action.sellingPrice),
          food_cost:       foodCost,
          margin_euro:     marginEuro,
          margin_pct:      marginPct,
          status,
          components:      action.components || [],
          updated_at:      new Date().toISOString(),
        };
        setDishes(prev => [...prev, newProduct]);
        await saveToDB('dishes', newProduct);
        console.log('✅ PRODOTTO AGGIUNTO:', action.productName, '→ €' + action.sellingPrice);
      }

      // ── MODIFICARE PRODOTTO ──
      if (action.type === 'UPDATE_PRODUCT') {
        console.log('🔄 UPDATE_PRODUCT:', action);
        // calcDishFoodCost e calcMargin sono importate staticamente in cima
        const foodCost = calcDishFoodCost(action.components || [], ingredients, preparations);
        const { marginEuro, marginPct, status } = calcMargin(action.sellingPrice, foodCost);
        const nameLC = action.productName?.toLowerCase();
        const updated = dishes.map(d =>
          d.name.toLowerCase() === nameLC
            ? {
                ...d,
                selling_price: parseFloat(action.sellingPrice),
                food_cost:     foodCost,
                margin_euro:   marginEuro,
                margin_pct:    marginPct,
                status,
                components:    action.components || d.components || [],
                updated_at:    new Date().toISOString(),
              }
            : d
        );
        setDishes(updated);
        await Promise.all(
          updated
            .filter(d => d.name.toLowerCase() === nameLC)
            .map(d => saveToDB('dishes', d))
        );
        console.log('✅ PRODOTTO AGGIORNATO:', action.productName, '→ €' + action.sellingPrice);
      }
    }
  }

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg = {
      id:   crypto.randomUUID(),
      role: 'user',
      text: trimmed,
      time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Limite giornaliero messaggi (contatore atomico su Supabase, reset a
    // mezzanotte Europe/Rome). Fail-open in caso di errore del contatore:
    // un glitch non deve mai bloccare la chat.
    try {
      const { data: gate, error: gateErr } = await supabase.rpc('increment_message_count', { p_limit: DAILY_MESSAGE_LIMIT });
      if (!gateErr && gate && gate.allowed === false && !gate.error) {
        setMessages(prev => [...prev, {
          id:   crypto.randomUUID(),
          role: 'assistant',
          text: `Hai raggiunto il limite di ${DAILY_MESSAGE_LIMIT} messaggi per oggi. Riprova domani — il conteggio si azzera a mezzanotte.`,
          time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        }]);
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn('[ChatPage] Contatore messaggi non disponibile, procedo:', e);
    }

    try {
      // fixedCostRatio arriva come prop da App (totale fissi / ricavi stimati),
      // mai più hardcodato: così update_dish_price ricalcola i margini reali.

      const systemPrompt = `Sei il Sous Chef AI di LittleChef, braccio destro di ${restaurantName}.
Sei un esperto di food cost, F&B management e ingegneria dei menù.
Rispondi SEMPRE in italiano, con tono professionale ma amichevole e diretto.
Ogni risposta deve essere orientata al profitto e ai margini.

DATI ATTUALI:
${JSON.stringify(buildContext(), null, 2)}

Hai accesso a questi TOOL per leggere e modificare i dati in tempo reale:
- get_critical_dishes: Piatti con margine < 20% (rossi, PROBLEMA!)
- get_dish_details: Info complete di un piatto
- update_dish_price: Cambia prezzo di vendita
- get_most_profitable_dish: Piatto più redditizio
- update_dish_ingredients: Aggiunge, rimuove o sostituisce un ingrediente/preparazione nella ricetta di un piatto (azioni "add" / "remove" / "replace")
- add_pantry_ingredient: Aggiunge un nuovo ingrediente in Dispensa (nome, prezzo, unità di misura)

QUANDO L'UTENTE CHIEDE:
1. "Quali piatti sono critici?" o "Margini bassi?" → usa get_critical_dishes
2. "Dettagli di [piatto]?" → usa get_dish_details
3. "Aumenta prezzo di [piatto]?" → usa update_dish_price
4. "Quale piatto è più redditizio?" → usa get_most_profitable_dish e riporta ESPLICITAMENTE ENTRAMBE le metriche: il piatto con margine PERCENTUALE più alto E il piatto con GUADAGNO ASSOLUTO in € per porzione più alto. Se sono piatti diversi, chiariscilo (un margine % alto può valere pochi centesimi se il piatto costa poco).
5. "Sostituisci [ingrediente A] con [ingrediente B] in [piatto]", "Aggiungi [ingrediente] a [piatto]", "Togli [ingrediente] da [piatto]" → usa update_dish_ingredients con action="replace"/"add"/"remove". Dopo la chiamata, conferma ESPLICITAMENTE cosa hai cambiato e il nuovo food cost/margine, leggendo SOLO i valori restituiti dal tool.
6. "Aggiungi [ingrediente] in dispensa/magazzino", oppure se update_dish_ingredients ti dice che un ingrediente non esiste in Dispensa e l'utente conferma di volerlo creare → usa add_pantry_ingredient.
7. SEMPRE rispondi in italiano con spiegazione, mai solo numeri

REGOLA SU update_dish_ingredients — QUANTITÀ (fondamentale, non derogabile):
- action="add": la quantità è OBBLIGATORIA. Se l'utente non l'ha specificata, NON chiamare il tool con un valore inventato: chiedi prima la quantità in chat e aspetta la risposta.
- action="replace": se l'utente non specifica la quantità del nuovo ingrediente, chiama comunque il tool SENZA il campo quantity — il tool manterrà automaticamente la stessa quantità dell'ingrediente sostituito (mai un valore a caso) e te lo confermerà nel risultato (quantityInherited: true). Riporta questo dato nella risposta all'utente.
- Se il tool restituisce needsQuantity oppure error, NON riprovare inventando un numero: rispondi in chat chiedendo l'informazione mancante.

REGOLA SU add_pantry_ingredient — PREZZO E UNITÀ (fondamentale, non derogabile): entrambi sono obbligatori. Se l'utente non specifica il prezzo, o l'unità di misura (kg/g/L/ml/pz...), NON chiamare il tool inventando un valore plausibile: chiedi prima le informazioni mancanti in chat. Se il tool restituisce needsInfo o error (es. ingrediente già esistente), non riprovare da solo: rispondi all'utente riportando il messaggio.

REGOLA SUI NUMERI (fondamentale): quando citi un numero (margine, prezzo, food cost, guadagno) usa SEMPRE il valore restituito dall'ultimo tool o dai DATI ATTUALI qui sopra, MAI un valore che avevi menzionato prima nella conversazione. Se in questo turno hai appena modificato un prezzo o una ricetta con update_dish_price/update_dish_ingredients, usa i nuovi valori restituiti dal tool, non quelli vecchi.

REGOLA SULL'IVA (fondamentale): il prezzo di un piatto è IVA inclusa (quello che il cliente paga). Margine, food cost % e status (Ottimo/Buono/Attenzione/Critico) NON si calcolano su quel prezzo pieno, ma sul ricavo netto — la parte che resta davvero al ristorante dopo l'IVA. I tool ti restituiscono già margini e status calcolati sul ricavo netto: usali così come sono. Se l'utente chiede perché un margine sembra più basso di quanto si aspettasse, spiega che il calcolo tiene conto dell'IVA versata allo Stato, non è un errore.

FORMATTAZIONE: puoi usare markdown semplice — **grassetto** per i valori chiave e elenchi puntati con "- ". Niente tabelle o intestazioni #.`;

      const tools = [
        {
          name: 'get_critical_dishes',
          description: 'Lista piatti con margine < 20% (status rosso). Serve per identificare i problemi.',
          input_schema: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'get_dish_details',
          description: 'Dettagli completi di un piatto: costo ingredienti, costi fissi, margini.',
          input_schema: {
            type: 'object',
            properties: { dishName: { type: 'string', description: 'Nome del piatto' } },
            required: ['dishName'],
          },
        },
        {
          name: 'update_dish_price',
          description: 'Modifica prezzo di vendita di un piatto. Ricalcola margini automaticamente.',
          input_schema: {
            type: 'object',
            properties: {
              dishName: { type: 'string' },
              newPrice: { type: 'number' },
            },
            required: ['dishName', 'newPrice'],
          },
        },
        {
          name: 'get_most_profitable_dish',
          description: 'Restituisce DUE piatti: quello con margine percentuale più alto e quello con guadagno assoluto (€/porzione) più alto. Usalo per rispondere "qual è il piatto più redditizio" mostrando entrambe le metriche.',
          input_schema: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'update_dish_ingredients',
          description: 'Aggiunge, rimuove o sostituisce un ingrediente/preparazione nella ricetta di un piatto. Ricalcola food cost e margini automaticamente dopo la modifica, leggendo i dati freschi da Supabase.',
          input_schema: {
            type: 'object',
            properties: {
              dishName: { type: 'string', description: 'Nome del piatto da modificare' },
              action: {
                type: 'string',
                enum: ['add', 'remove', 'replace'],
                description: 'add = aggiungi un nuovo ingrediente; remove = togli un ingrediente esistente; replace = sostituisci un ingrediente con un altro',
              },
              ingredientName: { type: 'string', description: 'Nome ingrediente/preparazione — richiesto per action="add" e action="remove"' },
              oldIngredientName: { type: 'string', description: 'Nome dell\'ingrediente da sostituire — richiesto per action="replace"' },
              newIngredientName: { type: 'string', description: 'Nome del nuovo ingrediente che lo sostituisce — richiesto per action="replace"' },
              quantity: {
                type: 'number',
                description: 'Quantità del nuovo ingrediente, nell\'unità indicata in "unit". Per action="add" è OBBLIGATORIA: se non la conosci, NON chiamare il tool, chiedila prima all\'utente. Per action="replace" è opzionale: se omessa il tool mantiene automaticamente la quantità dell\'ingrediente sostituito.',
              },
              unit: { type: 'string', description: 'Unità di misura (g, kg, ml, L, pz, porzione, fetta...). Opzionale: se omessa si usa l\'unità base dell\'ingrediente in Dispensa, o quella dell\'ingrediente sostituito se compatibile (per action="replace").' },
            },
            required: ['dishName', 'action'],
          },
        },
        {
          name: 'add_pantry_ingredient',
          description: 'Aggiunge un nuovo ingrediente in Dispensa con nome, prezzo e unità di misura.',
          input_schema: {
            type: 'object',
            properties: {
              ingredientName: { type: 'string', description: 'Nome del nuovo ingrediente' },
              price: { type: 'number', description: 'Prezzo per l\'unità di misura indicata (es. €/kg). OBBLIGATORIO: se non lo conosci, NON chiamare il tool, chiedilo prima all\'utente.' },
              unit: { type: 'string', enum: ['kg', 'g', 'dag', 'L', 'dl', 'cl', 'ml', 'pz', 'porzione', 'fetta'], description: 'Unità di misura. OBBLIGATORIA: se l\'utente non la specifica, NON dedurla da solo, chiedila prima.' },
            },
            required: ['ingredientName', 'price', 'unit'],
          },
        },
      ];

      // Tool execution handlers — OGNI handler legge da IndexedDB fresco,
      // MAI dalla variabile `dishes` catturata all'inizio del turno. Questo
      // evita che chiamate multiple nello stesso turno (es. update_dish_price
      // eseguite in parallelo da Promise.all) si basino sulla stessa
      // fotografia iniziale e si sovrascrivano a vicenda.
      // I margini (marginPct, grossMargin, totalCost, fixedCostOnDish) sono
      // campi DERIVATI e NON salvati nel DB: vanno ricalcolati sui dati freschi,
      // altrimenti risulterebbero sempre 0 e i numeri citati dal Sous Chef
      // sarebbero incoerenti (fix 1D). Stessa formula usata da update_dish_price.
      // vatRate: aliquota del ristorante loggato (Stage 10, Punto 1). Il prezzo
      // che l'utente vede/inserisce resta IVA inclusa — margine e food cost %
      // si calcolano SEMPRE sul ricavo netto, mai sul prezzo pieno.
      const vatRate = restaurant?.vat_rate ?? DEFAULT_VAT_RATE;
      const enrichDish = d => {
        const price = d.selling_price || d.price || 0;
        const netRevenue = calcNetRevenue(price, vatRate);
        return { ...d, ...calcDishWithFixedCosts(d.food_cost || 0, netRevenue, fixedCostRatio), netRevenue, vatRate };
      };

      const executeTool = async (toolName, toolInput) => {
        if (toolName === 'get_critical_dishes') {
          const freshDishes = (await getAllFromDB('dishes')).map(enrichDish);
          const critical = freshDishes.filter(d => (d.marginPct || 0) < 20);
          return JSON.stringify({
            count: critical.length,
            dishes: critical.map(d => ({
              name: d.name,
              price: d.selling_price,
              foodCost: d.food_cost,
              marginPct: (d.marginPct || 0).toFixed(1),
            })),
          });
        }
        if (toolName === 'get_dish_details') {
          const freshDishes = (await getAllFromDB('dishes')).map(enrichDish);
          const dish = freshDishes.find(d => d.name?.toLowerCase() === toolInput.dishName?.toLowerCase());
          if (!dish) return JSON.stringify({ error: `Piatto "${toolInput.dishName}" non trovato` });
          return JSON.stringify({
            name: dish.name,
            price: dish.selling_price || dish.price,
            vatRatePct: dish.vatRate,
            netRevenue: (dish.netRevenue || 0).toFixed(2),
            foodCost: dish.food_cost,
            fixedCostOnDish: (dish.fixedCostOnDish || 0).toFixed(2),
            totalCost: (dish.totalCost || 0).toFixed(2),
            grossMargin: (dish.grossMargin || 0).toFixed(2),
            marginPct: (dish.marginPct || 0).toFixed(1),
          });
        }
        if (toolName === 'update_dish_price') {
          const newPrice = parseFloat(toolInput.newPrice);
          if (isNaN(newPrice) || newPrice <= 0) {
            return JSON.stringify({ error: 'Prezzo non valido' });
          }

          // (a) Lettura FRESCA del singolo piatto direttamente da IndexedDB,
          // in questo preciso momento — mai dalla variabile `dishes` esterna.
          const freshRaw = await getAllFromDB('dishes');
          const rawDish = freshRaw.find(d => d.name?.toLowerCase() === toolInput.dishName?.toLowerCase());
          if (!rawDish) return JSON.stringify({ error: `Piatto "${toolInput.dishName}" non trovato` });
          const dish = enrichDish(rawDish); // margine vecchio calcolato, non da campo inesistente

          const oldPrice = dish.selling_price || dish.price;
          const oldMarginPct = dish.marginPct;

          // (b) Modifica applicata SOLO al piatto richiesto da questa chiamata.
          // newPrice è IVA inclusa (come da input utente/UI) — il margine si
          // calcola sul ricavo netto (Stage 10, Punto 1).
          const newNetRevenue = calcNetRevenue(newPrice, vatRate);
          const updated = {
            ...dish,
            selling_price: newPrice,
            price: newPrice,
            ...calcDishWithFixedCosts(dish.food_cost || 0, newNetRevenue, fixedCostRatio),
            netRevenue: newNetRevenue,
            updated_at: new Date().toISOString(),
          };

          // (c) Scrittura del SOLO record modificato (put su singolo oggetto,
          // mai sull'intero array) e attesa del completamento reale della
          // transazione — saveToDB() già usa tx.oncomplete, non solo put().
          await saveToDB('dishes', updated);

          // (d) Rilettura da IndexedDB per confermare che il valore scritto
          // sia davvero quello atteso
          const verifyDishes = await getAllFromDB('dishes');
          const verifyFromDB = verifyDishes.find(d => d.id === updated.id);

          if (!verifyFromDB || verifyFromDB.selling_price !== newPrice) {
            return JSON.stringify({ error: 'Errore: la scrittura su IndexedDB non è riuscita' });
          }

          // Aggiorna lo stato React con update funzionale (basato sullo stato
          // precedente reale, non su una copia stale), così chiamate multiple
          // in sequenza non si sovrascrivono a vicenda anche nella UI.
          setDishes(prev => prev.map(d => d.id === verifyFromDB.id ? verifyFromDB : d));

          // Segnala all'app che questo piatto è stato appena aggiornato, così
          // la pagina Prodotti può mostrare un flash visivo quando l'utente
          // ci naviga (le due pagine non sono mai montate insieme).
          onDishUpdated?.(verifyFromDB.id);

          // (e) Solo ora, con la scrittura verificata, si ritorna successo
          return JSON.stringify({
            success: true,
            oldPrice: oldPrice.toFixed(2),
            newPrice: newPrice.toFixed(2),
            newNetRevenue: newNetRevenue.toFixed(2),
            vatRatePct: vatRate,
            oldMarginPct: (oldMarginPct || 0).toFixed(1),
            newMarginPct: (updated.marginPct || 0).toFixed(1),
          });
        }
        if (toolName === 'update_dish_ingredients') {
          const action = toolInput.action;
          if (!['add', 'remove', 'replace'].includes(action)) {
            return JSON.stringify({ error: 'Azione non valida: usa "add", "remove" o "replace".' });
          }

          // (a) Lettura FRESCA di piatto e dispensa in questo preciso momento —
          // mai da `dishes`/`ingredients`/`preparations` catturati all'inizio del turno.
          const [freshDishesAll, freshIngredients, freshPreparations] = await Promise.all([
            getAllFromDB('dishes'),
            getAllFromDB('ingredients'),
            getAllFromDB('preparations'),
          ]);
          const rawDish = freshDishesAll.find(d => d.name?.toLowerCase() === toolInput.dishName?.toLowerCase());
          if (!rawDish) return JSON.stringify({ error: `Piatto "${toolInput.dishName}" non trovato` });

          const pantryAll = [
            ...freshIngredients.map(p => ({ ...p, _type: 'ingredient' })),
            ...freshPreparations.map(p => ({ ...p, _type: 'preparation' })),
          ];
          const findPantryItem = name => {
            const q = (name || '').toLowerCase().trim();
            if (!q) return { item: null, ambiguous: false };
            const exact = pantryAll.filter(p => p.name?.toLowerCase() === q);
            if (exact.length === 1) return { item: exact[0], ambiguous: false };
            if (exact.length > 1) return { item: null, ambiguous: true, matches: exact };
            const partial = pantryAll.filter(p => p.name?.toLowerCase().includes(q));
            if (partial.length === 1) return { item: partial[0], ambiguous: false };
            if (partial.length > 1) return { item: null, ambiguous: true, matches: partial };
            return { item: null, ambiguous: false };
          };

          const components = Array.isArray(rawDish.components) ? [...rawDish.components] : [];
          const compPantry = c => pantryAll.find(p => p.id === (c.id_ref || c.id));
          const oldEnriched = enrichDish(rawDish);

          // Sceglie un'unità compatibile per CATEGORIA (peso/volume/pezzi) con
          // l'ingrediente di destinazione. Se quella proposta (esplicita o
          // ereditata) non è compatibile, ripiega sull'unità base dell'ingrediente
          // in Dispensa — mai un'unità incompatibile che farebbe collassare
          // silenziosamente il costo di quella riga a 0 (calcEngine.js).
          const safeUnit = (candidateUnit, targetItem) => {
            const targetCat = getUnitCategory(targetItem.unit);
            const candCat   = getUnitCategory(candidateUnit);
            return (candidateUnit && targetCat && candCat && targetCat === candCat) ? candidateUnit : targetItem.unit;
          };

          let newComponents = components;
          let summary = {};
          let expectedPresentId = null; // id_ref che DEVE comparire dopo la scrittura
          let expectedAbsentId  = null; // id_ref che NON deve più comparire dopo la scrittura

          if (action === 'remove') {
            if (!toolInput.ingredientName) return JSON.stringify({ error: 'Specifica quale ingrediente rimuovere.' });
            const idx = components.findIndex(c => compPantry(c)?.name?.toLowerCase() === toolInput.ingredientName.toLowerCase());
            if (idx === -1) return JSON.stringify({ error: `"${toolInput.ingredientName}" non è nella ricetta di "${rawDish.name}".` });
            const removed = compPantry(components[idx]);
            expectedAbsentId = components[idx].id_ref || components[idx].id;
            newComponents = components.filter((_, i) => i !== idx);
            summary = { action: 'remove', ingredient: removed?.name || toolInput.ingredientName };
          }

          if (action === 'add') {
            if (!toolInput.ingredientName) return JSON.stringify({ error: 'Specifica quale ingrediente aggiungere.' });
            const { item, ambiguous, matches } = findPantryItem(toolInput.ingredientName);
            if (ambiguous) return JSON.stringify({ error: `Più ingredienti corrispondono a "${toolInput.ingredientName}": ${matches.map(m => m.name).join(', ')}. Chiedi all'utente quale intende.` });
            if (!item) return JSON.stringify({ error: `"${toolInput.ingredientName}" non è in Dispensa. Va aggiunto lì prima di poterlo usare in una ricetta.` });
            if (components.some(c => (c.id_ref || c.id) === item.id)) {
              return JSON.stringify({ error: `"${item.name}" è già nella ricetta di "${rawDish.name}".` });
            }
            const qty = toNum(toolInput.quantity);
            if (!(qty > 0)) {
              return JSON.stringify({
                needsQuantity: true,
                message: `Serve la quantità di "${item.name}" da aggiungere a "${rawDish.name}" (es. "50 g"). Chiedila all'utente, non inventarla.`,
              });
            }
            const unit = safeUnit(toolInput.unit, item);
            newComponents = [...components, {
              id: crypto.randomUUID(), type: item._type, id_ref: item.id,
              name: item.name, qty, quantity: qty, unit,
            }];
            expectedPresentId = item.id;
            summary = { action: 'add', ingredient: item.name, quantity: qty, unit };
          }

          if (action === 'replace') {
            if (!toolInput.oldIngredientName || !toolInput.newIngredientName) {
              return JSON.stringify({ error: 'Specifica sia l\'ingrediente da sostituire sia quello nuovo.' });
            }
            const idx = components.findIndex(c => compPantry(c)?.name?.toLowerCase() === toolInput.oldIngredientName.toLowerCase());
            if (idx === -1) return JSON.stringify({ error: `"${toolInput.oldIngredientName}" non è nella ricetta di "${rawDish.name}".` });
            const oldComp = components[idx];
            const oldItem = compPantry(oldComp);

            const { item: newItem, ambiguous, matches } = findPantryItem(toolInput.newIngredientName);
            if (ambiguous) return JSON.stringify({ error: `Più ingredienti corrispondono a "${toolInput.newIngredientName}": ${matches.map(m => m.name).join(', ')}. Chiedi all'utente quale intende.` });
            if (!newItem) return JSON.stringify({ error: `"${toolInput.newIngredientName}" non è in Dispensa. Va aggiunto lì prima di poterlo usare in una ricetta.` });

            // Quantità: se specificata la usiamo; altrimenti MANTENIAMO quella
            // dell'ingrediente sostituito (comportamento scelto per il caso
            // grana→pecorino) — mai un valore inventato.
            let qty = toNum(toolInput.quantity);
            let inheritedQty = false;
            if (!(qty > 0)) {
              qty = toNum(oldComp.qty ?? oldComp.quantity);
              inheritedQty = true;
            }
            // Unità: quella esplicita se compatibile, altrimenti quella
            // ereditata dal vecchio ingrediente se compatibile, altrimenti
            // l'unità base del nuovo ingrediente (mai una incompatibile).
            const oldUnit = oldComp.unit || oldItem?.unit;
            const unit = toolInput.unit ? safeUnit(toolInput.unit, newItem) : safeUnit(oldUnit, newItem);

            expectedAbsentId  = oldComp.id_ref || oldComp.id;
            expectedPresentId = newItem.id;
            newComponents = components.map((c, i) => i === idx ? {
              id: crypto.randomUUID(), type: newItem._type, id_ref: newItem.id,
              name: newItem.name, qty, quantity: qty, unit,
            } : c);
            summary = {
              action: 'replace', oldIngredient: oldItem?.name || toolInput.oldIngredientName,
              newIngredient: newItem.name, quantity: qty, unit, quantityInherited: inheritedQty,
            };
          }

          // (b) Ricalcolo food cost/margini con lo stesso calcEngine, sui dati freschi
          const cleanComps = newComponents.filter(c => c.id_ref && toNum(c.qty) > 0);
          const calculatedFoodCost = calcDishFoodCost(
            cleanComps.map(c => ({ type: c.type, id: c.id_ref, quantity: toNum(c.qty), unit: c.unit })),
            freshIngredients, freshPreparations
          );
          const price = rawDish.selling_price || rawDish.price || 0;
          // price è IVA inclusa — margine/status persistiti si calcolano sul
          // ricavo netto (Stage 10, Punto 1), stessa regola di tutto il resto dell'app.
          const netRevenueForSave = calcNetRevenue(price, vatRate);
          const { marginEuro: me, marginPct: mp, status: st } = calcMargin(netRevenueForSave, calculatedFoodCost);

          const updatedDish = {
            ...rawDish,
            components: cleanComps,
            food_cost: calculatedFoodCost,
            margin_euro: me,
            margin_pct: mp,
            status: st,
            ingredientUpdatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          // (c) Scrittura del SOLO piatto modificato. restaurant_id è impostato
          // da saveToDB() in base al ristorante dell'utente loggato (getRestaurantId()):
          // non può mai scrivere altrove, e le policy RLS lo impongono comunque
          // anche in caso di bug lato client.
          await saveToDB('dishes', updatedDish);

          // (d) Rilettura da Supabase per confermare che la scrittura sia
          // riuscita e che la ricetta contenga davvero la modifica attesa —
          // solo ORA si può dichiarare successo.
          const verifyDishes = await getAllFromDB('dishes');
          const verifyFromDB = verifyDishes.find(d => d.id === updatedDish.id);
          const verifyIdRefs = (verifyFromDB?.components || []).map(c => c.id_ref);
          const presentOk = !expectedPresentId || verifyIdRefs.includes(expectedPresentId);
          const absentOk  = !expectedAbsentId  || !verifyIdRefs.includes(expectedAbsentId);
          const verifyOk = !!verifyFromDB && Array.isArray(verifyFromDB.components) &&
            verifyFromDB.components.length === cleanComps.length &&
            presentOk && absentOk &&
            Math.abs((verifyFromDB.food_cost || 0) - calculatedFoodCost) < 0.0001;

          if (!verifyOk) {
            return JSON.stringify({ error: 'Errore: la scrittura della ricetta su Supabase non è riuscita o non corrisponde a quanto atteso.' });
          }

          setDishes(prev => prev.map(d => d.id === verifyFromDB.id ? verifyFromDB : d));
          onDishUpdated?.(verifyFromDB.id);

          // (e) Numeri riportati al Sous Chef: SEMPRE riletti dal DB dopo la
          // scrittura verificata, mai stimati a mente.
          const newEnriched = enrichDish(verifyFromDB);
          return JSON.stringify({
            success: true,
            ...summary,
            dishName: rawDish.name,
            oldFoodCost: (oldEnriched.food_cost || 0).toFixed(2),
            newFoodCost: (newEnriched.food_cost || 0).toFixed(2),
            oldMarginPct: (oldEnriched.marginPct || 0).toFixed(1),
            newMarginPct: (newEnriched.marginPct || 0).toFixed(1),
            sellingPrice: (newEnriched.selling_price || newEnriched.price || 0).toFixed(2),
            netRevenue: (newEnriched.netRevenue || 0).toFixed(2),
            vatRatePct: newEnriched.vatRate,
          });
        }
        if (toolName === 'add_pantry_ingredient') {
          const ingredientName = (toolInput.ingredientName || '').trim();
          if (!ingredientName) return JSON.stringify({ error: 'Specifica il nome dell\'ingrediente.' });

          const price = toNum(toolInput.price);
          if (!(price > 0)) {
            return JSON.stringify({
              needsInfo: true,
              message: `Serve il prezzo di "${ingredientName}" (es. "3,50 al kg"). Chiedilo all'utente, non inventarlo.`,
            });
          }
          const VALID_UNITS = ['kg', 'g', 'dag', 'L', 'dl', 'cl', 'ml', 'pz', 'porzione', 'fetta'];
          const unit = (toolInput.unit || '').trim();
          if (!VALID_UNITS.includes(unit)) {
            return JSON.stringify({
              needsInfo: true,
              message: `Serve l'unità di misura di "${ingredientName}" (kg, g, L, ml, pz...). Chiedila all'utente, non inventarla.`,
            });
          }

          // (a) Lettura FRESCA — evita di creare un duplicato se esiste già
          const freshIngredients = await getAllFromDB('ingredients');
          const existing = freshIngredients.find(i => i.name?.toLowerCase().trim() === ingredientName.toLowerCase());
          if (existing) {
            return JSON.stringify({
              error: `"${existing.name}" è già in Dispensa (€${(parseFloat(existing.price_per_unit ?? existing.price) || 0).toFixed(2)}/${existing.unit}). Per cambiarne il prezzo va modificato manualmente in Dispensa per ora.`,
            });
          }

          const newIngredient = {
            id:             `ing_${crypto.randomUUID()}`,
            name:           ingredientName,
            unit,
            price,
            price_per_unit: price,
            waste:          0,
            allergens:      detectAllergens(ingredientName),
            _isPrep:        false,
            updated_at:     new Date().toISOString(),
          };

          // (b) Scrittura — restaurant_id impostato da saveToDB() in base al
          // ristorante dell'utente loggato: non può mai scrivere altrove.
          await saveToDB('ingredients', newIngredient);

          // (c) Rilettura da Supabase per confermare che la scrittura sia
          // riuscita davvero — solo ORA si dichiara successo.
          const verifyIngredients = await getAllFromDB('ingredients');
          const verifyFromDB = verifyIngredients.find(i => i.id === newIngredient.id);
          if (!verifyFromDB || Number(verifyFromDB.price_per_unit) !== price) {
            return JSON.stringify({ error: 'Errore: la scrittura su Supabase non è riuscita.' });
          }

          setIngredients(prev => [...prev, verifyFromDB]);

          return JSON.stringify({
            success: true,
            ingredientName: verifyFromDB.name,
            price: (parseFloat(verifyFromDB.price_per_unit) || 0).toFixed(2),
            unit: verifyFromDB.unit,
          });
        }
        if (toolName === 'get_most_profitable_dish') {
          const freshDishes = (await getAllFromDB('dishes')).map(enrichDish);
          if (!freshDishes.length) return JSON.stringify({ error: 'Nessun piatto trovato' });
          // Due metriche diverse (fix TIER 4): margine % più alto E guadagno
          // assoluto €/porzione più alto — possono essere piatti diversi.
          const byPct = [...freshDishes].sort((a, b) => (b.marginPct || 0) - (a.marginPct || 0))[0];
          const byEuro = [...freshDishes].sort((a, b) => (b.grossMargin || 0) - (a.grossMargin || 0))[0];
          return JSON.stringify({
            note: 'Esistono due definizioni di "più redditizio": margine percentuale e guadagno assoluto per porzione. Riportale entrambe distinguendole.',
            highestMarginPct: {
              name: byPct.name,
              marginPct: (byPct.marginPct || 0).toFixed(1),
              grossMarginEuro: (byPct.grossMargin || 0).toFixed(2),
              price: byPct.selling_price || byPct.price,
            },
            highestAbsoluteProfit: {
              name: byEuro.name,
              grossMarginEuro: (byEuro.grossMargin || 0).toFixed(2),
              marginPct: (byEuro.marginPct || 0).toFixed(1),
              price: byEuro.selling_price || byEuro.price,
            },
            sameDish: byPct.name === byEuro.name,
          });
        }
        return JSON.stringify({ error: `Tool "${toolName}" sconosciuto` });
      };

      // Agentic loop — continua finché il modello non finisce
      let messages = [{ role: 'user', content: trimmed }];
      let continueLoop = true;
      let finalText = '';

      while (continueLoop) {
        // Chiamata alla funzione serverless: la chiave Anthropic sta lì,
        // il client non la vede mai. Il loop agentico resta qui.
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model:      'claude-sonnet-4-6',
            max_tokens: 2000,
            system:     systemPrompt,
            tools,
            messages,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Errore HTTP ${response.status}`);
        }

        const data = await response.json();
        const assistantContent = data.content || [];
        const stopReason = data.stop_reason;

        // Estrai tool uses e testo
        const toolUses = assistantContent.filter(c => c.type === 'tool_use');
        const textBlock = assistantContent.find(c => c.type === 'text');

        if (toolUses.length > 0 && stopReason === 'tool_use') {
          // Turno con tool uses — NON salvare il testo, continua il loop
          messages.push({ role: 'assistant', content: assistantContent });

          // Indicatore dedicato (sostituisce i puntini generici) finché non
          // arriva la risposta testuale finale — resta visibile anche
          // durante la chiamata successiva che genera la spiegazione.
          const labels = toolUses.map(t => TOOL_LABELS[t.name] || 'Sto elaborando...');
          setToolStatus(labels.length > 1 ? '🔧 Sto aggiornando più dati...' : labels[0]);

          // Esegui tool e raccogli risultati (awaited)
          const toolResults = await Promise.all(toolUses.map(async toolUse => ({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: await executeTool(toolUse.name, toolUse.input),
          })));

          messages.push({ role: 'user', content: toolResults });
          continueLoop = true;
        } else {
          // Fine del loop — salva SOLO il testo finale
          if (textBlock) finalText = textBlock.text;
          continueLoop = false;
          setToolStatus(null);
        }
      }

      setMessages(prev => [...prev, {
        id:   crypto.randomUUID(),
        role: 'assistant',
        text: finalText || 'Assistente pronto',
        time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      }]);

    } catch (err) {
      console.error('[ChatPage] Errore API:', err);
      setMessages(prev => [...prev, {
        id:   crypto.randomUUID(),
        role: 'assistant',
        text: `Errore: ${err.message || 'Qualcosa non ha funzionato. Controlla la connessione e riprova.'}`,
        time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setLoading(false);
      setToolStatus(null);
      inputRef.current?.focus();
    }
  }

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        '100dvh',
      maxHeight:     '100dvh',
      overflow:      'hidden',   // la pagina non scorre: solo l'area messaggi
      background:    'var(--bg-primary)',
    }}>
      {/* TOP BAR */}
      <TopBar
        currentPage={currentPage}
        onNavigate={onNavigate}
        onOpenSettings={onOpenSettings}
        restaurant={restaurant}
      />

      {/* HEADER CHAT */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '12px',
        padding:      '12px 20px',
        background:   'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'var(--gold)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', flexShrink: 0,
        }}>🤖</div>
        <div>
          <p style={{ margin: 0, fontWeight: '700', fontSize: '15px',
            fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}>
            Sous Chef
          </p>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--gold)' }}>● Online</p>
        </div>
      </div>

      {/* AREA MESSAGGI */}
      <div style={{
        flex:            1,
        minHeight:       0,          // consente all'area di rimpicciolirsi e attivare l'overflow in flex-column
        overflowY:       'auto',
        overscrollBehavior: 'contain', // lo scroll dei messaggi non "trascina" la pagina
        WebkitOverflowScrolling: 'touch',
        padding:         '16px',
        display:         'flex',
        flexDirection:   'column',
        gap:             '10px',
      }}>
        {messages.map(msg => (
          <div key={msg.id}>
            <div style={{
              display:        'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth:     '80%',
                padding:      '10px 14px',
                borderRadius: msg.role === 'user'
                  ? '18px 18px 4px 18px'
                  : '18px 18px 18px 4px',
                background:   msg.role === 'user'
                  ? 'var(--gold)'
                  : 'var(--bg-card)',
                color:        msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                fontSize:     '14px',
                lineHeight:   '1.5',
                boxShadow:    '0 1px 3px rgba(0,0,0,0.08)',
                border:       msg.role === 'user'
                  ? 'none'
                  : '1px solid var(--border-color)',
              }}>
                {msg.role === 'assistant' ? renderMarkdown(msg.text) : msg.text}
                <div style={{ fontSize: '10px', marginTop: '4px', textAlign: 'right', opacity: 0.6 }}>
                  {msg.time}
                </div>
              </div>
            </div>

            {/* QUICK REPLIES — solo dopo il messaggio di benvenuto */}
            {msg.isWelcome && (
              <div style={{
                display:   'flex',
                flexWrap:  'wrap',
                gap:       '8px',
                marginTop: '10px',
                paddingLeft: '4px',
              }}>
                {QUICK_REPLIES.map(qr => (
                  <button
                    key={qr.label}
                    onClick={() => sendMessage(qr.prompt)}
                    style={{
                      padding:      '8px 14px',
                      background:   'var(--bg-card)',
                      border:       '1px solid var(--gold)',
                      borderRadius: '20px',
                      color:        'var(--gold)',
                      fontSize:     '12px',
                      fontWeight:   '600',
                      cursor:       'pointer',
                      whiteSpace:   'nowrap',
                      minHeight:    '36px',
                      transition:   'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gold-light)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                  >
                    {qr.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* TYPING INDICATOR — puntini generici mentre pensa, testo dedicato durante i tool call */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: toolStatus ? '10px 16px' : '12px 16px',
              background: 'var(--bg-card)',
              borderRadius: '18px 18px 18px 4px',
              border: '1px solid var(--border-color)',
              display: 'flex', gap: '8px', alignItems: 'center',
            }}>
              {toolStatus ? (
                <>
                  <span style={{ fontSize: '14px', display: 'inline-block', animation: 'spin 1s linear infinite' }}>⚙️</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{toolStatus}</span>
                </>
              ) : (
                [0.0, 0.2, 0.4].map(delay => (
                  <div key={delay} style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: 'var(--text-muted)',
                    animation: `bounce 1s ${delay}s infinite`,
                  }} />
                ))
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* DISCLAIMER — discreto, sopra l'input */}
      <div style={{
        padding: '4px 16px 0', background: 'var(--bg-card)',
        fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4,
      }}>
        I suggerimenti del Sous Chef sono indicativi. La decisione finale resta sempre tua.
      </div>

      {/* INPUT BAR */}
      <div style={{
        padding:      '10px 16px',
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
        background:   'var(--bg-card)',
        borderTop:    '1px solid var(--border-color)',
        display:      'flex',
        gap:          '10px',
        alignItems:   'flex-end',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
          }}
          placeholder="Scrivi un messaggio..."
          disabled={loading}
          style={{
            flex:         1,
            padding:      '12px 16px',
            border:       '1px solid var(--border-color)',
            borderRadius: '24px',
            background:   'var(--bg-input)',
            color:        'var(--text-primary)',
            fontSize:     '16px',
            outline:      'none',
            minHeight:    '44px',
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            width:          '44px',
            height:         '44px',
            borderRadius:   '50%',
            background:     input.trim() && !loading ? 'var(--gold)' : 'var(--bg-secondary)',
            border:         'none',
            cursor:         input.trim() && !loading ? 'pointer' : 'not-allowed',
            fontSize:       '18px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
            transition:     'background 0.15s',
            color:          input.trim() && !loading ? '#fff' : 'var(--text-muted)',
          }}
        >
          ➤
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40%            { transform: translateY(-6px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default ChatPage;
