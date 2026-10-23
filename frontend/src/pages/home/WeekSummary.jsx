import { Link } from 'react-router-dom'
import DayCell from '../../components/DayCell.jsx'
import { formatDuration, monthLabel, shortDate } from '../../format.js'
import {
  isoDate, monthKey, summarizeWorkouts, weekDays, weekRange, weekTotals,
} from '../../stats.js'

// `delta` is the change from the same stat a week earlier; null hides the line.
// Up reads green, down reads muted grey rather than red — a deload week isn't a
// failure, and the arrow already carries the direction.
function Stat({ label, value, delta = null, format = (n) => n }) {
  return (
    <div className="stat">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
      {delta !== null && delta !== 0 && (
        <div className={`stat-delta small${delta > 0 ? ' up' : ''}`}>
          {delta > 0 ? '▲ +' : '▼ -'}
          {format(Math.abs(delta))}
        </div>
      )}
    </div>
  )
}

// This week at a glance: a Sun–Sat strip marking the days trained, plus totals
// and a way into this month's summary.
export default function WeekSummary({ workouts }) {
  const today = new Date()
  const range = weekRange(today)
  const days = weekDays(workouts, range, today)
  const totals = weekTotals(days)

  // Last week, for the deltas.
  const prevRange = weekRange(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7))
  const prev = summarizeWorkouts(workouts.filter((w) => w.date >= prevRange.startIso && w.date <= prevRange.endIso))
  // Against an empty week every stat is "+everything" — noise on a new account.
  const delta = (key) => (prev.workoutCount > 0 ? totals[key] - prev[key] : null)

  const month = monthKey(isoDate(today))

  return (
    <div className="card">
      <div className="row between">
        <span className="row" style={{ gap: 10, alignItems: 'baseline' }}>
          <h2 style={{ margin: 0 }}>This week</h2>
          <span className="muted small">
            {shortDate(range.startIso)} – {shortDate(range.endIso)}
          </span>
        </span>
        <Link to={`/journal/${month}`} className="btn small ghost">
          {monthLabel(month, { short: true })} summary →
        </Link>
      </div>

      <div className="week-strip">
        {days.map((day) => (
          <DayCell key={day.iso} day={day} showLetter />
        ))}
      </div>

      {totals.workoutCount === 0 ? (
        <div className="muted small" style={{ marginTop: 14 }}>
          Nothing logged this week yet. <Link to="/workouts/new">Start one →</Link>
        </div>
      ) : (
        <div className="stat-row">
          <Stat label="Workouts" value={totals.workoutCount} delta={delta('workoutCount')} />
          <Stat label="Exercises" value={totals.exerciseCount} />
          {totals.workingSets > 0 && (
            <Stat label="Working sets" value={totals.workingSets} delta={delta('workingSets')} />
          )}
          {totals.volumeLb > 0 && (
            <Stat
              label="Volume"
              value={`${totals.volumeLb.toLocaleString()} lb`}
              delta={delta('volumeLb')}
              format={(n) => `${n.toLocaleString()} lb`}
            />
          )}
          {totals.cardioSeconds > 0 && (
            <Stat label="Cardio time" value={formatDuration(totals.cardioSeconds)} />
          )}
          {totals.cardioDistanceMi > 0 && (
            <Stat label="Cardio dist." value={`${totals.cardioDistanceMi.toFixed(1)} mi`} />
          )}
        </div>
      )}
    </div>
  )
}
