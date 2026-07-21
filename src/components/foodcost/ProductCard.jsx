// src/components/foodcost/ProductCard.jsx — V10
// Card prodotto con semaforo, costi breakdown e azioni
import { useEffect, useState } from 'react';

function marginColor(pct) {
  if (pct >= 60) return '#16a34a';   // verde
  if (pct >= 40) return 'var(--gold)';  // oro
  if (pct >= 20) return '#f59e0b';   // arancio
  return '#dc2626';                  // rosso
}

function marginLabel(pct) {
  if (pct >= 60) return 'Ottimo';
  if (pct >= 40) return 'Buono';
  if (pct >= 20) return 'Attenzione';
  return 'Critico';
}

function marginDot(pct) {
  if (pct >= 60) return '🟢';
  if (pct >= 40) return '🟡';
  if (pct >= 20) return '🟠';
  return '🔴';
}

export function ProductCard({ dish, onEdit, onDuplicate, onToggleVisible, onDelete, isFirstRedDemo, flashKey }) {
  // Flash visivo quando il piatto è stato appena aggiornato dal Sous Chef (chat).
  // Il timer riparte ogni volta che flashKey cambia (nuovo update), anche se
  // il componente non si è mai smontato.
  const [isFlashing, setIsFlashing] = useState(false);
  useEffect(() => {
    if (!flashKey) return;
    setIsFlashing(true);
    const t = setTimeout(() => setIsFlashing(false), 1600);
    return () => clearTimeout(t);
  }, [flashKey]);

  const sellPr    = parseFloat(dish.selling_price || dish.price || 0);
  const ingCost   = parseFloat(dish.food_cost || 0);
  const hasFixed  = parseFloat(dish.fixedCostOnDish) > 0;
  const fixedCost = hasFixed ? parseFloat(dish.fixedCostOnDish || 0) : 0;
  const totalCost = hasFixed ? parseFloat(dish.totalCost || ingCost) : ingCost;
  const grossMrg  = sellPr - totalCost;
  const mPct      = sellPr > 0 ? ((grossMrg / sellPr) * 100) : 0;
  const mColor    = marginColor(mPct);
  const mLabel    = marginLabel(mPct);
  const dot       = marginDot(mPct);
  const incomplete = ingCost === 0;
  const isHidden   = dish.isVisible === false;

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 10,
      border: '1px solid var(--border-color)',
      borderLeft: `4px solid ${mColor}`,
      marginBottom: 8,
      opacity: isHidden ? 0.6 : 1,
      transition: 'opacity 0.2s',
      animation: isFlashing ? 'productCardFlash 1.6s ease-out' : undefined,
    }}>
      {/* ROW 1: nome + prezzo + semaforo */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px 6px' }}>
        <span style={{ fontSize: 16, lineHeight: 1.3 }}>{dot}</span>
        <p style={{
          flex: 1, margin: 0, fontSize: 14, fontWeight: 700,
          color: 'var(--text-primary)', lineHeight: 1.3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{dish.name}</p>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
          €{sellPr.toFixed(2)}
        </span>
      </div>

      {/* BADGES */}
      {(incomplete || isHidden || dish.internalNotes || dish.hasUpdatedIngredients) && (
        <div style={{ padding: '0 14px 6px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {incomplete && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
              background: 'var(--gold-badge)', color: 'var(--gold-text)', fontWeight: 600 }}>
              ⚠️ Costo incompleto
            </span>
          )}
          {dish.hasUpdatedIngredients && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(234,179,8,0.14)', color: '#ca8a04', fontWeight: 600 }}>
              ⚡ Costo aggiornato
            </span>
          )}
          {isHidden && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
              background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontWeight: 600 }}>
              💤 Nascosto dal menù
            </span>
          )}
          {dish.internalNotes && (
            <span title={dish.internalNotes} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
              background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontWeight: 600 }}>
              📝
            </span>
          )}
        </div>
      )}

      {/* ROW 2: breakdown costi */}
      <div style={{ padding: '0 14px 8px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Ingredienti: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            €{ingCost.toFixed(2)}
          </span>
        </span>
        {hasFixed && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Fissi: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              €{fixedCost.toFixed(2)}
            </span>
          </span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Tot: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
            €{totalCost.toFixed(2)}
          </span>
        </span>
      </div>

      {/* ROW 3: margine + badge */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Margine: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: mColor }}>
            €{grossMrg.toFixed(2)}
          </span>
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
          background: mColor + '18', color: mColor,
        }}>
          {mPct.toFixed(1)}% — {mLabel}
        </span>

        {/* AZIONI */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {[
            { icon: '✏️', title: 'Modifica',  action: () => onEdit(dish), extraClass: isFirstRedDemo ? 'demo-first-red-edit' : undefined },
            { icon: '📋', title: 'Duplica',   action: () => onDuplicate(dish) },
            { icon: isHidden ? '👁️‍🗨️' : '👁️', title: isHidden ? 'Mostra' : 'Nascondi', action: () => onToggleVisible(dish) },
            { icon: '🗑️', title: 'Elimina',  action: () => onDelete(dish), danger: true },
          ].map(({ icon, title, action, danger, extraClass }) => (
            <button
              key={title}
              className={extraClass}
              onClick={action}
              title={title}
              style={{
                background: 'none', border: '1px solid var(--border-color)',
                borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                fontSize: 13, color: danger ? 'var(--status-risk)' : 'var(--text-muted)',
                minHeight: 32, minWidth: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
