import { useEffect, useState } from 'react'
import { api } from '../api.js'

const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'cardio', 'other',
]
const SPLITS = ['pull', 'push', 'legs', 'core']

const COLUMNS = [
  ['name', 'Name'],
  ['category', 'Category'],
  ['muscle_group', 'Muscle group'],
  ['split', 'Split'],
  ['secondary_muscles', 'Secondary muscles'],
  ['is_custom', 'Source'],
]

export default function Exercises() {
  const [exercises, setExercises] = useState([])
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [muscleFilter, setMuscleFilter] = useState('')
  const [splitFilter, setSplitFilter] = useState('')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })

  const [name, setName] = useState('')
  const [category, setCategory] = useState('strength')
  const [muscleGroup, setMuscleGroup] = useState('other')
  const [split, setSplit] = useState('')
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
        split: category === 'cardio' ? '' : split,
        secondary_muscles: secondaryMuscles.trim(),
      })
      setName('')
      setSplit('')
      setSecondaryMuscles('')
      load()
    } catch (err) {
      setError(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail) || err.message)
    }
  }

  // Click a header to sort by it; click again to flip direction (Excel-style).
  function toggleSort(key) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    )
  }

  function compare(a, b) {
    const { key, dir } = sort
    let av = a[key]
    let bv = b[key]
    if (key === 'is_custom') {
      av = av ? 1 : 0
      bv = bv ? 1 : 0
    }
    const cmp =
      typeof av === 'number'
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''))
    return dir === 'asc' ? cmp : -cmp
  }

  const shown = exercises
    .filter((x) => filter === 'all' || x.category === filter)
    .filter((x) => !muscleFilter || x.muscle_group === muscleFilter)
    .filter((x) => !splitFilter || x.split === splitFilter)
    .sort(compare)

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
                <label>Split</label>
                <select value={split} onChange={(e) => setSplit(e.target.value)}>
                  <option value="">—</option>
                  {SPLITS.map((c) => (
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
        <span className="spacer" style={{ flex: 1 }} />
        <select value={muscleFilter} onChange={(e) => setMuscleFilter(e.target.value)}>
          <option value="">All muscles</option>
          {MUSCLE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select value={splitFilter} onChange={(e) => setSplitFilter(e.target.value)}>
          <option value="">All splits</option>
          {SPLITS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <table>
        <thead>
          <tr>
            {COLUMNS.map(([key, label]) => (
              <th
                key={key}
                onClick={() => toggleSort(key)}
                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
              >
                {label}
                {sort.key === key && <span> {sort.dir === 'asc' ? '▲' : '▼'}</span>}
              </th>
            ))}
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
              <td className="muted">{x.split || '—'}</td>
              <td className="muted small">{x.secondary_muscles || '—'}</td>
              <td className="muted small">{x.is_custom ? 'custom' : 'built-in'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
