// src/components/foodcost/FilterBar.jsx — V10
// Barra filtri semaforo + ordinamento prodotti

const FILTERS = [
  { id: 'critical',  label: '🔴 Critici',   min: -Infinity, max: 20  },
  { id: 'attention', label: '🟠 Attenzione', min: 20,        max: 40  },
  { id: 'good',      label: '🟡 Buoni',      min: 40,        max: 60  },
  { id: 'top',       label: '🟢 Ottimi',     min: 60,        max: Infinity },
];

const SORT_OPTIONS = [
  { id: 'profit_desc', label: 'Maggior profitto' },
  { id: 'profit_asc',  label: 'Minor profitto' },
  { id: 'name_az',     label: 'Alfabetico' },
  { id: 'section',     label: 'Per sezione' },
];

export function FilterBar({ activeFilters, setActiveFilters, sortKey, setSortKey }) {
  const toggleFilter = id =>
    setActiveFilters(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
      background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)',
      overflowX: 'auto', flexWrap: 'nowrap',
    }}>
      {/* Filtri semaforo */}
      {FILTERS.map(f => {
        const active = activeFilters.includes(f.id);
        return (
          <button
            key={f.id}
            className={f.id === 'critical' ? 'filter-btn-critical' : undefined}
            onClick={() => toggleFilter(f.id)}
            style={{
              padding: '5px 10px', minHeight: 32, borderRadius: 20, flexShrink: 0,
              background: active ? 'var(--gold-light)' : 'var(--bg-secondary)',
              border: `1px solid ${active ? 'var(--gold)' : 'var(--border-color)'}`,
              color: active ? 'var(--gold)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
            {f.label}
          </button>
        );
      })}

      {/* Separatore */}
      <div style={{ width: 1, height: 20, background: 'var(--border-color)', flexShrink: 0, margin: '0 4px' }} />

      {/* Ordinamento */}
      <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
        Ordina per:
      </span>
      <select
        value={sortKey}
        onChange={e => setSortKey(e.target.value)}
        style={{
          padding: '5px 8px', minHeight: 32, borderRadius: 8, flexShrink: 0,
          border: '1px solid var(--border-color)', background: 'var(--bg-input)',
          color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', outline: 'none',
        }}>
        {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}

// Helper: applica filtri e ordinamento a un array di piatti
export function applyFiltersAndSort(dishes, activeFilters, sortKey) {
  let list = [...dishes];

  // Filtri semaforo
  if (activeFilters.length > 0) {
    list = list.filter(d => {
      const pct = (() => {
        const pre = parseFloat(d.marginPct ?? d.margin_pct ?? 0);
        if (pre !== 0) return pre;
        const sp = parseFloat(d.selling_price || d.price || 0);
        const tc = parseFloat(d.totalCost || d.food_cost || 0);
        return sp > 0 ? ((sp - tc) / sp) * 100 : 0;
      })();
      return activeFilters.some(fid => {
        const f = FILTERS.find(x => x.id === fid);
        return f && pct >= f.min && pct < f.max;
      });
    });
  }

  // Ordinamento
  if (sortKey === 'section') return list; // preserva ordine originale

  list.sort((a, b) => {
    const getMargPct = d => {
      const p = parseFloat(d.marginPct ?? d.margin_pct ?? 0);
      if (p !== 0) return p;
      const sp = parseFloat(d.selling_price || d.price || 0);
      const tc = parseFloat(d.totalCost || d.food_cost || 0);
      return sp > 0 ? ((sp - tc) / sp) * 100 : 0;
    };
    if (sortKey === 'profit_desc') return getMargPct(b) - getMargPct(a);
    if (sortKey === 'profit_asc')  return getMargPct(a) - getMargPct(b);
    if (sortKey === 'name_az')     return (a.name || '').localeCompare(b.name || '', 'it');
    return getMargPct(b) - getMargPct(a); // fallback: maggior profitto
  });

  return list;
}
