// src/components/demo/DemoBanner.jsx — V11
import { useState } from 'react';

export function DemoBanner({ onReset }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('lc_demo_banner_dismissed') === 'true'
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem('lc_demo_banner_dismissed', 'true');
    setDismissed(true);
  };

  return (
    <div style={{
      background: 'var(--gold-light)',
      borderBottom: '1px solid var(--gold)',
      padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, minWidth: 200 }}>
        👋 Stai provando LittleChef con <strong>dati di esempio</strong>.
        Modifica prezzi, aggiungi piatti, esplora — tutto resta solo su questo dispositivo.
      </span>
      <button
        onClick={onReset}
        style={{
          fontSize: 12, padding: '5px 12px', minHeight: 32,
          background: 'none', border: '1px solid var(--border-color)',
          borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)',
          flexShrink: 0,
        }}>
        🔄 Ricarica dati
      </button>
      <button
        onClick={handleDismiss}
        style={{
          fontSize: 12, padding: '5px 12px', minHeight: 32,
          background: 'none', border: '1px solid var(--gold)',
          borderRadius: 6, cursor: 'pointer', color: 'var(--gold)',
          fontWeight: 600, flexShrink: 0,
        }}>
        Ho capito ✕
      </button>
    </div>
  );
}
