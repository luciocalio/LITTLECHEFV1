export function StatusBadge({ status }) {
  const config = {
    top:   { emoji: '🟢', label: 'TOP',   bg: 'var(--status-top-bg)',   color: 'var(--status-top)'   },
    media: { emoji: '🟡', label: 'MEDIA', bg: 'var(--status-media-bg)', color: 'var(--status-media)' },
    risk:  { emoji: '🔴', label: 'RISK',  bg: 'var(--status-risk-bg)',  color: 'var(--status-risk)'  },
  };
  const c = config[status] || config.risk;
  return (
    <span style={{
      background: c.bg,
      color: c.color,
      padding: '3px 10px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '700',
      whiteSpace: 'nowrap',
      letterSpacing: '0.3px',
    }}>
      {c.emoji} {c.label}
    </span>
  );
}
