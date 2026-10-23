import { useMemo, useState } from 'react'
import { ByToggle } from './BreakdownTable.jsx'
import LineChart from './LineChart.jsx'
import { equipmentLabel, lbToKg, MUSCLE_ORDER, MUSCLE_TO_SPLIT, round, SPLIT_ORDER } from '../format.js'
import { liftProgress, muscleProgress, progressLifts } from '../stats.js'

// What the y-axis can show — the breakdown table's load columns, per session.
const METRICS = [
  { key: 'wtdAvgLb', label: 'WAVG' },
  { key: 'volumeLb', label: 'Volume' },
  { key: 'maxLb', label: 'Max' },
]

// Lifting trends over time, by weighted average, total volume or heaviest set,
// one point per day trained. Charts whatever `workouts` it's given — the month
// summary passes just that month's.
//
// By exercise: pick an exercise and resistance. The list can be narrowed the
// way the Exercises page's table is: by name, by split, and by primary muscle.
// By muscle: pick a primary muscle and every lift that targets it is pooled,
// like the breakdown table's "by muscle" rows.
export default function LiftProgress({ workouts, unit }) {
  const lifts = useMemo(() => progressLifts(workouts), [workouts])

  const [by, setBy] = useState('exercise')
  const [search, setSearch] = useState('')
  const [split, setSplit] = useState('') // '' = all
  // By exercise, an optional filter ('' = all). By muscle, the muscle charted —
  // shared so switching modes keeps the choice.
  const [muscle, setMuscle] = useState('')
  // The user's pick. Equipment only applies while its exercise is the one shown.
  const [pick, setPick] = useState({ exerciseId: null, equipment: null })
  const [metric, setMetric] = useState('wtdAvgLb')

  // Muscles that have a lift here, narrowed to the chosen split, in the
  // canonical order — so no choice leads to an empty list.
  const muscleOptions = useMemo(() => {
    const present = new Set(lifts.map((l) => l.muscleGroup))
    return MUSCLE_ORDER.filter((m) => present.has(m) && (!split || MUSCLE_TO_SPLIT[m] === split))
  }, [lifts, split])

  // Still newest-trained first, which is what the default pick leans on.
  const query = search.trim().toLowerCase()
  const matching = lifts
    .filter((l) => !split || l.split === split)
    .filter((l) => !muscle || l.muscleGroup === muscle)
    .filter((l) => !query || l.name.toLowerCase().includes(query))
  // Alphabetical for the picker.
  const byName = [...matching].sort((a, b) => a.name.localeCompare(b.name))

  // The picked lift while it passes the filters; otherwise the most recently
  // trained one that does, so the chart always matches what the picker shows.
  const lift = matching.find((l) => l.exerciseId === pick.exerciseId) || matching[0]
  const variant =
    (lift?.exerciseId === pick.exerciseId && lift.variants.find((v) => v.equipment === pick.equipment)) ||
    lift?.variants[0]

  // By muscle there's no "all": fall back to the most recently trained lift's
  // muscle among those on offer.
  const byMuscle = by === 'muscle'
  const chartMuscle = muscleOptions.includes(muscle)
    ? muscle
    : lifts.find((l) => muscleOptions.includes(l.muscleGroup))?.muscleGroup

  const points = useMemo(() => {
    if (byMuscle) return chartMuscle ? muscleProgress(workouts, chartMuscle) : []
    return lift ? liftProgress(workouts, lift.exerciseId, variant.equipment) : []
  }, [workouts, byMuscle, chartMuscle, lift, variant])
  // What's being charted, for the empty-state line.
  const subject = byMuscle ? chartMuscle : lift?.name

  if (lifts.length === 0) return null

  // A split clears a muscle that no longer belongs to it.
  function changeSplit(next) {
    setSplit(next)
    if (muscle && next && MUSCLE_TO_SPLIT[muscle] !== next) setMuscle('')
  }

  // Loads are stored lb-normalized; show them in the user's unit. Volume is a
  // big number, so whole units are plenty.
  const toUnit = (lb, places = 1) => (unit === 'kg' ? round(lbToKg(lb), places) : round(lb, places))
  const isVolume = metric === 'volumeLb'
  const metricLabel = METRICS.find((m) => m.key === metric).label
  const fmt = (lb) => `${toUnit(lb, isVolume ? 0 : 1).toLocaleString()} ${unit}`

  const muscleSelect = (
    <select
      value={byMuscle ? chartMuscle : muscle}
      onChange={(e) => setMuscle(e.target.value)}
      aria-label={byMuscle ? 'Muscle' : 'Filter by muscle'}
    >
      {!byMuscle && <option value="">All muscles</option>}
      {muscleOptions.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  )

  // Nothing to chart: no lift passes the filters, or (by muscle) the chosen
  // split has no trained muscle.
  const empty = byMuscle ? !chartMuscle : !lift

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Progress</h2>
        <ByToggle by={by} onChange={setBy} />
      </div>

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        {!byMuscle && (
          <input
            type="search"
            placeholder="Search exercises"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search exercises"
          />
        )}
        {['', ...SPLIT_ORDER].map((s) => (
          <button
            key={s || 'all'}
            className={`btn small${split === s ? '' : ' ghost'}`}
            onClick={() => changeSplit(s)}
          >
            {s || 'all'}
          </button>
        ))}
        {!byMuscle && muscleSelect}
      </div>

      {empty ? (
        <div className="muted small" style={{ marginTop: 14 }}>
          {byMuscle ? 'No muscles trained in that split here.' : 'No lifts match those filters.'}
        </div>
      ) : (
        <>
          <div className="row between" style={{ marginTop: 10 }}>
            <span className="row" style={{ gap: 8 }}>
              {byMuscle ? (
                muscleSelect
              ) : (
                <>
                  <select
                    value={lift.exerciseId}
                    // A new lift starts on its own most recent resistance.
                    onChange={(e) => setPick({ exerciseId: Number(e.target.value), equipment: null })}
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
                    onChange={(e) => setPick({ exerciseId: lift.exerciseId, equipment: e.target.value })}
                    aria-label="Resistance"
                    disabled={lift.variants.length === 1}
                  >
                    {lift.variants.map((v) => (
                      <option key={v.equipment} value={v.equipment}>
                        {v.equipment ? equipmentLabel(v.equipment) : 'No resistance'} ({v.days})
                      </option>
                    ))}
                  </select>
                </>
              )}
            </span>
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

          {points.length < 2 ? (
            <div className="muted small" style={{ marginTop: 14 }}>
              Only one day of {subject} logged here — it takes two to draw a trend.
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <LineChart
                label={`${subject} ${metricLabel} (${unit})`}
                points={points.map((p) => ({
                  date: p.date,
                  value: toUnit(p[metric], isVolume ? 0 : 1),
                  tip: [
                    `${metricLabel} ${fmt(p[metric])}`,
                    // Pooled across lifts, so say how many went in.
                    byMuscle && `${p.exercises} ${p.exercises === 1 ? 'exercise' : 'exercises'}`,
                    `${p.sets} ${p.sets === 1 ? 'set' : 'sets'}, ${p.reps} reps`,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                }))}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
