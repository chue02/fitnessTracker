import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { api } from '../../api.js'
import { useAuth } from '../../auth.jsx'
import ExercisePicker from '../../components/ExercisePicker.jsx'
import ExerciseTags from '../../components/ExerciseTags.jsx'
import ResistanceTag from '../../components/ResistanceTag.jsx'
import SortableItem, { moveByKey, useReorderSensors } from '../../components/SortableItem.jsx'
import { MAX_FAVORITES, saveFavorites } from '../../favorites.js'
import { EQUIPMENT_ORDER, equipmentLabel, errorMessage } from '../../format.js'
import { personalRecord } from '../../stats.js'

// Personal records for the lifts the user chose as favorites (up to five),
// in their chosen order. The card doubles as the place to pick them; the
// Exercises page can also star them.
export default function FavoritePRs({ workouts }) {
  const { user } = useAuth()
  const favorites = user.profile?.favorites ?? []
  const [editing, setEditing] = useState(false)

  if (editing) return <FavoritesEditor favorites={favorites} onClose={() => setEditing(false)} />

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Favorite lifts</h2>
        <button type="button" className="btn ghost small" onClick={() => setEditing(true)}>
          {favorites.length === 0 ? 'Choose favorites' : 'Edit'}
        </button>
      </div>

      {favorites.length === 0 ? (
        <div className="muted small" style={{ marginTop: 8 }}>
          Pick up to {MAX_FAVORITES} lifts to track their PRs here.
        </div>
      ) : (
        favorites.map((fav) => (
          <FavoriteRow key={`${fav.exercise}::${fav.equipment}`} fav={fav} workouts={workouts} />
        ))
      )}
    </div>
  )
}

function FavoriteRow({ fav, workouts }) {
  // A favorite without a resistance takes the best set on any of them.
  const pr = personalRecord(workouts, fav.exercise, fav.equipment || null)
  return (
    <div className="pr-row">
      <div>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{fav.exercise_name}</span>
          <ResistanceTag equipment={fav.equipment} />
          <ExerciseTags
            split={fav.exercise_split}
            muscleGroup={fav.exercise_muscle_group}
            secondaryMuscles={fav.exercise_secondary_muscles}
          />
        </div>
        <div className="muted small" style={{ marginTop: 4 }}>
          {pr ? (
            <>
              {`${pr.reps} rep${pr.reps === 1 ? '' : 's'}`}
              {!fav.equipment && pr.equipment && (
                <>
                  {' on '}
                  <ResistanceTag equipment={pr.equipment} />
                </>
              )}
            </>
          ) : (
            'No working sets logged yet'
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {pr ? (
          <>
            <div className="pr-value">
              {pr.weight} {pr.weightUnit}
              {pr.bodyweight && (
                <span className="muted small" title="Your bodyweight on that day, plus any added weight">
                  {' '}incl. BW
                </span>
              )}
            </div>
            <Link to={`/workouts/${pr.workoutId}`} className="small">
              {pr.date}
            </Link>
          </>
        ) : (
          // Never logged, or only bodyweight work before any weight was on record.
          <div className="muted">—</div>
        )}
      </div>
    </div>
  )
}

// Pick, reorder and set the resistance of the favorites. Edits a local draft;
// nothing is saved until Save.
function FavoritesEditor({ favorites, onClose }) {
  const { setProfile } = useAuth()
  const [exercises, setExercises] = useState([])
  const [items, setItems] = useState(() =>
    favorites.map((f) => ({ key: crypto.randomUUID(), exercise: f.exercise, name: f.exercise_name, equipment: f.equipment }))
  )
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const sensors = useReorderSensors()

  useEffect(() => {
    // Only strength work has PRs.
    api
      .get('/exercises/')
      .then((list) => setExercises(list.filter((e) => e.category === 'strength')))
      .catch((e) => setError(errorMessage(e)))
  }, [])

  const full = items.length >= MAX_FAVORITES
  const pairs = items.map((it) => `${it.exercise}::${it.equipment}`)
  const hasDuplicate = new Set(pairs).size !== pairs.length

  function add(exercise) {
    setItems((list) =>
      list.length >= MAX_FAVORITES || list.some((it) => it.exercise === exercise.id && !it.equipment)
        ? list
        : [...list, { key: crypto.randomUUID(), exercise: exercise.id, name: exercise.name, equipment: '' }]
    )
  }

  function setEquipment(key, equipment) {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, equipment } : it)))
  }

  function remove(key) {
    setItems((list) => list.filter((it) => it.key !== key))
  }

  async function save() {
    setError(null)
    setSaving(true)
    try {
      await saveFavorites(items, setProfile)
      onClose()
    } catch (e) {
      setError(errorMessage(e))
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Favorite lifts</h2>
        <span className="muted small">
          {items.length} of {MAX_FAVORITES} chosen
        </span>
      </div>
      <p className="muted small">
        Leave the resistance as "any" to track your best set on whatever you did it on.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => setItems((list) => moveByKey(list, e))}>
        <SortableContext items={items.map((it) => it.key)} strategy={verticalListSortingStrategy}>
          {items.map((it) => (
            <SortableItem key={it.key} id={it.key}>
              {(handle) => (
                <div className="exercise-block">
                  <div className="head" style={{ marginBottom: 0 }}>
                    {handle}
                    <span className="name">{it.name}</span>
                    <span className="spacer" style={{ flex: 1 }} />
                    <select value={it.equipment} onChange={(e) => setEquipment(it.key, e.target.value)}>
                      <option value="">Any resistance</option>
                      {EQUIPMENT_ORDER.map((code) => (
                        <option key={code} value={code}>
                          {equipmentLabel(code)}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn danger small" onClick={() => remove(it.key)}>
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>

      <div style={{ margin: '12px 0' }}>
        {full ? (
          <div className="muted small">That's {MAX_FAVORITES} — remove one to add another.</div>
        ) : (
          <ExercisePicker exercises={exercises} onPick={add} />
        )}
      </div>

      {hasDuplicate && <div className="error">The same lift and resistance is listed twice.</div>}
      {error && <div className="error">{error}</div>}

      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className="btn" onClick={save} disabled={saving || hasDuplicate}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  )
}
