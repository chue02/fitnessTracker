import { Link } from 'react-router-dom'
import WorkoutCard from '../../components/WorkoutCard.jsx'

// The tail of the journal. The API already returns workouts newest first.
export default function RecentWorkouts({ workouts, limit = 3 }) {
  const recent = workouts.slice(0, limit)

  return (
    <div>
      <div className="row between">
        <h2>Recent workouts</h2>
        <Link to="/journal" className="small">
          View all →
        </Link>
      </div>
      {recent.map((w) => (
        <WorkoutCard key={w.id} workout={w} />
      ))}
    </div>
  )
}
