// src/components/foodcost/SectionHeader.jsx — V10
// Intestazione sezione con rename inline, stats margine, azioni
import { useState } from 'react';

function marginColor(pct) {
  if (pct >= 60) return '#16a34a';
  if (pct >= 40) return '#E69D43';
  if (pct >= 20) return '#f59e0b';
  return '#dc2626';
}

export function SectionHeader({ section, dishes, onRename, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(section.name);

  const commit = () => {
    const trimmed = draft.trim().toUpperCase();
    if (trimmed) onRename(section.id, trimmed);
    setEditing(false);
  };

  // Calcola margine medio della sezione — sul ricavo netto (IVA esclusa),
  // mai sul prezzo di menu lordo (Stage 10, Punto 1). netRevenue è già
  // calcolato da App.jsx; fallback al prezzo lordo solo per sicurezza.
  const avgMargin = (() => {
    const valid = dishes.filter(d => parseFloat(d.netRevenue ?? d.selling_price ?? d.price) > 0);
    if (valid.length === 0) return null;
    const sum = valid.reduce((acc, d) => {
      const p = parseFloat(d.netRevenue ?? d.selling_price ?? d.price ?? 0);
      const c = parseFloat(d.totalCost || d.food_cost || 0);
      return acc + (p > 0 ? ((p - c) / p) * 100 : 0);
    }, 0);
    return sum / valid.length;
  })();

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {/* Frecce riordino */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <button onClick={onMoveUp} disabled={isFirst} style={{
            background: 'none', border: 'none', cursor: isFirst ? 'default' : 'pointer',
            color: isFirst ? 'var(--border-color)' : 'var(--text-muted)', fontSize: 10, padding: '0 2px', lineHeight: 1,
          }}>▲</button>
          <button onClick={onMoveDown} disabled={isLast} style={{
            background: 'none', border: 'none', cursor: isLast ? 'default' : 'pointer',
            color: isLast ? 'var(--border-color)' : 'var(--text-muted)', fontSize: 10, padding: '0 2px', lineHeight: 1,
          }}>▼</button>
        </div>

        {/* Nome sezione — clicca per modificare */}
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value.toUpperCase())}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            style={{
              fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 700,
              color: 'var(--gold)', background: 'var(--bg-secondary)',
              border: '1px solid var(--gold)', borderRadius: 6,
              padding: '4px 8px', outline: 'none',
            }}
          />
        ) : (
          <button
            onClick={() => { setDraft(section.name); setEditing(true); }}
            title="Clicca per rinominare"
            style={{
              background: 'none', border: 'none', cursor: 'text', padding: 0,
              fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 700,
              color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 1,
            }}>
            {section.name}
          </button>
        )}

        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
          ({dishes.length})
        </span>

        {/* Margine medio */}
        {avgMargin !== null && (
          <span style={{ fontSize: 11, color: marginColor(avgMargin), marginLeft: 8 }}>
            Margine medio: {avgMargin.toFixed(1)}%
          </span>
        )}

        {/* Elimina sezione */}
        <button
          onClick={() => onDelete(section)}
          title="Elimina sezione"
          style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '0 4px',
          }}>🗑️</button>
      </div>

      {/* Separatore */}
      <div style={{ height: 1, background: 'var(--border-color)', marginBottom: 10 }} />
    </div>
  );
}
