import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import PrChart from '../components/PrChart.jsx'
import ResistanceTag from '../components/ResistanceTag.jsx'
import { errorMessage } from '../format.js'
import { prHistory } from '../stats.js'

// Every lift's all-time PR, per resistance, with the full log of how it got
// there. Same single /workouts/ fetch as the home page; the history is derived
// from it rather than stored, so editing or deleting a workout is reflected
// immediately.
export default function Records() {
  const { user } = useAuth()
  const unit = user.profile?.weight_unit === 'kg' ? 'kg' : 'lb'
  const [workouts, setWorkouts] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState(() => new Set()) // splits
  const [expanded, setExpanded] = useState(() => new Set()) // group keys

  useEffect(() => {
    api.get('/workouts/').then(setWorkouts).catch((e) => setError(errorMessage(e)))
  }, [])

  const groups = useMemo(() => (workouts ? prHistory(workouts) : []), [workouts])

  // prHistory already sorts by split, so sections fall out in order.
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    const bySplit = new Map()
    for (const g of groups) {
      if (q && !g.name.toLowerCase().includes(q)) continue
      const split = g.split || 'other'
      if (!bySplit.has(split)) bySplit.set(split, [])
      bySplit.get(split).push(g)
    }
    return [...bySplit]
  }, [groups, query])

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
          No strength sets logged yet. <Link to="/workouts/new">Log a workout →</Link>
        </div>
      ) : (
        <>
          <div className="row between" style={{ marginBottom: 14 }}>
            <span className="muted small">
              Heaviest set per lift and resistance. A new entry is logged each time you beat it.
            </span>
            <input
              type="search"
              placeholder="Filter exercises"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {sections.length === 0 && <div className="empty">No exercises match “{query}”.</div>}

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
                    {rows.length} {rows.length === 1 ? 'lift' : 'lifts'}
                  </span>
                </button>

                {!isCollapsed &&
                  rows.map((g) => (
                    <RecordRow
                      key={g.key}
                      group={g}
                      unit={unit}
                      isExpanded={expanded.has(g.key)}
                      onToggle={() => toggle(setExpanded, g.key)}
                    />
                  ))}
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
  const current = group.records[group.records.length - 1]
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
            set <Link to={`/workouts/${current.workoutId}`}>{current.date}</Link> · {count}{' '}
            {count === 1 ? 'record' : 'records'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="pr-value">
            {current.weight} {current.weightUnit}
            {current.bodyweight && (
              <span className="muted small" title="Your bodyweight on that day, plus any added weight">
                {' '}incl. BW
              </span>
            )}
          </div>
          <div className="muted small">
            × {current.reps} {current.reps === 1 ? 'rep' : 'reps'}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="rec-detail">
          {/* One record is a flat line — the table says it better. */}
          {count > 1 && <PrChart records={group.records} unit={unit} />}
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
