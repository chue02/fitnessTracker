import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import ExercisePicker from '../components/ExercisePicker.jsx'
import ExerciseTags from '../components/ExerciseTags.jsx'
import SetRow from '../components/SetRow.jsx'
import CardioRow from '../components/CardioRow.jsx'
import { describeEntry } from '../format.js'

function blankStrengthEntry() {
  return { reps: null, weight: null, weight_unit: 'lb', equipment: '', is_warmup: false }
}
function blankCardioEntry() {
  return { distance: null, distance_unit: 'mi', duration_seconds: null, avg_heart_rate: null }
}

export default function NewWorkout() {
  const navigate = useNavigate()
  const [exercises, setExercises] = useState([])
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
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
    // re-enter the same reps/weight (or distance/duration) every time.
    const last = block.entries[block.entries.length - 1]
    const entry = last
      ? { ...last }
      : block.exercise.category === 'cardio'
        ? blankCardioEntry()
        : blankStrengthEntry()
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
      const created = await api.post('/workouts/', { date, notes, entries })
      navigate(`/workouts/${created.id}`)
    } catch (e) {
      setError(typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail) || e.message)
      setSaving(false)
    }
  }

  return (
    <div>
      <h1>New workout</h1>

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

      {blocks.map((block) =>
        block.key !== activeKey ? (
          <div
            key={block.key}
            className="exercise-block condensed"
            onClick={() => setActiveKey(block.key)}
            title="Click to edit"
          >
            <div className="head">
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
              {block.entries
                .map((e) => describeEntry({ ...e, exercise_category: block.exercise.category }))
                .join('  •  ')}
            </div>
          </div>
        ) : (
        <div key={block.key} className="exercise-block">
          <div className="head">
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
            <button type="button" className="btn ghost small" onClick={() => removeBlock(block.key)}>
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

          <button type="button" className="btn secondary small" onClick={() => addEntry(block)}>
            + Add {block.exercise.category === 'cardio' ? 'segment' : 'set'}
          </button>
        </div>
        )
      )}

      <div style={{ margin: '16px 0' }}>
        {activeKey ? (
          <button type="button" className="btn secondary" onClick={() => setActiveKey(null)}>
            Done
          </button>
        ) : (
          <ExercisePicker exercises={exercises} onPick={addExercise} />
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn" onClick={save} disabled={saving || blocks.length === 0}>
          {saving ? 'Saving…' : 'Save workout'}
        </button>
        <button className="btn ghost" onClick={() => navigate('/')}>
          Cancel
        </button>
      </div>
    </div>
  )
}
