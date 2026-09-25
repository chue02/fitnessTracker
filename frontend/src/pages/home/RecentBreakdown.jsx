import { useState } from 'react'
import { equipmentLabel } from '../../format.js'
import { weeklyBreakdown } from '../../stats.js'

const WINDOW_DAYS = 7

// At most one decimal, with a trailing ".0" trimmed — 32.5 stays 32.5, 40.0
// becomes 40. Null means there was nothing to measure (e.g. bodyweight only).
function num(n) {
  if (n == null) return '—'
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function StatCells({ stats }) {
  return (
    <>
      <td className="bd-num">{num(stats.maxLb)}</td>
      <td className="bd-num">{num(stats.wtdAvgLb)}</td>
      <td className="bd-num">{stats.sets}</td>
      <td className="bd-num">{stats.reps}</td>
      <td className="bd-num">{num(stats.avgRepsPerSet)}</td>
    </>
  )
}

// A pivot of the last week's lifting, by resistance+exercise or by muscle.
// Modelled on the user's spreadsheet: Lbs Wtd Avg is Σ(weight × reps) / Σ(reps),
// i.e. volume per rep, not a flat mean of the set weights.
export default function RecentBreakdown({ workouts }) {
  const [by, setBy] = useState('exercise')
  const [collapsed, setCollapsed] = useState(() => new Set())

  const sections = weeklyBreakdown(workouts, { by, days: WINDOW_DAYS })
  const byMuscle = by === 'muscle'
  // Muscle view drops the resistance column.
  const labelSpan = byMuscle ? 1 : 2

  function toggle(split) {
    const next = new Set(collapsed)
    if (next.has(split)) next.delete(split)
    else next.add(split)
    setCollapsed(next)
  }

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Last {WINDOW_DAYS} days</h2>
        <span className="row" style={{ gap: 6 }}>
          <button
            className={`btn small${by === 'exercise' ? '' : ' ghost'}`}
            onClick={() => setBy('exercise')}
          >
            By exercise
          </button>
          <button
            className={`btn small${byMuscle ? '' : ' ghost'}`}
            onClick={() => setBy('muscle')}
          >
            By muscle
          </button>
        </span>
      </div>

      {sections.length === 0 ? (
        <div className="muted small" style={{ marginTop: 14 }}>
          No strength sets logged in the last {WINDOW_DAYS} days.
        </div>
      ) : (
        <table className="breakdown">
          <thead>
            <tr>
              {byMuscle ? (
                <th>Muscle</th>
              ) : (
                <>
                  <th>Resistance</th>
                  <th>Exercise</th>
                </>
              )}
              <th className="bd-num">Max lb</th>
              <th className="bd-num">Wtd avg</th>
              <th className="bd-num">Sets</th>
              <th className="bd-num">Reps</th>
              <th className="bd-num">Reps/set</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => {
              const isCollapsed = collapsed.has(section.split)
              return (
                <Section
                  key={section.split}
                  section={section}
                  byMuscle={byMuscle}
                  labelSpan={labelSpan}
                  isCollapsed={isCollapsed}
                  onToggle={() => toggle(section.split)}
                />
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Section({ section, byMuscle, labelSpan, isCollapsed, onToggle }) {
  return (
    <>
      {/* The split's subtotal rides on the header rather than sitting in a
          footer row, so the numbers stay visible while the group is collapsed. */}
      <tr className="bd-split" onClick={onToggle}>
        <th colSpan={labelSpan} scope="rowgroup">
          <button
            className="bd-toggle"
            aria-expanded={!isCollapsed}
            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${section.split}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
          <span className={`pill ${section.split}`}>{section.split}</span>
        </th>
        <StatCells stats={section.totals} />
      </tr>

      {!isCollapsed &&
        section.rows.map((row, i) => (
          <tr key={row.key}>
            {!byMuscle && (
              // Repeat the resistance only when it changes, as the sheet does.
              <td className="bd-group muted small">
                {i === 0 || section.rows[i - 1].group !== row.group
                  ? equipmentLabel(row.group) || '—'
                  : ''}
              </td>
            )}
            <td className={byMuscle ? 'bd-muscle' : ''}>{row.label}</td>
            <StatCells stats={row} />
          </tr>
        ))}
    </>
  )
}
