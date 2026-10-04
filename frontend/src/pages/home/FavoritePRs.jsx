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
import { favoriteKey, MAX_FAVORITES, minDistanceLabel, minDistanceOf, saveFavorites } from '../../favorites.js'
import { EQUIPMENT_ORDER, equipmentLabel, errorMessage, formatDuration } from '../../format.js'
import { cardioRecords, distanceIn, personalRecord } from '../../stats.js'

// Personal records for the exercises the user chose as favorites (up to
// five), in their chosen order: heaviest set for strength, pace/distance/time
// bests for cardio. The card doubles as the place to pick them; the
// Exercises page can also star them.
export default function FavoritePRs({ workouts }) {
  const { user } = useAuth()
  const favorites = user.profile?.favorites ?? []
  // Cardio distances follow the unit preference: lb pairs with mi, kg with km.
  const distanceUnit = user.profile?.weight_unit === 'kg' ? 'km' : 'mi'
  const [editing, setEditing] = useState(false)

  if (editing) {
    return <FavoritesEditor favorites={favorites} distanceUnit={distanceUnit} onClose={() => setEditing(false)} />
  }

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Favorite exercises</h2>
        <button type="button" className="btn ghost small" onClick={() => setEditing(true)}>
          {favorites.length === 0 ? 'Choose favorites' : 'Edit'}
        </button>
      </div>

      {favorites.length === 0 ? (
        <div className="muted small" style={{ marginTop: 8 }}>
          Pick up to {MAX_FAVORITES} exercises to track their PRs here.
        </div>
      ) : (
        favorites.map((fav) =>
          fav.exercise_category === 'cardio' ? (
            <CardioFavoriteRow key={favoriteKey(fav)} fav={fav} workouts={workouts} unit={distanceUnit} />
          ) : (
            <FavoriteRow key={favoriteKey(fav)} fav={fav} workouts={workouts} />
          )
        )
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

const round2 = (n) => Math.round(n * 100) / 100

// Cardio has no single "heaviest", so the row carries three bests. Pace is the
// headline, labeled with the distance it was held over so a short effort can't
// pass for a long one; farthest and longest sit underneath. A minimum distance
// (e.g. "5 km+") limits the pace record to sessions at least that long.
function CardioFavoriteRow({ fav, workouts, unit }) {
  const min = minDistanceOf(fav)
  const minInUnit = min == null ? 0 : distanceIn(min, fav.min_distance_unit, unit)
  const { fastest, farthest, longest } = cardioRecords(workouts, fav.exercise, unit, minInUnit)
  const others = [
    farthest && { label: 'farthest', value: `${round2(farthest.value)} ${unit}`, rec: farthest },
    longest && { label: 'longest', value: formatDuration(Math.round(longest.value)), rec: longest },
  ].filter(Boolean)

  return (
    <div className="pr-row">
      <div>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{fav.exercise_name}</span>
          <span className="pill cardio">cardio</span>
          {min != null && (
            <span className="res-tag" title="Fastest pace only counts sessions at least this long">
              {minDistanceLabel(fav)}
            </span>
          )}
        </div>
        <div className="muted small" style={{ marginTop: 4 }}>
          {others.length === 0
            ? 'No sessions logged yet'
            : others.map((o, i) => (
                <span key={o.label}>
                  {i > 0 && ' · '}
                  {o.label}{' '}
                  <Link to={`/workouts/${o.rec.workoutId}`} title={o.rec.date}>
                    {o.value}
                  </Link>
                </span>
              ))}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {fastest ? (
          <>
            <div className="pr-value">
              {formatDuration(Math.round(fastest.value))} /{unit}
              <span className="muted small"> over {round2(fastest.distance)} {unit}</span>
            </div>
            <Link to={`/workouts/${fastest.workoutId}`} className="small">
              {fastest.date}
            </Link>
          </>
        ) : (
          // No session with both a distance and a time (that's long enough).
          <div
            className="muted"
            title={
              min == null
                ? 'Log a distance and a time to get a pace'
                : `No session of ${min} ${fav.min_distance_unit} or more with a time yet`
            }
          >
            —
          </div>
        )}
      </div>
    </div>
  )
}

// Pick and reorder the favorites, and set each one's variant: a lift's
// resistance or a cardio exercise's minimum distance. Edits a local draft;
// nothing is saved until Save.
function FavoritesEditor({ favorites, distanceUnit, onClose }) {
  const { setProfile } = useAuth()
  const [exercises, setExercises] = useState([])
  const [items, setItems] = useState(() =>
    favorites.map((f) => ({
      key: crypto.randomUUID(),
      exercise: f.exercise,
      name: f.exercise_name,
      category: f.exercise_category,
      equipment: f.equipment,
      // Kept as typed text while editing; blank means any distance.
      min_distance: minDistanceOf(f) == null ? '' : String(minDistanceOf(f)),
      min_distance_unit: minDistanceOf(f) == null ? distanceUnit : f.min_distance_unit,
    }))
  )
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const sensors = useReorderSensors()

  useEffect(() => {
    api.get('/exercises/').then(setExercises).catch((e) => setError(errorMessage(e)))
  }, [])

  const full = items.length >= MAX_FAVORITES
  const keys = items.map(favoriteKey)
  const hasDuplicate = new Set(keys).size !== keys.length

  function add(exercise) {
    const item = {
      key: crypto.randomUUID(),
      exercise: exercise.id,
      name: exercise.name,
      category: exercise.category,
      equipment: '',
      min_distance: '',
      min_distance_unit: distanceUnit,
    }
    // A plain (any resistance / any distance) copy already there is a no-op.
    setItems((list) =>
      list.length >= MAX_FAVORITES || list.some((it) => favoriteKey(it) === favoriteKey(item))
        ? list
        : [...list, item]
    )
  }

  function update(key, changes) {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...changes } : it)))
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
        <h2 style={{ margin: 0 }}>Favorite exercises</h2>
        <span className="muted small">
          {items.length} of {MAX_FAVORITES} chosen
        </span>
      </div>
      <p className="muted small">
        Leave a lift's resistance as "any" to track your best set on whatever you did it on.
        Cardio tracks your fastest pace, farthest distance and longest time; give it a minimum
        distance (say 5 km) so only sessions that long count toward the pace. Add the same
        exercise twice to track two distances.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => setItems((list) => moveByKey(list, e))}>
        <SortableContext items={items.map((it) => it.key)} strategy={verticalListSortingStrategy}>
          {items.map((it) => (
            <SortableItem key={it.key} id={it.key}>
              {(handle) => (
                <div className="exercise-block">
                  <div className="head" style={{ marginBottom: 0 }}>
                    {handle}
                    {it.category === 'cardio' && <span className="pill cardio">cardio</span>}
                    <span className="name">{it.name}</span>
                    <span className="spacer" style={{ flex: 1 }} />
                    {it.category === 'cardio' ? (
                      <span className="row" style={{ gap: 6 }}>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="min. distance"
                          title="Only sessions at least this long count toward the fastest pace. Leave blank for any distance."
                          aria-label="Minimum distance"
                          style={{ width: 120 }}
                          value={it.min_distance}
                          onChange={(e) => update(it.key, { min_distance: e.target.value })}
                        />
                        <select
                          value={it.min_distance_unit}
                          onChange={(e) => update(it.key, { min_distance_unit: e.target.value })}
                          aria-label="Minimum distance unit"
                        >
                          <option value="mi">mi</option>
                          <option value="km">km</option>
                        </select>
                      </span>
                    ) : (
                      <select value={it.equipment} onChange={(e) => update(it.key, { equipment: e.target.value })}>
                        <option value="">Any resistance</option>
                        {EQUIPMENT_ORDER.map((code) => (
                          <option key={code} value={code}>
                            {equipmentLabel(code)}
                          </option>
                        ))}
                      </select>
                    )}
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

      {hasDuplicate && <div className="error">The same favorite is listed twice.</div>}
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
