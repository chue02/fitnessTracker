// The muscles an exercise works, with primary vs secondary made visually
// distinct. The primary chip is tinted by split. Shared by the workout
// builder and the saved-workout view. (The split pill itself is rendered in
// the block header, between the category pill and the exercise name.)
export default function ExerciseTags({ split, muscleGroup, secondaryMuscles }) {
  const secondaries = (secondaryMuscles || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const showPrimary = muscleGroup && muscleGroup !== 'cardio'

  return (
    <span className="exercise-tags">
      {showPrimary && (
        <span className={`muscle primary ${split || ''}`.trim()} title="Primary muscle">
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
