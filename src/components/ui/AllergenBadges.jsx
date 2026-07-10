import { ALLERGENS } from '../../lib/allergens';

export function AllergenBadges({ allergenKeys = [], size = 'md', showTooltip = true }) {
  if (!allergenKeys?.length) {
    return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>;
  }
  const fontSize = size === 'sm' ? '14px' : size === 'lg' ? '22px' : '18px';
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
      {allergenKeys.filter(k => ALLERGENS[k]).map(key => (
        <span
          key={key}
          title={showTooltip ? ALLERGENS[key].name : undefined}
          style={{ fontSize, cursor: showTooltip ? 'help' : 'default', lineHeight: 1 }}
        >
          {ALLERGENS[key].emoji}
        </span>
      ))}
    </div>
  );
}

export function AllergenLegend() {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      padding: '20px',
      marginTop: '24px',
    }}>
      <h3 style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '16px',
        fontWeight: '700',
        marginBottom: '16px',
        color: 'var(--text-primary)',
      }}>
        Legenda Allergeni (14 allergeni UE)
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: '10px',
      }}>
        {Object.entries(ALLERGENS).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>{val.emoji}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{val.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
