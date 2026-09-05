import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import ExercisePicker from '../components/ExercisePicker.jsx'
import ExerciseTags from '../components/ExerciseTags.jsx'
import SetRow from '../components/SetRow.jsx'
import CardioRow from '../components/CardioRow.jsx'

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

  useEffect(() => {
    api.get('/exercises/').then(setExercises).catch((e) => setError(e.message))
  }, [])

  function addExercise(exercise) {
    const first =
      exercise.category === 'cardio' ? blankCardioEntry() : blankStrengthEntry()
    setBlocks((b) => [...b, { key: crypto.randomUUID(), exercise, entries: [first] }])
  }

  function updateBlock(key, updater) {
    setBlocks((b) => b.map((blk) => (blk.key === key ? updater(blk) : blk)))
  }

  function addEntry(block) {
    const entry =
      block.exercise.category === 'cardio' ? blankCardioEntry() : blankStrengthEntry()
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

      {blocks.map((block) => (
        <div key={block.key} className="exercise-block">
          <div className="head">
            <span className={`pill ${block.exercise.category}`}>{block.exercise.category}</span>
            {block.exercise.circuit && (
              <span className={`pill ${block.exercise.circuit}`}>{block.exercise.circuit}</span>
            )}
            <span className="name">{block.exercise.name}</span>
            <ExerciseTags
              circuit={block.exercise.circuit}
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
      ))}

      <div style={{ margin: '16px 0' }}>
        <ExercisePicker exercises={exercises} onPick={addExercise} />
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
