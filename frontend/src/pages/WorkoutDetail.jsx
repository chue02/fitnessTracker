import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { describeEntry } from '../format.js'
import ExerciseTags from '../components/ExerciseTags.jsx'

// Group a workout's flat entry list by exercise, preserving order.
function groupByExercise(entries) {
  const groups = []
  const byId = new Map()
  for (const e of entries) {
    if (!byId.has(e.exercise)) {
      const g = {
        exercise: e.exercise,
        name: e.exercise_name,
        category: e.exercise_category,
        split: e.exercise_split,
        muscleGroup: e.exercise_muscle_group,
        secondaryMuscles: e.exercise_secondary_muscles,
        entries: [],
      }
      byId.set(e.exercise, g)
      groups.push(g)
    }
    byId.get(e.exercise).entries.push(e)
  }
  return groups
}

export default function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get(`/workouts/${id}/`).then(setWorkout).catch((e) => setError(e.message))
  }, [id])

  async function remove() {
    if (!confirm('Delete this workout?')) return
    try {
      await api.del(`/workouts/${id}/`)
      navigate('/')
    } catch (e) {
      setError(e.message)
    }
  }

  if (error) return <div className="error">{error}</div>
  if (!workout) return <div className="empty">Loading…</div>

  const groups = groupByExercise(workout.entries)

  return (
    <div>
      <div className="row between">
        <h1 style={{ margin: 0 }}>{workout.date}</h1>
        <div className="row">
          <button className="btn secondary small" onClick={() => navigate(`/workouts/${id}/edit`)}>
            Edit
          </button>
          <button className="btn danger small" onClick={remove}>
            Delete
          </button>
        </div>
      </div>
      {workout.notes && <p className="muted">{workout.notes}</p>}

      {groups.length === 0 && <div className="empty">This workout has no entries.</div>}

      {groups.map((g) => (
        <div key={g.exercise} className="exercise-block">
          <div className="head">
            <span className={`pill ${g.category}`}>{g.category}</span>
            {g.split && <span className={`pill ${g.split}`}>{g.split}</span>}
            <span className="name">{g.name}</span>
            <ExerciseTags
              split={g.split}
              muscleGroup={g.muscleGroup}
              secondaryMuscles={g.secondaryMuscles}
            />
          </div>
          <table>
            <tbody>
              {g.entries.map((e, i) => (
                <tr key={e.id}>
                  <td className="muted" style={{ width: 30 }}>
                    {i + 1}
                  </td>
                  <td>{describeEntry(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <button className="btn ghost" onClick={() => navigate('/')} style={{ marginTop: 12 }}>
        ← Back to history
      </button>
    </div>
  )
}
