import { equipmentLabel } from '../format.js'

// The resistance a lift was done on, worn as a tag beside its name. Resistance
// is part of a movement's identity — a barbell press and a machine press are
// different lifts with different records — so it travels with the name rather
// than living in its own column.
//
// Renders nothing when the set carried no equipment, so bodyweight work reads
// as just the exercise.
export default function ResistanceTag({ equipment }) {
  if (!equipment) return null
  return <span className="res-tag">{equipmentLabel(equipment)}</span>
}
