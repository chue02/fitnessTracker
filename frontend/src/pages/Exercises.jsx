import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { MUSCLE_ORDER, MUSCLE_TO_SPLIT, SPLIT_ORDER } from '../format.js'

// Split is derived from muscle group, so it isn't an input — only muscle is.
const rankOf = (order, v) => {
  const i = order.indexOf(v)
  return i === -1 ? order.length : i
}

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
  // Single mutually-exclusive filter: 'all' | category (strength/cardio) | split.
  const [filter, setFilter] = useState('all')
  const [muscleFilter, setMuscleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })

  const [name, setName] = useState('')
  const [category, setCategory] = useState('strength')
  const [muscleGroup, setMuscleGroup] = useState('other')
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
        secondary_muscles: secondaryMuscles.trim(),
      })
      setName('')
      setSecondaryMuscles('')
      load()
    } catch (err) {
      setError(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail) || err.message)
    }
  }

  // When the active filter is a split, muscle options narrow to that split.
  const activeSplit = SPLIT_ORDER.includes(filter) ? filter : ''
  const muscleOptions = activeSplit
    ? MUSCLE_ORDER.filter((m) => MUSCLE_TO_SPLIT[m] === activeSplit)
    : MUSCLE_ORDER

  // Cardio has no muscles; a split clears a muscle that no longer belongs to it.
  function changeFilter(next) {
    setFilter(next)
    const nextSplit = SPLIT_ORDER.includes(next) ? next : ''
    if (
      next === 'cardio' ||
      (muscleFilter && nextSplit && MUSCLE_TO_SPLIT[muscleFilter] !== nextSplit)
    ) {
      setMuscleFilter('')
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
    let cmp
    if (key === 'split') {
      // split -> muscle -> name (split and muscle by canonical, split-major order).
      cmp =
        rankOf(SPLIT_ORDER, a.split) - rankOf(SPLIT_ORDER, b.split) ||
        rankOf(MUSCLE_ORDER, a.muscle_group) - rankOf(MUSCLE_ORDER, b.muscle_group) ||
        a.name.localeCompare(b.name)
    } else if (key === 'muscle_group') {
      // Muscle order is split-major, so this groups by split then muscle.
      cmp =
        rankOf(MUSCLE_ORDER, a.muscle_group) - rankOf(MUSCLE_ORDER, b.muscle_group) ||
        a.name.localeCompare(b.name)
    } else if (key === 'is_custom') {
      cmp = (a.is_custom ? 1 : 0) - (b.is_custom ? 1 : 0) || a.name.localeCompare(b.name)
    } else {
      cmp = String(a[key] ?? '').localeCompare(String(b[key] ?? ''))
    }
    return dir === 'asc' ? cmp : -cmp
  }

  const query = search.trim().toLowerCase()
  const shown = exercises
    .filter((x) => filter === 'all' || x.category === filter || x.split === filter)
    .filter((x) => !muscleFilter || x.muscle_group === muscleFilter)
    .filter((x) => !query || x.name.toLowerCase().includes(query))
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
              placeholder="e.g. Chest Press"
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
                  {MUSCLE_ORDER.filter((g) => g !== 'cardio').map((g) => (
                    <option key={g} value={g}>
                      {g}
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
        <input
          type="text"
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 200 }}
        />
        {['all', 'strength', 'cardio', ...SPLIT_ORDER].map((f) => (
          <button
            key={f}
            className={'btn small ' + (filter === f ? '' : 'ghost')}
            onClick={() => changeFilter(f)}
          >
            {f}
          </button>
        ))}
        <span className="spacer" style={{ flex: 1 }} />
        <select
          value={muscleFilter}
          onChange={(e) => setMuscleFilter(e.target.value)}
          disabled={filter === 'cardio'}
        >
          <option value="">{filter === 'cardio' ? 'cardio' : 'All muscles'}</option>
          {muscleOptions.map((g) => (
            <option key={g} value={g}>
              {g}
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
