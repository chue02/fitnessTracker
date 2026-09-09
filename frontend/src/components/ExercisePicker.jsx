import { useEffect, useMemo, useRef, useState } from 'react'
import { MUSCLE_ORDER, MUSCLE_TO_SPLIT, SPLIT_ORDER } from '../format.js'

// Add an exercise to the workout via a searchable dropdown, optionally
// narrowed by split.
export default function ExercisePicker({ exercises, onPick }) {
  const [split, setSplit] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  const splits = useMemo(() => {
    const found = new Set(
      exercises.map((e) => MUSCLE_TO_SPLIT[e.muscle_group]).filter(Boolean)
    )
    const list = SPLIT_ORDER.filter((s) => found.has(s))
    if (exercises.some((e) => e.category === 'cardio')) list.push('cardio')
    return list
  }, [exercises])

  const query = search.trim().toLowerCase()
  const matching = exercises
    .filter((e) =>
      !split ||
      (split === 'cardio'
        ? e.category === 'cardio'
        : MUSCLE_TO_SPLIT[e.muscle_group] === split)
    )
    .filter((e) => !query || e.name.toLowerCase().includes(query))

  // Group matches by primary muscle (cardio exercises fall under "cardio").
  const groups = MUSCLE_ORDER
    .map((muscle) => [muscle, matching.filter((e) => e.muscle_group === muscle)])
    .filter(([, list]) => list.length > 0)

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

  return (
    <div className="row">
      <div>
        <label>Split</label>
        <select value={split} onChange={(e) => setSplit(e.target.value)}>
          <option value="">All splits</option>
          {splits.map((s) => (
            <option key={s} value={s}>
              {s}
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
            {groups.length === 0 ? (
              <div className="combo-empty">No exercises match</div>
            ) : (
              groups.map(([muscle, list]) => (
                <div key={muscle} className="combo-group">
                  <div className="combo-group-label">{muscle}</div>
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
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
