import { useEffect, useMemo, useRef, useState } from 'react'
import { MUSCLE_ORDER } from '../format.js'

// Add an exercise to the workout via a searchable dropdown, optionally
// narrowed by primary muscle.
export default function ExercisePicker({ exercises, onPick }) {
  const [muscle, setMuscle] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  const muscles = useMemo(() => {
    const found = new Set(exercises.map((e) => e.muscle_group).filter(Boolean))
    return MUSCLE_ORDER.filter((m) => found.has(m))
  }, [exercises])

  const query = search.trim().toLowerCase()
  const matching = exercises
    .filter((e) => !muscle || e.muscle_group === muscle)
    .filter((e) => !query || e.name.toLowerCase().includes(query))
  const strength = matching.filter((e) => e.category === 'strength')
  const cardio = matching.filter((e) => e.category === 'cardio')

  // Close the list when clicking outside the picker.
  useEffect(() => {
    function onDocClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function pick(exercise) {
    onPick(exercise)
    setSearch('')
    setOpen(false)
  }

  function renderGroup(label, list) {
    if (list.length === 0) return null
    return (
      <div className="combo-group">
        <div className="combo-group-label">{label}</div>
        {list.map((e) => (
          <button
            key={e.id}
            type="button"
            className="combo-option"
            onClick={() => pick(e)}
          >
            {e.name}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="row">
      <div>
        <label>Primary muscle</label>
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="">All muscles</option>
          {muscles.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div ref={boxRef} style={{ flex: 1, minWidth: 200, position: 'relative' }}>
        <label>Exercise</label>
        <input
          type="text"
          placeholder="Search or add exercise…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          style={{ width: '100%' }}
        />
        {open && (
          <div className="combo-list">
            {matching.length === 0 ? (
              <div className="combo-empty">No exercises match</div>
            ) : (
              <>
                {renderGroup('Strength', strength)}
                {renderGroup('Cardio', cardio)}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
