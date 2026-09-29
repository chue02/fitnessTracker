import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { errorMessage } from '../format.js'

// "Save as template" button that expands into an inline name field.
// `exercises` is the template exercise list to save (see templates.js).
export default function SaveAsTemplate({ exercises, defaultName = '', disabled }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  async function save(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await api.post('/templates/', { name: name.trim(), exercises })
      setSaved(true)
      setOpen(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <span className="small muted">
        Template saved · <Link to="/templates">view templates</Link>
      </span>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn secondary small"
        onClick={() => setOpen(true)}
        disabled={disabled || exercises.length === 0}
      >
        Save as template
      </button>
    )
  }

  return (
    <form className="row" onSubmit={save} style={{ gap: 8 }}>
      <input
        type="text"
        autoFocus
        placeholder="Template name, e.g. Push A"
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className="btn small" disabled={saving || !name.trim()}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  )
}
