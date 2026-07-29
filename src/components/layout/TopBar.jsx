// src/components/layout/TopBar.jsx — Stage 6C
// Navigazione superiore SEMPRE completa e persistente: tutte le voci
// sempre visibili (mai nascoste, mai a scomparsa). La sezione attiva è
// evidenziata in Gold. Su mobile la barra scorre in orizzontale se le
// voci non entrano — nessun hamburger che nasconde le sezioni.

const NAV = [
  { id: 'chat',       icon: '💬', label: 'Chat',        page: 'chat' },
  { id: 'pantry',     icon: '🧺', label: 'Dispensa',    page: 'pantry' },
  { id: 'fixedcosts', icon: '💶', label: 'Costi Fissi', page: 'fixedcosts' },
  { id: 'menu',       icon: '📋', label: 'Prodotti',    page: 'menu' },
];

export function TopBar({ currentPage, onNavigate, onOpenSettings, restaurant }) {
  const isActive = item => currentPage === item.page;

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', alignItems: 'center',
      background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      padding: '0 4px', minHeight: '52px', gap: '2px',
    }}>
      {/* LOCALE LOGGATO — logo (nome nascosto su schermi stretti) */}
      {restaurant && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px 0 4px', flexShrink: 0, maxWidth: '34%' }}>
          {restaurant.logo_url ? (
            <img src={restaurant.logo_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--gold)' }} />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--gold-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👨‍🍳</div>
          )}
          <span className="topbar-venue" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {restaurant.name}
          </span>
        </div>
      )}

      {/* NAV — sempre tutte le voci; scroll orizzontale se non entrano */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'stretch', gap: 2,
        overflowX: 'auto', overflowY: 'hidden',
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}>
        {NAV.map(item => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.page)}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: '1 0 auto', minWidth: 60,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                padding: '6px 8px', minHeight: 44,
                background: active ? 'var(--gold-light)' : 'none',
                border: 'none',
                borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
                borderRadius: '6px 6px 0 0',
                cursor: 'pointer',
                color: active ? 'var(--gold)' : 'var(--text-muted)',
                fontWeight: active ? 700 : 500,
                transition: 'color 0.15s, background 0.15s',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
              <span style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* SETTINGS */}
      <button
        onClick={onOpenSettings}
        aria-label="Impostazioni"
        style={{
          width: 44, minHeight: 44, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', borderRadius: 6,
          cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)',
        }}
      >
        ⚙️
      </button>
    </div>
  );
}

export default TopBar;
