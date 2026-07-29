// src/App.jsx — V11
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, getMyRestaurant } from './lib/supabase.js';
import { AuthPage }      from './components/auth/AuthPage.jsx';
import { ResetPassword } from './components/auth/ResetPassword.jsx';
import { ChatPage }        from './components/chat/ChatPage.jsx';
import { PantryPage }      from './pages/PantryPage.jsx';
import { FixedCostsPage }  from './pages/FixedCostsPage.jsx';
import { MenuPage }        from './components/menu/MenuPage.jsx';
import { SettingsModal } from './components/settings/SettingsModal.jsx';
import { ImportScanner } from './components/import/ImportScanner.jsx';
import {
  calcDishFoodCost, calcMargin,
  calcFixedCostRatio, calcDishWithFixedCosts,
} from './lib/calcEngine.js';
import {
  getAllFromDB, dbSetSetting, saveToDB,
  seedDemoSupabase, clearRestaurantCache,
} from './lib/dataService.js';

const DEFAULT_SECTIONS = [
  { id: 'sec_antipasto', name: 'ANTIPASTO',  order: 0 },
  { id: 'sec_primo',     name: 'PRIMO',      order: 1 },
  { id: 'sec_secondo',   name: 'SECONDO',    order: 2 },
  { id: 'sec_dolce',     name: 'DOLCE',      order: 3 },
  { id: 'sec_bevande',   name: 'BEVANDE',    order: 4 },
];

export default function App() {
  // ── Autenticazione ────────────────────────────────────────────────────────
  // session: undefined = verifica in corso, null = non loggato, object = loggato
  const [session,      setSession]      = useState(undefined);
  const [restaurant,   setRestaurant]   = useState(null);
  const [welcomeDone,  setWelcomeDone]  = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'PASSWORD_RECOVERY') { setRecoveryMode(true); }
      setSession(sess ?? null);
      if (!sess) {
        setRestaurant(null);
        setWelcomeDone(false);
        clearRestaurantCache();
        setIngredients([]); setPreparations([]); setDishes([]);
        setFixedCosts([]); setSections([]); setEstimatedRevenue(0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Carica la riga restaurants dell'account loggato.
  // Se è già stata passata da AuthPage (registrazione), non serve rileggerla:
  // evita il race in cui l'evento SIGNED_IN scatta prima che l'insert del
  // ristorante sia committato e getMyRestaurant tornerebbe null.
  useEffect(() => {
    if (!session) return;
    if (restaurant) return;
    getMyRestaurant()
      .then(setRestaurant)
      .catch(err => console.error('[App] Errore caricamento ristorante:', err));
  }, [session, restaurant]);

  const [currentPage,       setCurrentPage]       = useState('chat');
  const [showSettings,      setShowSettings]       = useState(false);
  const [scannerKind,       setScannerKind]        = useState(null); // 'pantry'|'fixed_costs'|'dishes' o null
  const [ingredients,       setIngredients]        = useState([]);
  const [preparations,      setPreparations]       = useState([]);
  const [dishes,            setDishes]             = useState([]);
  const [fixedCosts,        setFixedCosts]         = useState([]);
  const [estimatedRevenue,  setEstimatedRevenue]   = useState(0);
  const [sections,          setSections]           = useState([]);
  const [isSeeding,         setIsSeeding]          = useState(false);
  const [recentlyUpdatedDishes, setRecentlyUpdatedDishes] = useState([]); // [{id, ts}] — per flash visivo su Prodotti dopo update da chat

  // 6B: NESSUN seeding automatico di dati demo. Ogni account nuovo parte
  // vuoto. La demo si carica SOLO dal bottone in Settings, visibile al solo
  // account proprietario (OWNER_EMAIL) — vedi SettingsModal.

  // Carica i dati del ristorante loggato da Supabase (gate su restaurant)
  useEffect(() => {
    if (!restaurant) return;
    async function loadAll() {
      try {
        const [rawIng, rawPrep, rawDishes, rawFixed, rawSections] = await Promise.all([
          getAllFromDB('ingredients'),
          getAllFromDB('preparations'),
          getAllFromDB('dishes'),
          getAllFromDB('fixed_costs'),
          getAllFromDB('sections'),
        ]);

        const ings  = rawIng   || [];
        const preps = rawPrep  || [];
        const fixed = rawFixed || [];
        const rawD  = rawDishes || [];
        const savedRevenue = restaurant.estimated_monthly_revenue ?? 0;

        const dishs = rawD.map(d => {
          const comps = (d.components || []).filter(c => c.id_ref || c.id);
          if (comps.length > 0) {
            const mapped = comps.map(c => ({
              type:     c.type,
              id:       c.id_ref || c.id,
              quantity: parseFloat(c.qty ?? c.quantity) || 0,
              unit:     c.unit,
            }));
            const fc = calcDishFoodCost(mapped, ings, preps);
            const { marginEuro, marginPct, status } = calcMargin(d.selling_price || d.price, fc);
            return { ...d, food_cost: fc, margin_euro: marginEuro, margin_pct: marginPct, status };
          }
          const fc = parseFloat(d.food_cost) || 0;
          const { marginEuro, marginPct, status } = calcMargin(d.selling_price || d.price, fc);
          return { ...d, food_cost: fc, margin_euro: marginEuro, margin_pct: marginPct, status };
        });

        // Seed sections se primo avvio — id unici per ristorante
        // (la PK è globale: usare id fissi farebbe collidere ristoranti diversi)
        let secs = rawSections || [];
        if (secs.length === 0) {
          secs = DEFAULT_SECTIONS.map(s => ({ ...s, id: `${restaurant.id}_${s.id}` }));
          await Promise.all(secs.map(s => saveToDB('sections', s)));
        }

        setIngredients(ings);
        setPreparations(preps);
        setDishes(dishs);
        setFixedCosts(fixed);
        setEstimatedRevenue(parseFloat(savedRevenue) || 0);
        setSections(secs);
      } catch (err) {
        console.error('[App] Errore caricamento dati:', err);
      }
    }
    loadAll();
  }, [restaurant]);

  // ── Totale costi fissi mensili (dalla lista fixed_costs)
  const totalFixed = useMemo(() =>
    (fixedCosts || []).reduce((s, c) => s + (parseFloat(c.amount_monthly) || 0), 0),
    [fixedCosts]
  );

  // ── Ratio a piena precisione floating-point (mai arrotondato qui)
  const fixedCostRatio = useMemo(() =>
    calcFixedCostRatio(totalFixed, estimatedRevenue),
    [totalFixed, estimatedRevenue]
  );

  // ── Piatti arricchiti con i 4 campi derivati (solo per display, non nello state raw)
  const dishesWithFixed = useMemo(() =>
    (dishes || []).map(d => {
      const derived = calcDishWithFixedCosts(
        d.food_cost || 0,
        d.selling_price || d.price || 0,
        fixedCostRatio
      );
      return { ...d, ...derived };
    }),
    [dishes, fixedCostRatio]
  );

  // ── Salva estimatedRevenue sulla riga restaurants (Supabase)
  const handleEstimatedRevenueChange = useCallback(async value => {
    const val = parseFloat(value) || 0;
    setEstimatedRevenue(val);
    await dbSetSetting('estimatedMonthlyRevenue', val);
  }, []);

  // ── Flash visivo su Prodotti quando il Sous Chef aggiorna un piatto —
  // l'entry si auto-rimuove dopo 20s così tornare sulla pagina più tardi
  // non ri-innesca l'animazione.
  const handleDishUpdated = useCallback(id => {
    const ts = Date.now();
    setRecentlyUpdatedDishes(prev => [...prev.filter(e => e.id !== id), { id, ts }]);
    setTimeout(() => {
      setRecentlyUpdatedDishes(prev => prev.filter(e => !(e.id === id && e.ts === ts)));
    }, 20000);
  }, []);

  const sharedProps = {
    ingredients,  setIngredients,
    preparations, setPreparations,
    dishes:       dishesWithFixed,   // piatti con campi fissi già calcolati
    setDishes,
    fixedCosts,   setFixedCosts,
    estimatedRevenue,
    onEstimatedRevenueChange: handleEstimatedRevenueChange,
    fixedCostRatio,
    totalFixed,
    sections,     setSections,
    recentlyUpdatedDishes,
    onDishUpdated: handleDishUpdated,
    restaurant,
    currentPage,
    onNavigate: setCurrentPage,
    onOpenSettings: () => setShowSettings(true),
    onOpenScanner:  (kind) => setScannerKind(kind), // apre lo scanner col tipo della sezione
  };

  // ── Recupero password: link dall'email → imposta nuova password ───────────
  if (recoveryMode) {
    return <ResetPassword onDone={() => setRecoveryMode(false)} />;
  }

  // ── Gate autenticazione ───────────────────────────────────────────────────
  if (session === undefined) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>⏳ Verifica sessione...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <AuthPage
        onAuthed={setSession}
        onRegistered={(sess, rest) => { setRestaurant(rest); setSession(sess); }}
      />
    );
  }

  // Schermata di benvenuto post-login (Stage 1: il resto dell'app resta su IndexedDB)
  if (!welcomeDone) {
    return (
      <div style={{
        minHeight: '100dvh', background: 'var(--bg-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div style={{
          textAlign: 'center', background: 'var(--bg-card)',
          border: '1px solid var(--border-color)', borderRadius: 16,
          padding: '40px 32px', maxWidth: 420, width: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}>
          {restaurant?.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt="Logo del locale"
              style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', marginBottom: 16, border: '3px solid var(--gold)' }}
            />
          ) : (
            <div style={{ fontSize: 56, marginBottom: 12 }}>👨‍🍳</div>
          )}
          <h1 style={{
            fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700,
            margin: '0 0 6px', color: 'var(--text-primary)',
          }}>
            Bentornato, {restaurant?.name || '...'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px' }}>
            Il tuo locale ti aspetta.
          </p>
          <button
            onClick={() => setWelcomeDone(true)}
            style={{
              padding: '13px 32px', minHeight: 48, background: 'var(--gold)',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Entra →
          </button>
        </div>
      </div>
    );
  }

  if (isSeeding) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>⏳ Caricamento demo...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {currentPage === 'chat'       && <ChatPage       {...sharedProps} />}
      {currentPage === 'pantry'     && <PantryPage     {...sharedProps} />}
      {currentPage === 'fixedcosts' && <FixedCostsPage {...sharedProps} />}
      {currentPage === 'menu'       && <MenuPage       {...sharedProps} />}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          restaurant={restaurant}
          userEmail={session?.user?.email || ''}
          dishesCount={(dishes || []).length}
          ingredientsCount={(ingredients || []).length}
          fixedCount={(fixedCosts || []).length}
          totalFixed={totalFixed}
        />
      )}
      {scannerKind && (
        <ImportScanner
          kind={scannerKind}
          onClose={() => setScannerKind(null)}
          onImported={() => window.location.reload()}
        />
      )}
    </div>
  );
}
