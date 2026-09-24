import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api.js'
import { errorMessage } from '../../format.js'
import WeekSummary from './WeekSummary.jsx'
import RecentPRs from './RecentPRs.jsx'
import FavoritePRs from './FavoritePRs.jsx'

// The home screen for a signed-in user. One fetch of the full history feeds
// every section — /workouts/ is owner-scoped and unpaginated, and each entry
// carries denormalized exercise fields, so no second request is needed.
export default function MemberHome({ user }) {
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
        <h1>Welcome back, {user.username}</h1>
        <Link to="/workouts/new" className="btn">
          + New workout
        </Link>
      </div>

      {workouts.length === 0 ? (
        <div className="empty">
          No workouts yet. <Link to="/workouts/new">Log your first one →</Link>
        </div>
      ) : (
        <>
          <WeekSummary workouts={workouts} />
          <FavoritePRs workouts={workouts} />
          <RecentPRs workouts={workouts} />
        </>
      )}
    </div>
  )
}
