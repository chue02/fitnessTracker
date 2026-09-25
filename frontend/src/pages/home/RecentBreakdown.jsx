import { useState } from 'react'
import ResistanceTag from '../../components/ResistanceTag.jsx'
import { weeklyBreakdown } from '../../stats.js'

const WINDOW_DAYS = 7
const COLUMNS = 6

// At most one decimal, with a trailing ".0" trimmed — 32.5 stays 32.5, 40.0
// becomes 40. Null means there was nothing to measure (e.g. bodyweight only).
function num(n) {
  if (n == null) return '—'
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

// A pivot of the last week's lifting, by exercise or by muscle. Modelled on the
// user's spreadsheet: Lbs Wtd Avg is Σ(weight × reps) / Σ(reps), i.e. volume per
// rep, not a flat mean of the set weights.
export default function RecentBreakdown({ workouts }) {
  const [by, setBy] = useState('exercise')
  const [collapsed, setCollapsed] = useState(() => new Set())

  const sections = weeklyBreakdown(workouts, { by, days: WINDOW_DAYS })
  const byMuscle = by === 'muscle'

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
            className={`btn small${byMuscle ? ' ghost' : ''}`}
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
              <th>{byMuscle ? 'Muscle' : 'Exercise'}</th>
              <th className="bd-num">Max lb</th>
              <th className="bd-num">Wtd avg</th>
              <th className="bd-num">Sets</th>
              <th className="bd-num">Reps</th>
              <th className="bd-num">Reps/set</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <Section
                key={section.split}
                section={section}
                byMuscle={byMuscle}
                isCollapsed={collapsed.has(section.split)}
                onToggle={() => toggle(section.split)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Section({ section, byMuscle, isCollapsed, onToggle }) {
  return (
    <>
      <tr className="bd-split">
        <th colSpan={COLUMNS} scope="rowgroup">
          <button
            className="bd-toggle"
            aria-expanded={!isCollapsed}
            onClick={onToggle}
          >
            <span className="bd-caret">{isCollapsed ? '▸' : '▾'}</span>
            <span className={`pill ${section.split}`}>{section.split}</span>
          </button>
        </th>
      </tr>

      {!isCollapsed &&
        section.rows.map((row) => (
          <tr key={row.key}>
            <td className={byMuscle ? 'bd-muscle' : ''}>
              {row.label}
              {!byMuscle && <ResistanceTag equipment={row.group} />}
            </td>
            <td className="bd-num">{num(row.maxLb)}</td>
            <td className="bd-num">{num(row.wtdAvgLb)}</td>
            <td className="bd-num">{row.sets}</td>
            <td className="bd-num">{row.reps}</td>
            <td className="bd-num">{num(row.avgRepsPerSet)}</td>
          </tr>
        ))}
    </>
  )
}
