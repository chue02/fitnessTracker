import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { api } from '../api.js'
import ExercisePicker from '../components/ExercisePicker.jsx'
import ExerciseTags from '../components/ExerciseTags.jsx'
import SetRow from '../components/SetRow.jsx'
import CardioRow from '../components/CardioRow.jsx'
import SortableItem, { moveByKey, useReorderSensors } from '../components/SortableItem.jsx'
import SaveAsTemplate from '../components/SaveAsTemplate.jsx'
import { describeEntry, isoDate } from '../format.js'
import { blocksToTemplateExercises, templateToBlocks } from '../templates.js'

function blankStrengthEntry(equipment = '') {
  return { reps: null, weight: null, weight_unit: 'lb', equipment, is_warmup: false }
}
function blankCardioEntry() {
  return { distance: null, distance_unit: 'mi', duration_seconds: null, avg_heart_rate: null }
}

// Rebuild the editable block/entry structure from a saved workout's flat entry
// list, grouping consecutive entries by exercise and keeping only the editable
// fields (denormalized read-only fields are dropped).
function workoutToBlocks(workout) {
  const byId = new Map()
  const blocks = []
  for (const e of workout.entries) {
    if (!byId.has(e.exercise)) {
      const block = {
        key: crypto.randomUUID(),
        exercise: {
          id: e.exercise,
          name: e.exercise_name,
          category: e.exercise_category,
          split: e.exercise_split,
          muscle_group: e.exercise_muscle_group,
          secondary_muscles: e.exercise_secondary_muscles,
        },
        entries: [],
      }
      byId.set(e.exercise, block)
      blocks.push(block)
    }
    byId.get(e.exercise).entries.push(
      e.exercise_category === 'cardio'
        ? {
            distance: e.distance,
            distance_unit: e.distance_unit,
            duration_seconds: e.duration_seconds,
            avg_heart_rate: e.avg_heart_rate,
          }
        : {
            reps: e.reps,
            weight: e.weight,
            weight_unit: e.weight_unit,
            equipment: e.equipment ?? '',
            is_warmup: e.is_warmup,
          }
    )
  }
  return blocks
}

export default function NewWorkout() {
  const navigate = useNavigate()
  // Present when editing an existing workout; absent when creating a new one.
  const { id } = useParams()
  // `?template=<id>` pre-fills a new workout from a template.
  const [searchParams] = useSearchParams()
  const templateParam = searchParams.get('template')
  const [templates, setTemplates] = useState([])
  const [exercises, setExercises] = useState([])
  // Local today, not UTC — an evening workout must not date itself tomorrow.
  const [date, setDate] = useState(() => isoDate(new Date()))
  const [notes, setNotes] = useState('')
  // Each block groups one exercise with its entries (sets/segments).
  const [blocks, setBlocks] = useState([])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  // The block currently expanded for editing; others render condensed. Also
  // hides the picker (replaced by Done) while a block is being edited.
  const [activeKey, setActiveKey] = useState(null)

  useEffect(() => {
    api.get('/exercises/').then(setExercises).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (id) return
    api.get('/templates/').then(setTemplates).catch((e) => setError(e.message))
  }, [id])

  useEffect(() => {
    if (id || !templateParam) return
    api
      .get(`/templates/${templateParam}/`)
      .then((t) => setBlocks(templateToBlocks(t)))
      .catch((e) => setError(e.message))
  }, [id, templateParam])

  function applyTemplate(templateId) {
    const t = templates.find((x) => String(x.id) === templateId)
    if (!t) return
    if (blocks.length > 0 && !confirm(`Replace the current exercises with "${t.name}"?`)) return
    setBlocks(templateToBlocks(t))
    setActiveKey(null)
  }

  const sensors = useReorderSensors()

  function handleDragEnd(event) {
    setBlocks((b) => moveByKey(b, event))
  }

  // When editing, load the existing workout and hydrate the form from it.
  useEffect(() => {
    if (!id) return
    api
      .get(`/workouts/${id}/`)
      .then((w) => {
        setDate(w.date)
        setNotes(w.notes ?? '')
        setBlocks(workoutToBlocks(w))
      })
      .catch((e) => setError(e.message))
  }, [id])

  function addExercise(exercise) {
    const first =
      exercise.category === 'cardio' ? blankCardioEntry() : blankStrengthEntry()
    const key = crypto.randomUUID()
    setBlocks((b) => [...b, { key, exercise, entries: [first] }])
    setActiveKey(key)
  }

  function updateBlock(key, updater) {
    setBlocks((b) => b.map((blk) => (blk.key === key ? updater(blk) : blk)))
  }

  function addEntry(block) {
    // Default a new set/segment to the previous entry's values so users don't
    // re-enter the same reps/weight (or distance/duration) every time. The
    // first set of a template exercise starts blank but keeps its resistance.
    const last = block.entries[block.entries.length - 1]
    const entry = last
      ? { ...last }
      : block.exercise.category === 'cardio'
        ? blankCardioEntry()
        : blankStrengthEntry(block.defaultEquipment)
    updateBlock(block.key, (blk) => ({ ...blk, entries: [...blk.entries, entry] }))
  }

  function setEntry(block, idx, value) {
    updateBlock(block.key, (blk) => ({
      ...blk,
      entries: blk.entries.map((e, i) => (i === idx ? value : e)),
    }))
  }

  function removeEntry(block, idx) {
    updateBlock(block.key, (blk) => ({
      ...blk,
      entries: blk.entries.filter((_, i) => i !== idx),
    }))
  }

  function removeBlock(key) {
    setBlocks((b) => b.filter((blk) => blk.key !== key))
    // If the removed block was the one being edited, collapse and bring the
    // picker back.
    setActiveKey((cur) => (cur === key ? null : cur))
  }

  // Exercises with no sets (e.g. untouched template slots) produce no rows.
  const emptyBlocks = blocks.filter((b) => b.entries.length === 0).length
  const hasEntries = blocks.length > emptyBlocks

  async function save() {
    setError(null)
    setSaving(true)
    // Flatten blocks into a single ordered entries array for the API.
    let order = 0
    const entries = []
    for (const block of blocks) {
      for (const e of block.entries) {
        entries.push({ exercise: block.exercise.id, order: order++, ...e })
      }
    }
    try {
      const saved = id
        ? await api.patch(`/workouts/${id}/`, { date, notes, entries })
        : await api.post('/workouts/', { date, notes, entries })
      navigate(`/workouts/${saved.id}`)
    } catch (e) {
      setError(typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail) || e.message)
      setSaving(false)
    }
  }

  return (
    <div>
      <h1>{id ? 'Edit workout' : 'New workout'}</h1>

      {!id && templates.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label>Start from template</label>
          <select value="" onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">Choose a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.exercises.length} exercise{t.exercises.length === 1 ? '' : 's'})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="row" style={{ marginBottom: 16 }}>
        <div>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <label>Notes</label>
          <input
            type="text"
            style={{ width: '100%' }}
            placeholder="How did it go?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.key)} strategy={verticalListSortingStrategy}>
          {blocks.map((block) => (
            <SortableItem key={block.key} id={block.key}>
              {(handle) => block.key !== activeKey ? (
                <div
                  className="exercise-block condensed"
                  onClick={() => setActiveKey(block.key)}
                  title="Click to edit, drag to reorder"
                >
                  <div className="head">
                    {handle}
                    <span className={`pill ${block.exercise.category}`}>{block.exercise.category}</span>
                    {block.exercise.split && (
                      <span className={`pill ${block.exercise.split}`}>{block.exercise.split}</span>
                    )}
                    <span className="name">{block.exercise.name}</span>
                    <span className="spacer" style={{ flex: 1 }} />
                    <span className="small" style={{ color: 'var(--muted)' }}>
                      {block.entries.length}{' '}
                      {block.exercise.category === 'cardio'
                        ? block.entries.length === 1 ? 'segment' : 'segments'
                        : block.entries.length === 1 ? 'set' : 'sets'}
                    </span>
                  </div>
                  <div className="condensed-summary">
                    {block.entries.length === 0
                      ? `No ${block.exercise.category === 'cardio' ? 'segments' : 'sets'} yet — click to add`
                      : block.entries
                          .map((e) => describeEntry({ ...e, exercise_category: block.exercise.category }))
                          .join('  •  ')}
                  </div>
                </div>
              ) : (
                <div className="exercise-block">
                  <div className="head">
                    {handle}
                    <span className={`pill ${block.exercise.category}`}>{block.exercise.category}</span>
                    {block.exercise.split && (
                      <span className={`pill ${block.exercise.split}`}>{block.exercise.split}</span>
                    )}
                    <span className="name">{block.exercise.name}</span>
                    <ExerciseTags
                      split={block.exercise.split}
                      muscleGroup={block.exercise.muscle_group}
                      secondaryMuscles={block.exercise.secondary_muscles}
                    />
                    <span className="spacer" style={{ flex: 1 }} />
                    <button type="button" className="btn danger small" onClick={() => removeBlock(block.key)}>
                      Remove
                    </button>
                  </div>

                  {block.entries.map((entry, idx) =>
                    block.exercise.category === 'cardio' ? (
                      <CardioRow
                        key={idx}
                        index={idx}
                        entry={entry}
                        onChange={(v) => setEntry(block, idx, v)}
                        onRemove={() => removeEntry(block, idx)}
                      />
                    ) : (
                      <SetRow
                        key={idx}
                        index={idx}
                        entry={entry}
                        onChange={(v) => setEntry(block, idx, v)}
                        onRemove={() => removeEntry(block, idx)}
                      />
                    )
                  )}

                  <div className="row between" style={{ marginTop: 10 }}>
                    <button type="button" className="btn secondary small" onClick={() => addEntry(block)}>
                      + Add {block.exercise.category === 'cardio' ? 'segment' : 'set'}
                    </button>
                    <button type="button" className="btn small" onClick={() => setActiveKey(null)}>
                      Done
                    </button>
                  </div>
                </div>
              )}
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>

      {!activeKey && (
        <div style={{ margin: '16px 0' }}>
          <ExercisePicker exercises={exercises} onPick={addExercise} />
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {emptyBlocks > 0 && hasEntries && (
        <div className="muted small" style={{ marginTop: 12 }}>
          {emptyBlocks} exercise{emptyBlocks === 1 ? ' has' : 's have'} no sets and won't be saved.
        </div>
      )}

      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn" onClick={save} disabled={saving || !hasEntries}>
          {saving ? 'Saving…' : id ? 'Update workout' : 'Save workout'}
        </button>
        <button className="btn ghost" onClick={() => navigate(id ? `/workouts/${id}` : '/')}>
          Cancel
        </button>
        <span className="spacer" style={{ flex: 1 }} />
        <SaveAsTemplate exercises={blocksToTemplateExercises(blocks)} />
      </div>
    </div>
  )
}
