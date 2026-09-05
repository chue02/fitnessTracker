import { useEffect, useState } from 'react'
import { api } from '../api.js'

const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'cardio', 'other',
]
const CIRCUITS = ['pull', 'push', 'legs', 'core']

export default function Exercises() {
  const [exercises, setExercises] = useState([])
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  const [name, setName] = useState('')
  const [category, setCategory] = useState('strength')
  const [muscleGroup, setMuscleGroup] = useState('other')
  const [circuit, setCircuit] = useState('')
  const [secondaryMuscles, setSecondaryMuscles] = useState('')

  function load() {
    api.get('/exercises/').then(setExercises).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  async function addExercise(e) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return
    try {
      await api.post('/exercises/', {
        name: name.trim(),
        category,
        muscle_group: category === 'cardio' ? 'cardio' : muscleGroup,
        circuit: category === 'cardio' ? '' : circuit,
        secondary_muscles: secondaryMuscles.trim(),
      })
      setName('')
      setCircuit('')
      setSecondaryMuscles('')
      load()
    } catch (err) {
      setError(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail) || err.message)
    }
  }

  const shown = exercises.filter((x) => filter === 'all' || x.category === filter)

  return (
    <div>
      <h1>Exercises</h1>

      <form className="card" onSubmit={addExercise}>
        <h2 style={{ marginTop: 0 }}>Add a custom exercise</h2>
        <div className="row">
          <div style={{ flex: 1, minWidth: 200 }}>
            <label>Name</label>
            <input
              type="text"
              style={{ width: '100%' }}
              placeholder="e.g. Hack Squat"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="strength">Strength</option>
              <option value="cardio">Cardio</option>
            </select>
          </div>
          {category === 'strength' && (
            <>
              <div>
                <label>Muscle group</label>
                <select value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)}>
                  {MUSCLE_GROUPS.filter((g) => g !== 'cardio').map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Circuit</label>
                <select value={circuit} onChange={(e) => setCircuit(e.target.value)}>
                  <option value="">—</option>
                  {CIRCUITS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label>Secondary muscles</label>
                <input
                  type="text"
                  style={{ width: '100%' }}
                  placeholder="e.g. Lats, Biceps"
                  value={secondaryMuscles}
                  onChange={(e) => setSecondaryMuscles(e.target.value)}
                />
              </div>
            </>
          )}
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn" type="submit">
              Add
            </button>
          </div>
        </div>
        {error && <div className="error">{error}</div>}
      </form>

      <div className="row" style={{ margin: '4px 0 12px' }}>
        {['all', 'strength', 'cardio'].map((f) => (
          <button
            key={f}
            className={'btn small ' + (filter === f ? '' : 'ghost')}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Muscle group</th>
            <th>Circuit</th>
            <th>Secondary muscles</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((x) => (
            <tr key={x.id}>
              <td>{x.name}</td>
              <td>
                <span className={`pill ${x.category}`}>{x.category}</span>
              </td>
              <td className="muted">{x.muscle_group}</td>
              <td className="muted">{x.circuit || '—'}</td>
              <td className="muted small">{x.secondary_muscles || '—'}</td>
              <td className="muted small">{x.is_custom ? 'custom' : 'built-in'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
