import { Link } from 'react-router-dom'
import ExerciseTags from '../../components/ExerciseTags.jsx'
import { personalRecord, topExercises } from '../../stats.js'

// Personal records for the lifts the user trains most. "Favorite" is derived
// from logged set counts rather than configured, so this works on day one.
export default function FavoritePRs({ workouts, limit = 4 }) {
  const favorites = topExercises(workouts, limit)

  if (favorites.length === 0) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Favorite exercises</h2>
        <div className="muted small">Log a few strength workouts to see PRs here.</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Favorite exercises</h2>
        <span className="muted small">Your most-trained lifts</span>
      </div>

      {favorites.map((ex) => {
        const pr = personalRecord(workouts, ex.id)
        return (
          <div key={ex.id} className="pr-row">
            <div>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{ex.name}</span>
                <ExerciseTags
                  split={ex.split}
                  muscleGroup={ex.muscleGroup}
                  secondaryMuscles={ex.secondaryMuscles}
                />
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {ex.setCount} set{ex.setCount === 1 ? '' : 's'} logged
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {pr ? (
                <>
                  <div className="pr-value">
                    {pr.weight} {pr.weightUnit}
                  </div>
                  <Link to={`/workouts/${pr.workoutId}`} className="small">
                    {pr.date}
                  </Link>
                </>
              ) : (
                // Bodyweight-only lifts have no weighted set to rank.
                <div className="muted">—</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
