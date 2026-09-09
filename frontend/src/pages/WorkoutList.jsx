import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { workoutSummary } from '../format.js'

export default function WorkoutList() {
  const [workouts, setWorkouts] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/workouts/').then(setWorkouts).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="error">{error}</div>
  if (workouts === null) return <div className="empty">Loading…</div>

  return (
    <div>
      <div className="row between">
        <h1>Workout history</h1>
        <Link to="/workouts/new" className="btn">
          + New workout
        </Link>
      </div>

      {workouts.length === 0 ? (
        <div className="empty">
          No workouts yet. <Link to="/workouts/new">Log your first one →</Link>
        </div>
      ) : (
        workouts.map((w) => {
          const exercises = new Set(w.entries.map((e) => e.exercise))
          const hasStrength = w.entries.some((e) => e.exercise_category === 'strength')
          const hasCardio = w.entries.some((e) => e.exercise_category === 'cardio')
          const { split, muscles } = workoutSummary(w.entries)
          return (
            <Link key={w.id} to={`/workouts/${w.id}`} style={{ color: 'inherit' }}>
              <div className="card">
                <div className="row between">
                  <span className="date">{w.date}</span>
                  <span className="row">
                    {hasStrength && <span className="pill strength">strength</span>}
                    {hasCardio && <span className="pill cardio">cardio</span>}
                    {split && <span className={`pill ${split}`}>{split}</span>}
                    {muscles.map((m) => (
                      <span key={m.name} className={`muscle primary ${m.split}`.trim()}>
                        {m.name}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="muted small" style={{ marginTop: 6 }}>
                  {exercises.size} exercise{exercises.size === 1 ? '' : 's'} ·{' '}
                  {w.entries.length} entr{w.entries.length === 1 ? 'y' : 'ies'}
                </div>
                {w.notes && (
                  <div className="small" style={{ marginTop: 6 }}>
                    {w.notes}
                  </div>
                )}
              </div>
            </Link>
          )
        })
      )}
    </div>
  )
}
