// Conversions between workouts, editor blocks and templates. A template is only
// an ordered list of exercises (plus the resistance to pre-select) — never
// sets, reps or weight.

// Editor blocks -> template exercise list. A block's resistance is taken from
// its first set, if it has one.
export function blocksToTemplateExercises(blocks) {
  return blocks.map((block, order) => ({
    exercise: block.exercise.id,
    order,
    equipment: block.entries[0]?.equipment || block.defaultEquipment || '',
  }))
}

// A saved workout -> template exercise list: each exercise once, in the order
// it was first done, with the resistance of its first set.
export function workoutToTemplateExercises(workout) {
  const seen = new Set()
  const out = []
  for (const e of workout.entries) {
    if (seen.has(e.exercise)) continue
    seen.add(e.exercise)
    out.push({ exercise: e.exercise, order: out.length, equipment: e.equipment || '' })
  }
  return out
}

// A template -> editor blocks with no entries, so the user adds the first set
// themselves and later sets auto-fill from it.
export function templateToBlocks(template) {
  return template.exercises.map((t) => ({
    key: crypto.randomUUID(),
    exercise: {
      id: t.exercise,
      name: t.exercise_name,
      category: t.exercise_category,
      split: t.exercise_split,
      muscle_group: t.exercise_muscle_group,
      secondary_muscles: t.exercise_secondary_muscles,
    },
    defaultEquipment: t.equipment || '',
    entries: [],
  }))
}
