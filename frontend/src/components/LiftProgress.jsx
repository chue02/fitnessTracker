import { useMemo, useState } from 'react'
import PrChart from './PrChart.jsx'
import { equipmentLabel, lbToKg, round } from '../format.js'
import { liftProgress, progressLifts } from '../stats.js'

// What the y-axis can show — the breakdown table's load columns, per session.
const METRICS = [
  { key: 'wtdAvgLb', label: 'WAVG' },
  { key: 'volumeLb', label: 'Volume' },
  { key: 'maxLb', label: 'Max' },
]

// One lift's trend over time: pick an exercise and resistance, then plot each
// day it was trained by weighted average, total volume or heaviest set. Charts
// whatever `workouts` it's given — the month summary passes just that month's.
export default function LiftProgress({ workouts, unit }) {
  const lifts = useMemo(() => progressLifts(workouts), [workouts])
  // Alphabetical for the picker; `lifts` itself is newest-trained first, which
  // is what the defaults below lean on.
  const byName = useMemo(() => [...lifts].sort((a, b) => a.name.localeCompare(b.name)), [lifts])

  const [exerciseId, setExerciseId] = useState(null)
  const [equipment, setEquipment] = useState(null)
  const [metric, setMetric] = useState('wtdAvgLb')

  // Until the user picks, show the most recently trained lift and variant.
  const lift = lifts.find((l) => l.exerciseId === exerciseId) || lifts[0]
  const variant = lift?.variants.find((v) => v.equipment === equipment) || lift?.variants[0]

  const points = useMemo(
    () => (lift ? liftProgress(workouts, lift.exerciseId, variant.equipment) : []),
    [workouts, lift, variant],
  )

  if (!lift) return null

  // Loads are stored lb-normalized; show them in the user's unit. Volume is a
  // big number, so whole units are plenty.
  const toUnit = (lb, places = 1) => (unit === 'kg' ? round(lbToKg(lb), places) : round(lb, places))
  const isVolume = metric === 'volumeLb'
  const metricLabel = METRICS.find((m) => m.key === metric).label
  const fmt = (lb) => `${toUnit(lb, isVolume ? 0 : 1).toLocaleString()} ${unit}`

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Progress</h2>
        <span className="row" style={{ gap: 6 }}>
          {METRICS.map((m) => (
            <button
              key={m.key}
              className={`btn small${metric === m.key ? '' : ' ghost'}`}
              onClick={() => setMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </span>
      </div>

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <select
          value={lift.exerciseId}
          onChange={(e) => {
            setExerciseId(Number(e.target.value))
            // A new lift starts on its own most recent resistance.
            setEquipment(null)
          }}
          aria-label="Exercise"
        >
          {byName.map((l) => (
            <option key={l.exerciseId} value={l.exerciseId}>
              {l.name}
            </option>
          ))}
        </select>
        <select
          value={variant.equipment}
          onChange={(e) => setEquipment(e.target.value)}
          aria-label="Resistance"
          disabled={lift.variants.length === 1}
        >
          {lift.variants.map((v) => (
            <option key={v.equipment} value={v.equipment}>
              {v.equipment ? equipmentLabel(v.equipment) : 'No resistance'} ({v.days})
            </option>
          ))}
        </select>
      </div>

      {points.length < 2 ? (
        <div className="muted small" style={{ marginTop: 14 }}>
          Only one day of this lift logged here — it takes two to draw a trend.
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <PrChart
            step={false}
            label={`${metricLabel} (${unit})`}
            points={points.map((p) => ({
              date: p.date,
              value: toUnit(p[metric], isVolume ? 0 : 1),
              tip: `${metricLabel} ${fmt(p[metric])} · ${p.sets} ${p.sets === 1 ? 'set' : 'sets'}, ${p.reps} reps`,
            }))}
          />
        </div>
      )}
    </div>
  )
}
