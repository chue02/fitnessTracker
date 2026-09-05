import { useMemo, useState } from 'react'

// Canonical ordering so the filter dropdown reads sensibly.
const MUSCLE_ORDER = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'cardio', 'other',
]

// Add an exercise to the workout, narrowing the list by primary muscle.
export default function ExercisePicker({ exercises, onPick }) {
  const [muscle, setMuscle] = useState('')

  const muscles = useMemo(() => {
    const found = new Set(exercises.map((e) => e.muscle_group).filter(Boolean))
    return MUSCLE_ORDER.filter((m) => found.has(m))
  }, [exercises])

  const matching = exercises.filter((e) => !muscle || e.muscle_group === muscle)
  const strength = matching.filter((e) => e.category === 'strength')
  const cardio = matching.filter((e) => e.category === 'cardio')

  const handle = (e) => {
    const id = Number(e.target.value)
    if (!id) return
    const exercise = exercises.find((x) => x.id === id)
    if (exercise) onPick(exercise)
    e.target.value = ''
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
      <div style={{ flex: 1, minWidth: 200 }}>
        <label>Exercise</label>
        <select value="" onChange={handle} style={{ width: '100%' }}>
          <option value="" disabled>
            {matching.length ? '+ Add exercise…' : 'No exercises match'}
          </option>
          {strength.length > 0 && (
            <optgroup label="Strength">
              {strength.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          )}
          {cardio.length > 0 && (
            <optgroup label="Cardio">
              {cardio.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
    </div>
  )
}
