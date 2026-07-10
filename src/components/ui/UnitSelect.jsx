// src/components/ui/UnitSelect.jsx
import { getCompatibleUnits, AVAILABLE_UNITS } from '../../lib/calcEngine';

export function UnitSelect({ value, onChange, filterUnit, disabled = false, style = {} }) {
  const units = filterUnit
    ? getCompatibleUnits(filterUnit)
    : AVAILABLE_UNITS;

  const grouped = {
    weight: units.filter(u => u.category === 'weight'),
    volume: units.filter(u => u.category === 'volume'),
    count:  units.filter(u => u.category === 'count'),
  };

  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={{
        padding:      '8px 10px',
        border:       '1px solid var(--border-color)',
        borderRadius: '6px',
        background:   disabled ? 'var(--bg-secondary)' : 'var(--bg-input)',
        color:        'var(--text-primary)',
        fontSize:     '14px',
        minHeight:    '44px',
        minWidth:     '110px',
        cursor:       disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {grouped.weight.length > 0 && (
        <optgroup label="⚖️ Peso">
          {grouped.weight.map(u => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </optgroup>
      )}
      {grouped.volume.length > 0 && (
        <optgroup label="💧 Volume">
          {grouped.volume.map(u => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </optgroup>
      )}
      {grouped.count.length > 0 && (
        <optgroup label="🔢 Pezzi">
          {grouped.count.map(u => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

export default UnitSelect;
