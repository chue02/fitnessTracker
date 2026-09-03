import { formatDuration, parseDuration } from '../format.js'

// One cardio segment: distance + unit, duration (mm:ss), avg heart rate.
export default function CardioRow({ index, entry, onChange, onRemove }) {
  const set = (field, value) => onChange({ ...entry, [field]: value })

  return (
    <div className="entry-line">
      <span className="idx">{index + 1}</span>
      <input
        type="number"
        min="0"
        step="0.1"
        placeholder="distance"
        value={entry.distance ?? ''}
        onChange={(e) => set('distance', e.target.value === '' ? null : e.target.value)}
      />
      <select value={entry.distance_unit} onChange={(e) => set('distance_unit', e.target.value)}>
        <option value="mi">mi</option>
        <option value="km">km</option>
      </select>
      <input
        type="text"
        placeholder="mm:ss"
        style={{ width: 80 }}
        defaultValue={formatDuration(entry.duration_seconds)}
        onBlur={(e) => set('duration_seconds', parseDuration(e.target.value))}
      />
      <input
        type="number"
        min="0"
        placeholder="avg bpm"
        value={entry.avg_heart_rate ?? ''}
        onChange={(e) =>
          set('avg_heart_rate', e.target.value === '' ? null : Number(e.target.value))
        }
      />
      <button type="button" className="btn ghost small" onClick={onRemove}>
        ✕
      </button>
    </div>
  )
}
