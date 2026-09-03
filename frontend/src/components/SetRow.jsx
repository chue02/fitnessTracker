// One strength set: reps, weight, unit, warmup toggle.
export default function SetRow({ index, entry, onChange, onRemove }) {
  const set = (field, value) => onChange({ ...entry, [field]: value })

  return (
    <div className="entry-line">
      <span className="idx">{index + 1}</span>
      <input
        type="number"
        min="0"
        placeholder="reps"
        value={entry.reps ?? ''}
        onChange={(e) => set('reps', e.target.value === '' ? null : Number(e.target.value))}
      />
      <input
        type="number"
        min="0"
        step="0.5"
        placeholder="weight"
        value={entry.weight ?? ''}
        onChange={(e) => set('weight', e.target.value === '' ? null : e.target.value)}
      />
      <select value={entry.weight_unit} onChange={(e) => set('weight_unit', e.target.value)}>
        <option value="lb">lb</option>
        <option value="kg">kg</option>
      </select>
      <label className="row small" style={{ margin: 0, color: 'var(--muted)' }}>
        <input
          type="checkbox"
          checked={entry.is_warmup}
          onChange={(e) => set('is_warmup', e.target.checked)}
          style={{ width: 'auto' }}
        />
        &nbsp;warmup
      </label>
      <button type="button" className="btn ghost small" onClick={onRemove}>
        ✕
      </button>
    </div>
  )
}
