import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import PrChart from '../components/PrChart.jsx'
import ResistanceTag from '../components/ResistanceTag.jsx'
import { EQUIPMENT_ORDER, errorMessage, formatDuration, lbToKg, MUSCLE_ORDER, round } from '../format.js'
import { cardioHistory, distanceIn, paceHistory, prHistory } from '../stats.js'

const last = (log) => (log.length ? log[log.length - 1] : null)
const current = (g) => last(g.records)
const isCardio = (g) => g.kind === 'cardio'
// Cardio has no load; inside its own section the weight sort falls back to name.
const heaviest = (g) => (isCardio(g) ? 0 : current(g).lb)
// The date of a group's newest PR — for cardio, of any of its three logs.
const latestPr = (g) =>
  isCardio(g)
    ? [g.pace, g.distance, g.time].reduce((d, log) => (last(log)?.date > d ? last(log).date : d), '')
    : current(g).date
const byName = (a, b) => a.name.localeCompare(b.name)
const equipmentRank = (g) => {
  const i = EQUIPMENT_ORDER.indexOf(g.equipment)
  return i === -1 ? EQUIPMENT_ORDER.length : i
}

// Row orders within each split section. Every one falls back to name (then
// resistance) so ties read predictably.
const SORTS = {
  resistance: {
    label: 'Resistance',
    compare: (a, b) => equipmentRank(a) - equipmentRank(b) || byName(a, b),
  },
  name: {
    label: 'Name (A–Z)',
    compare: (a, b) => byName(a, b) || equipmentRank(a) - equipmentRank(b),
  },
  // lb-normalized, so a kg PR and an lb PR rank on the same scale.
  weight: {
    label: 'Heaviest PR',
    compare: (a, b) => heaviest(b) - heaviest(a) || byName(a, b),
  },
  recent: {
    label: 'Most recent PR',
    compare: (a, b) => latestPr(b).localeCompare(latestPr(a)) || byName(a, b),
  },
}

// Every lift's all-time PR, per resistance, and every cardio exercise's pace,
// distance and time bests, each with the full log of how it got there. Same single /workouts/ fetch as the home page; the history is derived
// from it rather than stored, so editing or deleting a workout is reflected
// immediately.
export default function Records() {
  const { user } = useAuth()
  const unit = user.profile?.weight_unit === 'kg' ? 'kg' : 'lb'
  // Cardio distances follow the unit preference: lb pairs with mi, kg with km.
  const distanceUnit = unit === 'kg' ? 'km' : 'mi'
  const [workouts, setWorkouts] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('') // primary muscle; '' = all
  const [sort, setSort] = useState('resistance')
  const [collapsed, setCollapsed] = useState(() => new Set()) // splits
  const [expanded, setExpanded] = useState(() => new Set()) // group keys

  useEffect(() => {
    api.get('/workouts/').then(setWorkouts).catch((e) => setError(errorMessage(e)))
  }, [])

  // Lifts in split order, then one cardio section at the end.
  const groups = useMemo(
    () => (workouts ? [...prHistory(workouts), ...cardioHistory(workouts, distanceUnit)] : []),
    [workouts, distanceUnit],
  )

  // Only muscles that actually have a record, in the Exercises page's order,
  // so no choice leads to an empty page.
  const muscleOptions = useMemo(() => {
    const present = new Set(groups.map((g) => g.muscleGroup).filter(Boolean))
    const rank = (m) => (MUSCLE_ORDER.includes(m) ? MUSCLE_ORDER.indexOf(m) : MUSCLE_ORDER.length)
    return [...present].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  }, [groups])

  // prHistory already sorts by split, so sections fall out in order; rows are
  // then ordered within each section.
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    const bySplit = new Map()
    for (const g of groups) {
      if (q && !g.name.toLowerCase().includes(q)) continue
      if (muscle && g.muscleGroup !== muscle) continue
      const split = g.split || 'other'
      if (!bySplit.has(split)) bySplit.set(split, [])
      bySplit.get(split).push(g)
    }
    for (const rows of bySplit.values()) rows.sort(SORTS[sort].compare)
    return [...bySplit]
  }, [groups, query, muscle, sort])

  const toggle = (setter, key) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  if (error) return <div className="error">{error}</div>
  if (workouts === null) return <div className="empty">Loading…</div>

  return (
    <div>
      <h1>Personal Records</h1>

      {groups.length === 0 ? (
        <div className="empty">
          No lifts or cardio logged yet. <Link to="/workouts/new">Log a workout →</Link>
        </div>
      ) : (
        <>
          <div className="row between" style={{ marginBottom: 14 }}>
            <span className="muted small">
              Heaviest set per lift and resistance; fastest pace, farthest and longest for cardio. A
              new entry is logged each time you beat one.
            </span>
            <div className="row" style={{ gap: 8 }}>
              <input
                type="search"
                placeholder="Search exercises"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label="Filter by muscle">
                <option value="">All muscles</option>
                {muscleOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort records">
                {Object.entries(SORTS).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    Sort: {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {sections.length === 0 && <div className="empty">No records match these filters.</div>}

          {sections.map(([split, rows]) => {
            const isCollapsed = collapsed.has(split)
            return (
              <div key={split} className="card">
                <button
                  className="rec-section-toggle"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggle(setCollapsed, split)}
                >
                  <Chevron open={!isCollapsed} />
                  <span className={`pill ${split}`}>{split}</span>
                  <span className="muted small">
                    {rows.length}{' '}
                    {split === 'cardio'
                      ? rows.length === 1 ? 'exercise' : 'exercises'
                      : rows.length === 1 ? 'lift' : 'lifts'}
                  </span>
                </button>

                {!isCollapsed &&
                  rows.map((g) => {
                    const Row = isCardio(g) ? CardioRecordRow : RecordRow
                    return (
                      <Row
                        key={g.key}
                        group={g}
                        unit={unit}
                        isExpanded={expanded.has(g.key)}
                        onToggle={() => toggle(setExpanded, g.key)}
                      />
                    )
                  })}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// A down-pointing dropdown arrow that flips up while its content is open.
function Chevron({ open }) {
  return (
    <svg className={`rec-chevron${open ? ' open' : ''}`} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

function RecordRow({ group, unit, isExpanded, onToggle }) {
  const best = current(group)
  const count = group.records.length

  return (
    <div className="rec-row">
      <div className="pr-row">
        <div>
          <button className="rec-toggle" aria-expanded={isExpanded} onClick={onToggle}>
            <Chevron open={isExpanded} />
            <span style={{ fontWeight: 600 }}>{group.name}</span>
            <ResistanceTag equipment={group.equipment} />
          </button>
          <div className="muted small rec-sub">
            set <Link to={`/workouts/${best.workoutId}`}>{best.date}</Link> · {count}{' '}
            {count === 1 ? 'record' : 'records'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="pr-value">
            {best.weight} {best.weightUnit}
            {best.bodyweight && (
              <span className="muted small" title="Your bodyweight on that day, plus any added weight">
                {' '}incl. BW
              </span>
            )}
          </div>
          <div className="muted small">
            × {best.reps} {best.reps === 1 ? 'rep' : 'reps'}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="rec-detail">
          {/* One record is a flat line — the table says it better. */}
          {count > 1 && (
            <PrChart
              label={`Weight (${unit})`}
              // lb-normalized, since records can mix units, then shown in the user's.
              points={group.records.map((r) => ({
                date: r.date,
                value: unit === 'kg' ? lbToKg(r.lb) : round(r.lb, 1),
                tip: `${r.weight} ${r.weightUnit} × ${r.reps}`,
              }))}
            />
          )}
          <table className="rec-history">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col" className="bd-num">Weight</th>
                <th scope="col" className="bd-num">Reps</th>
                <th scope="col" className="bd-num">Change</th>
              </tr>
            </thead>
            <tbody>
              {[...group.records].reverse().map((r) => (
                <tr key={`${r.date}-${r.workoutId}`}>
                  <td>
                    <Link to={`/workouts/${r.workoutId}`}>{r.date}</Link>
                  </td>
                  <td className="bd-num">
                    {r.weight} {r.weightUnit}
                  </td>
                  <td className="bd-num">{r.reps}</td>
                  <td className="bd-num">
                    {r.initial ? (
                      <span className="muted">first logged</span>
                    ) : (
                      <span className="pr-gain">
                        +{r.gain} {r.weightUnit}{' '}
                        <span className="rec-pct">(+{r.gainPct}%)</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const round2 = (n) => Math.round(n * 100) / 100

// A cardio exercise's minimum distance for pace PRs. Kept in this browser,
// per exercise, with the unit it was entered in so a unit switch converts it.
const minDistanceKey = (exerciseId) => `records.minDistance.${exerciseId}`

function loadMinDistance(exerciseId, unit) {
  try {
    const saved = JSON.parse(localStorage.getItem(minDistanceKey(exerciseId)))
    return saved?.value > 0 ? String(round2(distanceIn(saved.value, saved.unit, unit))) : ''
  } catch {
    return ''
  }
}

function saveMinDistance(exerciseId, value, unit) {
  try {
    if (value > 0) localStorage.setItem(minDistanceKey(exerciseId), JSON.stringify({ value, unit }))
    else localStorage.removeItem(minDistanceKey(exerciseId))
  } catch {
    // Storage unavailable (private window, blocked site data): the filter
    // still works, it just won't be remembered.
  }
}

// Cardio's three logs. Pace leads, as on the favorites card.
const CARDIO_METRICS = [
  { key: 'pace', label: 'Pace', context: 'Distance', time: true, lowerIsBetter: true },
  { key: 'distance', label: 'Distance', context: 'Time' },
  { key: 'time', label: 'Time', context: 'Distance', time: true },
]

// Cardio has no single "heaviest", so the row carries three bests, laid out
// like the favorites card: pace is the headline, labeled with the distance it
// was held over so a short effort can't pass for a long one; farthest and
// longest sit underneath. Expanded, a toggle picks which log to show. A minimum
// distance (e.g. "5 mi+") limits the pace record to sessions at least that
// long; farthest and longest ignore it, as on the favorites card.
function CardioRecordRow({ group, isExpanded, onToggle }) {
  const { unit } = group
  const [minText, setMinText] = useState(() => loadMinDistance(group.exerciseId, unit))
  const min = Number(minText) > 0 ? Number(minText) : 0
  const pace = useMemo(() => paceHistory(group.sessions, min), [group.sessions, min])

  // Pace stays offered while any session has one, so a minimum that rules
  // them all out can still be lowered.
  const logs = { pace, distance: group.distance, time: group.time }
  const metrics = CARDIO_METRICS.filter((m) =>
    m.key === 'pace' ? group.sessions.length > 0 : group[m.key].length > 0,
  )
  const [metricKey, setMetricKey] = useState(metrics[0].key)
  const metric = CARDIO_METRICS.find((m) => m.key === metricKey)
  const log = logs[metric.key]

  const changeMin = (text) => {
    setMinText(text)
    saveMinDistance(group.exerciseId, Number(text), unit)
  }

  const fastest = last(pace)
  const farthest = last(group.distance)
  const longest = last(group.time)

  const distance = (d) => (d > 0 ? `${round2(d)} ${unit}` : '—')
  const duration = (s) => (s > 0 ? formatDuration(Math.round(s)) : '—')
  const show = {
    pace: (v) => `${formatDuration(Math.round(v))} /${unit}`,
    distance,
    time: duration,
  }
  const context = (r) => (metric.key === 'distance' ? duration(r.seconds) : distance(r.distance))
  const change = (r) =>
    metric.key === 'pace'
      ? `−${formatDuration(r.change)} /${unit} (−${r.changePct}%)`
      : `+${metric.key === 'distance' ? `${round2(r.change)} ${unit}` : formatDuration(r.change)} (+${r.changePct}%)`

  const others = [
    farthest && { label: 'farthest', value: distance(farthest.value), rec: farthest },
    longest && { label: 'longest', value: duration(longest.value), rec: longest },
  ].filter(Boolean)

  return (
    <div className="rec-row">
      <div className="pr-row">
        <div>
          <button className="rec-toggle" aria-expanded={isExpanded} onClick={onToggle}>
            <Chevron open={isExpanded} />
            <span style={{ fontWeight: 600 }}>{group.name}</span>
            {min > 0 && (
              <span className="res-tag" title="Fastest pace only counts sessions at least this long">
                {min} {unit}+
              </span>
            )}
          </button>
          <div className="muted small rec-sub">
            {others.map((o, i) => (
              <span key={o.label}>
                {i > 0 && ' · '}
                {o.label}{' '}
                <Link to={`/workouts/${o.rec.workoutId}`} title={o.rec.date}>
                  {o.value}
                </Link>
              </span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {fastest ? (
            <>
              <div className="pr-value">
                {show.pace(fastest.value)}
                <span className="muted small"> over {distance(fastest.distance)}</span>
              </div>
              <Link to={`/workouts/${fastest.workoutId}`} className="small">
                {fastest.date}
              </Link>
            </>
          ) : (
            <div
              className="muted"
              title={
                min > 0
                  ? `No session of ${min} ${unit} or more with a time yet`
                  : 'Log a distance and a time to get a pace'
              }
            >
              —
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="rec-detail">
          {(metrics.length > 1 || metric.key === 'pace') && (
            <div className="row rec-metrics">
              {metrics.length > 1 &&
                metrics.map((m) => (
                  <button
                    key={m.key}
                    className={'btn small ' + (m.key === metric.key ? '' : 'ghost')}
                    aria-pressed={m.key === metric.key}
                    onClick={() => setMetricKey(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              {metric.key === 'pace' && (
                <label className="rec-min small">
                  Min distance
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="any"
                    value={minText}
                    onChange={(e) => changeMin(e.target.value)}
                  />
                  {unit}
                </label>
              )}
            </div>
          )}
          {log.length > 1 && (
            <PrChart
              label={metric.label}
              time={metric.time}
              lowerIsBetter={metric.lowerIsBetter}
              points={log.map((r) => ({
                date: r.date,
                value: metric.key === 'distance' ? round2(r.value) : r.value,
                tip: show[metric.key](r.value),
              }))}
            />
          )}
          {log.length === 0 ? (
            <div className="muted small">
              No session of {min} {unit} or more with a time yet.
            </div>
          ) : (
            <table className="rec-history">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col" className="bd-num">{metric.label}</th>
                  <th scope="col" className="bd-num">{metric.context}</th>
                  <th scope="col" className="bd-num">Change</th>
                </tr>
              </thead>
              <tbody>
                {[...log].reverse().map((r) => (
                  <tr key={`${r.date}-${r.workoutId}`}>
                    <td>
                      <Link to={`/workouts/${r.workoutId}`}>{r.date}</Link>
                    </td>
                    <td className="bd-num">{show[metric.key](r.value)}</td>
                    <td className="bd-num">{context(r)}</td>
                    <td className="bd-num">
                      {r.initial ? (
                        <span className="muted">first logged</span>
                      ) : (
                        <span className="pr-gain">{change(r)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
