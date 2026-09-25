import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { errorMessage } from '../format.js'
import WorkoutCard from '../components/WorkoutCard.jsx'

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
        workouts.map((w) => <WorkoutCard key={w.id} workout={w} />)
      )}
    </div>
  )
}
