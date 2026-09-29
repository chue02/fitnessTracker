import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { api } from '../api.js'
import ExercisePicker from '../components/ExercisePicker.jsx'
import SortableItem from '../components/SortableItem.jsx'
import { EQUIPMENT_ORDER, equipmentLabel, errorMessage } from '../format.js'
import { blocksToTemplateExercises, templateToBlocks } from '../templates.js'

// Create or edit a template: its name, which exercises it holds, their order,
// and the resistance each one defaults to. Uses the same block shape as the
// workout editor (with no entries), so templates.js converts both ways.
export default function TemplateEditor() {
  const navigate = useNavigate()
  // Present when editing; absent at /templates/new.
  const { id } = useParams()
  const [exercises, setExercises] = useState([])
  const [name, setName] = useState('')
  const [blocks, setBlocks] = useState([])
  const [loaded, setLoaded] = useState(!id)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/exercises/').then(setExercises).catch((e) => setError(errorMessage(e)))
  }, [])

  useEffect(() => {
    if (!id) return
    api
      .get(`/templates/${id}/`)
      .then((t) => {
        setName(t.name)
        setBlocks(templateToBlocks(t))
        setLoaded(true)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [id])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    setBlocks((b) => {
      const from = b.findIndex((blk) => blk.key === active.id)
      const to = b.findIndex((blk) => blk.key === over.id)
      return arrayMove(b, from, to)
    })
  }

  function addExercise(exercise) {
    setBlocks((b) => [
      ...b,
      { key: crypto.randomUUID(), exercise, defaultEquipment: '', entries: [] },
    ])
  }

  function setEquipment(key, equipment) {
    setBlocks((b) => b.map((blk) => (blk.key === key ? { ...blk, defaultEquipment: equipment } : blk)))
  }

  function removeBlock(key) {
    setBlocks((b) => b.filter((blk) => blk.key !== key))
  }

  async function save() {
    setError(null)
    setSaving(true)
    const body = { name: name.trim(), exercises: blocksToTemplateExercises(blocks) }
    try {
      if (id) await api.patch(`/templates/${id}/`, body)
      else await api.post('/templates/', body)
      navigate('/templates')
    } catch (e) {
      setError(errorMessage(e))
      setSaving(false)
    }
  }

  if (!loaded) return error ? <div className="error">{error}</div> : <div className="empty">Loading…</div>

  return (
    <div>
      <h1>{id ? 'Edit template' : 'New template'}</h1>

      <div style={{ marginBottom: 16 }}>
        <label>Name</label>
        <input
          type="text"
          style={{ width: '100%', maxWidth: 360 }}
          placeholder="e.g. Push A"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {blocks.length === 0 && (
        <div className="muted small" style={{ marginBottom: 12 }}>
          Add the exercises this template should start with.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.key)} strategy={verticalListSortingStrategy}>
          {blocks.map((block) => (
            <SortableItem key={block.key} id={block.key}>
              {(handle) => (
                <div className="exercise-block">
                  <div className="head" style={{ marginBottom: 0 }}>
                    {handle}
                    <span className={`pill ${block.exercise.category}`}>{block.exercise.category}</span>
                    {block.exercise.split && (
                      <span className={`pill ${block.exercise.split}`}>{block.exercise.split}</span>
                    )}
                    <span className="name">{block.exercise.name}</span>
                    <span className="spacer" style={{ flex: 1 }} />
                    {block.exercise.category !== 'cardio' && (
                      <select
                        value={block.defaultEquipment}
                        onChange={(e) => setEquipment(block.key, e.target.value)}
                        title="Resistance pre-selected on the first set"
                      >
                        <option value="">resistance…</option>
                        {EQUIPMENT_ORDER.map((code) => (
                          <option key={code} value={code}>
                            {equipmentLabel(code)}
                          </option>
                        ))}
                      </select>
                    )}
                    <button type="button" className="btn danger small" onClick={() => removeBlock(block.key)}>
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>

      <div style={{ margin: '16px 0' }}>
        <ExercisePicker exercises={exercises} onPick={addExercise} />
      </div>

      {error && <div className="error">{error}</div>}

      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn" onClick={save} disabled={saving || !name.trim() || blocks.length === 0}>
          {saving ? 'Saving…' : id ? 'Update template' : 'Save template'}
        </button>
        <button className="btn ghost" onClick={() => navigate('/templates')}>
          Cancel
        </button>
      </div>
    </div>
  )
}
