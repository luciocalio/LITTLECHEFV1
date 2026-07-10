// src/components/layout/TopBar.jsx
const ALL_TABS = [
  { id: 'chat',     icon: '💬', label: 'Chat'      },
  { id: 'foodcost', icon: '🧾', label: 'Food Cost' },
  { id: 'menu',     icon: '📋', label: 'Prodotti'  },
  { id: 'tutorial', icon: '📚', label: 'Tutorial'  },
];

export function TopBar({ currentPage, onNavigate, onOpenSettings }) {
  // Mostra tutti i tab TRANNE quello corrente
  const tabs = ALL_TABS.filter(t => t.id !== currentPage);

  return (
    <div style={{
      position:     'sticky',
      top:          0,
      zIndex:       100,
      display:      'flex',
      alignItems:   'center',
      background:   'var(--bg-card)',
      borderBottom: '1px solid var(--border-color)',
      boxShadow:    '0 1px 4px rgba(0,0,0,0.06)',
      padding:      '0 4px',
      height:       '52px',
      gap:          '2px',
    }}>
      {/* TAB NAVIGAZIONE */}
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onNavigate(tab.id)}
          style={{
            flex:           1,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            '2px',
            padding:        '6px 4px',
            background:     'none',
            border:         'none',
            borderRadius:   '6px',
            cursor:         'pointer',
            color:          'var(--text-muted)',
            minHeight:      '44px',
            transition:     'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color      = 'var(--gold)';
            e.currentTarget.style.background = 'var(--bg-secondary)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color      = 'var(--text-muted)';
            e.currentTarget.style.background = 'none';
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>{tab.icon}</span>
          <span style={{ fontSize: '10px', fontWeight: '500', whiteSpace: 'nowrap' }}>
            {tab.label}
          </span>
        </button>
      ))}

      {/* SEPARATORE */}
      <div style={{ width: '1px', height: '28px', background: 'var(--border-color)', margin: '0 4px' }} />

      {/* SETTINGS */}
      <button
        onClick={onOpenSettings}
        style={{
          width:          '44px',
          minHeight:      '44px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          background:     'none',
          border:         'none',
          borderRadius:   '6px',
          cursor:         'pointer',
          fontSize:       '18px',
          color:          'var(--text-muted)',
          transition:     'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        ⚙️
      </button>
    </div>
  );
}

export default TopBar;
