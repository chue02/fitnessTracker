// The muscles an exercise works, with primary vs secondary made visually
// distinct. The primary chip is tinted by circuit. Shared by the workout
// builder and the saved-workout view. (The circuit pill itself is rendered in
// the block header, between the category pill and the exercise name.)
export default function ExerciseTags({ circuit, muscleGroup, secondaryMuscles }) {
  const secondaries = (secondaryMuscles || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const showPrimary = muscleGroup && muscleGroup !== 'cardio'

  return (
    <span className="exercise-tags">
      {showPrimary && (
        <span className={`muscle primary ${circuit || ''}`.trim()} title="Primary muscle">
          {muscleGroup}
        </span>
      )}
      {secondaries.map((m) => (
        <span key={m} className="muscle secondary" title="Secondary muscle">
          {m}
        </span>
      ))}
    </span>
  )
}
