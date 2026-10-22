import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { errorMessage, monthLabel } from '../format.js'
import { distanceIn, groupByMonth, summarizeWorkouts } from '../stats.js'
import WorkoutCard from '../components/WorkoutCard.jsx'

// The banner above each month's workouts. The whole bar links to that month's
// summary page.
function MonthDivider({ month, workouts }) {
  const { user } = useAuth()
  const distanceUnit = user.profile?.weight_unit === 'kg' ? 'km' : 'mi'
  const totals = summarizeWorkouts(workouts)
  const bits = [`${totals.workoutCount} workout${totals.workoutCount === 1 ? '' : 's'}`]
  if (totals.workingSets > 0) bits.push(`${totals.workingSets} sets`)
  if (totals.volumeLb > 0) bits.push(`${totals.volumeLb.toLocaleString()} lb`)
  if (totals.cardioDistanceMi > 0) {
    bits.push(`${distanceIn(totals.cardioDistanceMi, 'mi', distanceUnit).toFixed(1)} ${distanceUnit}`)
  }

  return (
    <Link to={`/journal/${month}`} className="month-divider" title="See this month's summary">
      <span className="month-badge">
        <span className="month-badge-name">{monthLabel(month, { short: true })}</span>
        <span className="month-badge-year">{month.slice(0, 4)}</span>
      </span>
      <span className="month-divider-text">
        <span className="text">{bits.join(' · ')}</span>
      </span>
      <span className="month-divider-cta">Summary →</span>
    </Link>
  )
}

export default function WorkoutList() {
  const [workouts, setWorkouts] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/workouts/').then(setWorkouts).catch((e) => setError(errorMessage(e)))
  }, [])

  if (error) return <div className="error">{error}</div>
  if (workouts === null) return <div className="empty">Loading…</div>

  return (
    <div>
      <div className="row between">
        <h1>Workout journal</h1>
        <Link to="/workouts/new" className="btn">
          + New workout
        </Link>
      </div>

      {workouts.length === 0 ? (
        <div className="empty">
          No workouts yet. <Link to="/workouts/new">Log your first one →</Link>
        </div>
      ) : (
        groupByMonth(workouts).map((g) => (
          <section key={g.month} className="month-group">
            <MonthDivider month={g.month} workouts={g.workouts} />
            {g.workouts.map((w) => (
              <WorkoutCard key={w.id} workout={w} />
            ))}
          </section>
        ))
      )}
    </div>
  )
}
