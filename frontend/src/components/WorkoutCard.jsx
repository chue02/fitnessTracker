import { Link } from 'react-router-dom'
import { workoutSummary } from '../format.js'

// One workout as a clickable summary card: date, category/split pills, the top
// muscles worked, and counts. Shared by the journal and the home screen.
export default function WorkoutCard({ workout }) {
  const exercises = new Set(workout.entries.map((e) => e.exercise))
  const hasStrength = workout.entries.some((e) => e.exercise_category === 'strength')
  const hasCardio = workout.entries.some((e) => e.exercise_category === 'cardio')
  const { split, muscles } = workoutSummary(workout.entries)

  return (
    <Link to={`/workouts/${workout.id}`} style={{ color: 'inherit' }}>
      <div className="card">
        <div className="row between">
          <span className="date">{workout.date}</span>
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
          {workout.entries.length} entr{workout.entries.length === 1 ? 'y' : 'ies'}
        </div>
        {workout.notes && (
          <div className="small" style={{ marginTop: 6 }}>
            {workout.notes}
          </div>
        )}
      </div>
    </Link>
  )
}
