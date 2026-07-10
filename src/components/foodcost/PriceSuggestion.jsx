// src/components/foodcost/PriceSuggestion.jsx — V10
// Suggerimenti prezzo di vendita in base al costo totale

const TARGETS = [60, 65, 70];  // target margine %

export function PriceSuggestion({ totalCost }) {
  const cost = parseFloat(totalCost) || 0;
  if (cost <= 0) return null;

  return (
    <div style={{
      padding: '10px 14px', background: 'rgba(230,157,67,0.08)',
      border: '1px solid rgba(230,157,67,0.3)', borderRadius: 8,
      marginTop: 8,
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 6 }}>
        💡 Prezzi suggeriti per margine target:
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {TARGETS.map(t => {
          const suggested = cost / (1 - t / 100);
          return (
            <span key={t} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Margine {t}%:</span>{' '}
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                €{suggested.toFixed(2)}
              </strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}
