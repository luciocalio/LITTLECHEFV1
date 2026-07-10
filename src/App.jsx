// src/App.jsx — V11
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChatPage }      from './components/chat/ChatPage.jsx';
import { FoodCostPage }  from './components/foodcost/FoodCostPage.jsx';
import { MenuPage }      from './components/menu/MenuPage.jsx';
import { TutorialPage }  from './components/tutorial/TutorialPage.jsx';
import { SettingsModal } from './components/settings/SettingsModal.jsx';
import {
  calcDishFoodCost, calcMargin,
  calcFixedCostRatio, calcDishWithFixedCosts,
} from './lib/calcEngine.js';
import { getAllFromDB, dbGetSetting, dbSetSetting, saveToDB } from './lib/db.js';
import { insertSeedData } from './lib/seedData.js';

const DEFAULT_SECTIONS = [
  { id: 'sec_antipasto', name: 'ANTIPASTO',  order: 0 },
  { id: 'sec_primo',     name: 'PRIMO',      order: 1 },
  { id: 'sec_secondo',   name: 'SECONDO',    order: 2 },
  { id: 'sec_dolce',     name: 'DOLCE',      order: 3 },
  { id: 'sec_bevande',   name: 'BEVANDE',    order: 4 },
];

export default function App() {
  const [currentPage,       setCurrentPage]       = useState('chat');
  const [showSettings,      setShowSettings]       = useState(false);
  const [ingredients,       setIngredients]        = useState([]);
  const [preparations,      setPreparations]       = useState([]);
  const [dishes,            setDishes]             = useState([]);
  const [fixedCosts,        setFixedCosts]         = useState([]);
  const [estimatedRevenue,  setEstimatedRevenue]   = useState(0);
  const [sections,          setSections]           = useState([]);
  const [isSeeding,         setIsSeeding]          = useState(false);

  // ── Demo mode ─────────────────────────────────────────────────────────────
  const isDemoMode = useMemo(
    () => new URLSearchParams(window.location.search).get('demo') === 'true',
    []
  );

  // Seed demo data on first ?demo=true visit, then reload
  useEffect(() => {
    if (!isDemoMode) return;
    if (localStorage.getItem('lc_demo_seeded')) return;
    setIsSeeding(true);
    import('./lib/demoSeed').then(({ seedDemoData }) =>
      seedDemoData().then(() => {
        localStorage.setItem('lc_demo_seeded', 'true');
        window.location.reload();
      })
    );
  }, [isDemoMode]); // eslint-disable-line

  // window.seedDemoData() — richiamabile da console
  useEffect(() => {
    window.seedDemoData = async () => {
      const { seedDemoData } = await import('./lib/demoSeed');
      await seedDemoData();
      localStorage.setItem('lc_demo_seeded', 'true');
      window.location.reload();
    };
    return () => { delete window.seedDemoData; };
  }, []);

  useEffect(() => {
    async function loadAll() {
      try {
        const [rawIng, rawPrep, rawDishes, rawFixed, rawSections, savedRevenue] = await Promise.all([
          getAllFromDB('ingredients'),
          getAllFromDB('preparations'),
          getAllFromDB('dishes'),
          getAllFromDB('fixed_costs'),
          getAllFromDB('sections'),
          dbGetSetting('estimatedMonthlyRevenue'),
        ]);

        let ings  = rawIng   || [];
        let preps = rawPrep  || [];
        const fixed = rawFixed || [];
        let rawD  = rawDishes || [];

        if (ings.length === 0 && rawD.length === 0) {
          const seeded = await insertSeedData();
          ings = seeded.ingredients;
          rawD = seeded.dishes;
        }

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

        // Seed sections se primo avvio
        let secs = rawSections || [];
        if (secs.length === 0) {
          await Promise.all(DEFAULT_SECTIONS.map(s => saveToDB('sections', s)));
          secs = DEFAULT_SECTIONS;
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
  }, []);

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

  // ── Salva estimatedRevenue su IndexedDB (key-value store)
  const handleEstimatedRevenueChange = useCallback(async value => {
    const val = parseFloat(value) || 0;
    setEstimatedRevenue(val);
    await dbSetSetting('estimatedMonthlyRevenue', val);
  }, []);

  // ── Reset demo: ripopola i dati e ricarica
  const handleResetDemo = useCallback(async () => {
    localStorage.removeItem('lc_demo_seeded');
    localStorage.removeItem('lc_demo_banner_dismissed');
    localStorage.removeItem('lc_demo_tour_done');
    const { seedDemoData } = await import('./lib/demoSeed');
    await seedDemoData();
    localStorage.setItem('lc_demo_seeded', 'true');
    window.location.reload();
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
    isDemoMode,
    handleResetDemo,
    currentPage,
    onNavigate:     setCurrentPage,
    onOpenSettings: () => setShowSettings(true),
  };

  if (isSeeding) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>⏳ Caricamento demo...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {currentPage === 'chat'     && <ChatPage     {...sharedProps} />}
      {currentPage === 'foodcost' && <FoodCostPage {...sharedProps} />}
      {currentPage === 'menu'     && <MenuPage     {...sharedProps} />}
      {currentPage === 'tutorial' && <TutorialPage {...sharedProps} />}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
