import { Link } from 'react-router-dom'
import { formatDuration } from '../../format.js'
import { weekDays, weekRange, weekTotals } from '../../stats.js'

// "Sep 20 – Sep 26" from two YYYY-MM-DD strings, without going through Date
// (which would reinterpret them as UTC).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function shortDate(iso) {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

// This week at a glance: a Sun–Sat strip marking the days trained, plus totals.
export default function WeekSummary({ workouts }) {
  const range = weekRange()
  const days = weekDays(workouts, range)
  const totals = weekTotals(days)

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>This week</h2>
        <span className="muted small">
          {shortDate(range.startIso)} – {shortDate(range.endIso)}
        </span>
      </div>

      <div className="week-strip">
        {days.map((day) => {
          const cell = (
            <>
              <div className="muted small">{day.letter}</div>
              <div className="week-day-num">{day.dayOfMonth}</div>
              <div className={`dot ${day.workouts.length ? `on ${day.split}` : ''}`.trim()} />
            </>
          )
          const className = `week-day${day.isToday ? ' today' : ''}`
          // Days with a workout jump straight to it; the rest are inert.
          return day.workouts.length ? (
            <Link
              key={day.iso}
              to={`/workouts/${day.workouts[0].id}`}
              className={className}
              style={{ color: 'inherit' }}
              title={`${day.iso} · ${day.workouts.length} workout${day.workouts.length === 1 ? '' : 's'}`}
            >
              {cell}
            </Link>
          ) : (
            <div key={day.iso} className={className} title={day.iso}>
              {cell}
            </div>
          )
        })}
      </div>

      {totals.workoutCount === 0 ? (
        <div className="muted small" style={{ marginTop: 14 }}>
          Nothing logged this week yet. <Link to="/workouts/new">Start one →</Link>
        </div>
      ) : (
        <div className="stat-row">
          <Stat
            label="Workouts"
            value={totals.workoutCount}
          />
          <Stat label="Exercises" value={totals.exerciseCount} />
          {totals.workingSets > 0 && <Stat label="Working sets" value={totals.workingSets} />}
          {totals.volumeLb > 0 && (
            <Stat label="Volume" value={`${totals.volumeLb.toLocaleString()} lb`} />
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
