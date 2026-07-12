// src/components/chat/ChatPage.jsx
import { useState, useEffect, useRef } from 'react';
import { TopBar }   from '../layout/TopBar';
import { saveToDB, getAllFromDB } from '../../lib/db';
import { calcDishFoodCost, calcMargin, calcDishWithFixedCosts } from '../../lib/calcEngine';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const QUICK_REPLIES = [
  { label: '🔄 Aggiorna prezzo ingredienti', prompt: 'Voglio aggiornare il prezzo di un ingrediente' },
  { label: '➕ Aggiungi prodotto',            prompt: 'Voglio aggiungere un nuovo prodotto al menù'  },
  { label: '💰 Cambia costo fisso',           prompt: 'Voglio modificare un costo fisso'             },
  { label: '📊 Controlla margini',            prompt: 'Analizza i margini dei miei prodotti'         },
];

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
}) {
  const restaurantName = localStorage.getItem('lc-restaurant-name') ||
    (() => { try { return JSON.parse(localStorage.getItem('lc-settings') || '{}').restaurantName || 'Chef'; } catch { return 'Chef'; } })();

  const [messages, setMessages] = useState([welcomeMessage(restaurantName)]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
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
        food_cost: d.food_cost, status: d.status, category: d.category
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

    // Se non c'è API key configurata, risponde offline
    if (!API_KEY || !API_KEY.startsWith('sk-ant-')) {
      setMessages(prev => [...prev, {
        id:   crypto.randomUUID(),
        role: 'assistant',
        text: 'API key non configurata. Aggiungi VITE_ANTHROPIC_API_KEY nel file .env.local per abilitare la chat AI.',
        time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      }]);
      setLoading(false);
      return;
    }

    try {
      const fixedCostRatio = 0.343; // Ratio calcolato in seeding

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

QUANDO L'UTENTE CHIEDE:
1. "Quali piatti sono critici?" o "Margini bassi?" → usa get_critical_dishes
2. "Dettagli di [piatto]?" → usa get_dish_details
3. "Aumenta prezzo di [piatto]?" → usa update_dish_price
4. "Quale piatto guadagna più?" → usa get_most_profitable_dish
5. SEMPRE rispondi in italiano con spiegazione, mai solo numeri
6. NON usare markdown — testo plain, ben formattato`;

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
          description: 'Piatto con il margine percentuale più alto.',
          input_schema: { type: 'object', properties: {}, required: [] },
        },
      ];

      // Tool execution handlers (async support)
      const executeTool = async (toolName, toolInput) => {
        if (toolName === 'get_critical_dishes') {
          const critical = (dishes || []).filter(d => (d.marginPct || 0) < 20);
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
          const dish = (dishes || []).find(d => d.name?.toLowerCase() === toolInput.dishName?.toLowerCase());
          if (!dish) return JSON.stringify({ error: `Piatto "${toolInput.dishName}" non trovato` });
          return JSON.stringify({
            name: dish.name,
            price: dish.selling_price || dish.price,
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
          const dishIdx = (dishes || []).findIndex(d => d.name?.toLowerCase() === toolInput.dishName?.toLowerCase());
          if (dishIdx === -1) return JSON.stringify({ error: `Piatto "${toolInput.dishName}" non trovato` });

          const dish = dishes[dishIdx];
          const oldPrice = dish.selling_price || dish.price;
          const oldMarginPct = dish.marginPct;
          const updated = {
            ...dish,
            selling_price: newPrice,
            price: newPrice,
            ...calcDishWithFixedCosts(dish.food_cost || 0, newPrice, fixedCostRatio),
            updated_at: new Date().toISOString(),
          };
          const newDishes = [...dishes];
          newDishes[dishIdx] = updated;
          setDishes(newDishes);

          // Await saveToDB per assicurarsi che la transazione sia completata
          await saveToDB('dishes', updated);

          // Rileggi dal DB per verificare che la scrittura è riuscita
          const allDishesFromDB = await getAllFromDB('dishes');
          const verifyFromDB = allDishesFromDB.find(d => d.id === updated.id);

          if (!verifyFromDB || verifyFromDB.selling_price !== newPrice) {
            return JSON.stringify({ error: 'Errore: la scrittura su IndexedDB non è riuscita' });
          }

          return JSON.stringify({
            success: true,
            oldPrice: oldPrice.toFixed(2),
            newPrice: newPrice.toFixed(2),
            oldMarginPct: (oldMarginPct || 0).toFixed(1),
            newMarginPct: (updated.marginPct || 0).toFixed(1),
          });
        }
        if (toolName === 'get_most_profitable_dish') {
          const profitable = [...(dishes || [])].sort((a, b) => (b.marginPct || 0) - (a.marginPct || 0))[0];
          if (!profitable) return JSON.stringify({ error: 'Nessun piatto trovato' });
          return JSON.stringify({
            name: profitable.name,
            price: profitable.selling_price || profitable.price,
            foodCost: profitable.food_cost,
            marginPct: (profitable.marginPct || 0).toFixed(1),
            marginEuro: (profitable.grossMargin || 0).toFixed(2),
          });
        }
        return JSON.stringify({ error: `Tool "${toolName}" sconosciuto` });
      };

      // Agentic loop — continua finché il modello non finisce
      let messages = [{ role: 'user', content: trimmed }];
      let continueLoop = true;
      let finalText = '';

      while (continueLoop) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'x-api-key':     API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
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
      inputRef.current?.focus();
    }
  }

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        '100dvh',
      background:    'var(--bg-primary)',
    }}>
      {/* TOP BAR */}
      <TopBar
        currentPage={currentPage}
        onNavigate={onNavigate}
        onOpenSettings={onOpenSettings}
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
        flex:          1,
        overflowY:     'auto',
        padding:       '16px',
        display:       'flex',
        flexDirection: 'column',
        gap:           '10px',
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
                {msg.text}
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

        {/* TYPING INDICATOR */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '12px 16px', background: 'var(--bg-card)',
              borderRadius: '18px 18px 18px 4px',
              border: '1px solid var(--border-color)',
              display: 'flex', gap: '4px', alignItems: 'center',
            }}>
              {[0.0, 0.2, 0.4].map(delay => (
                <div key={delay} style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--text-muted)',
                  animation: `bounce 1s ${delay}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
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
            fontSize:     '14px',
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
      `}</style>
    </div>
  );
}

export default ChatPage;
