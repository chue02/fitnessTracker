import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import ResistanceTag from '../components/ResistanceTag.jsx'

// Saved workout skeletons. Starting one opens the workout editor pre-filled
// with its exercises (no sets), so the user logs today's numbers from scratch.
export default function Templates() {
  const [templates, setTemplates] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/templates/').then(setTemplates).catch((e) => setError(e.message))
  }, [])

  async function remove(t) {
    if (!confirm(`Delete template "${t.name}"?`)) return
    try {
      await api.del(`/templates/${t.id}/`)
      setTemplates((ts) => ts.filter((x) => x.id !== t.id))
    } catch (e) {
      setError(e.message)
    }
  }

  if (error) return <div className="error">{error}</div>
  if (!templates) return <div className="empty">Loading…</div>

  return (
    <div>
      <div className="row between" style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Templates</h1>
        <Link to="/templates/new" className="btn small">
          + New template
        </Link>
      </div>
      {templates.length === 0 && (
        <div className="empty">
          No templates yet. Create one with <b>+ New template</b>, or open a past workout and
          choose <b>Save as template</b>.
        </div>
      )}
      {templates.map((t) => (
        <div key={t.id} className="card">
          <div className="row between">
            <span className="date">{t.name}</span>
            <span className="row">
              <Link to={`/workouts/new?template=${t.id}`} className="btn small">
                Start workout
              </Link>
              <Link to={`/templates/${t.id}/edit`} className="btn secondary small">
                Edit
              </Link>
              <button className="btn danger small" onClick={() => remove(t)}>
                Delete
              </button>
            </span>
          </div>
          <ol className="template-exercises">
            {t.exercises.map((e) => (
              <li key={e.id}>
                {e.exercise_split && <span className={`pill ${e.exercise_split}`}>{e.exercise_split}</span>}
                <span>{e.exercise_name}</span>
                <ResistanceTag equipment={e.equipment} />
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}
