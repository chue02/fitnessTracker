// Dropdown to add an exercise (strength or cardio) to the workout being built.
export default function ExercisePicker({ exercises, onPick }) {
  const strength = exercises.filter((e) => e.category === 'strength')
  const cardio = exercises.filter((e) => e.category === 'cardio')

  const handle = (e) => {
    const id = Number(e.target.value)
    if (!id) return
    const exercise = exercises.find((x) => x.id === id)
    if (exercise) onPick(exercise)
    e.target.value = ''
  }

  return (
    <select defaultValue="" onChange={handle}>
      <option value="" disabled>
        + Add exercise…
      </option>
      <optgroup label="Strength">
        {strength.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Cardio">
        {cardio.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </optgroup>
    </select>
  )
}
