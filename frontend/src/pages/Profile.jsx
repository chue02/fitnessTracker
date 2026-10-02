import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import {
  ageFrom, cmToFtIn, errorMessage, ftInToCm, isoDate, kgToLb, lbToKg, round,
} from '../format.js'

// Empty input -> null; anything else -> a number (NaN if it isn't one).
const num = (text) => (String(text).trim() === '' ? null : Number(text))

// API profile (metric) -> form fields as strings, in the preferred unit.
function profileToForm(p) {
  const form = {
    weight_unit: p.weight_unit,
    sex: p.sex,
    date_of_birth: p.date_of_birth || '',
    avg_bpm: p.avg_bpm ?? '',
  }
  return { ...form, ...measurementsToForm(p.weight_unit, num(p.height_cm ?? ''), num(p.weight_kg ?? '')) }
}

function measurementsToForm(unit, heightCm, weightKg) {
  if (unit === 'lb') {
    const h = heightCm != null ? cmToFtIn(heightCm) : null
    return {
      height_ft: h ? h.ft : '',
      height_in: h ? h.in : '',
      height_cm: '',
      weight: weightKg != null ? kgToLb(weightKg) : '',
    }
  }
  return {
    height_ft: '',
    height_in: '',
    height_cm: heightCm ?? '',
    weight: weightKg ?? '',
  }
}

// Read the form's height/weight back to metric (null when left blank).
function formMeasurements(form) {
  let heightCm
  if (form.weight_unit === 'lb') {
    const ft = num(form.height_ft)
    const inches = num(form.height_in)
    heightCm = ft == null && inches == null ? null : ftInToCm(ft ?? 0, inches ?? 0)
  } else {
    const cm = num(form.height_cm)
    heightCm = cm == null ? null : round(cm, 1)
  }
  const weight = num(form.weight)
  const weightKg = weight == null ? null : form.weight_unit === 'lb' ? lbToKg(weight) : round(weight, 2)
  return { heightCm, weightKg }
}

// The signed-in user's vitals and unit preference.
export default function Profile() {
  const { setProfile } = useAuth()
  // Register sends brand-new users here with { welcome: true }.
  const welcome = useLocation().state?.welcome
  const [form, setForm] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // The latest logged weight, to tell whether the form's weight is a change.
  const [savedWeightKg, setSavedWeightKg] = useState(null)
  // Dated bodyweight entries, newest first.
  const [history, setHistory] = useState([])

  function loadProfile(p) {
    setForm(profileToForm(p))
    setSavedWeightKg(num(p.weight_kg ?? ''))
  }

  const loadHistory = () => api.get('/bodyweight/').then(setHistory)

  useEffect(() => {
    Promise.all([api.get('/profile/').then(loadProfile), loadHistory()])
      .catch((e) => setError(errorMessage(e)))
  }, [])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setSaved(false)
  }

  // Switching units converts what's already typed, so the values keep meaning
  // the same height and weight.
  function setUnit(unit) {
    const { heightCm, weightKg } = formMeasurements(form)
    const clean = (n) => (Number.isFinite(n) ? n : null)
    setForm((f) => ({ ...f, weight_unit: unit, ...measurementsToForm(unit, clean(heightCm), clean(weightKg)) }))
    setSaved(false)
  }

  // After the history changes, pick up the (possibly new) latest weight without
  // discarding other unsaved edits in the form.
  async function refreshWeight() {
    const [p] = await Promise.all([api.get('/profile/'), loadHistory()])
    setProfile(p)
    const weightKg = num(p.weight_kg ?? '')
    setSavedWeightKg(weightKg)
    setForm((f) => ({ ...f, weight: measurementsToForm(f.weight_unit, null, weightKg).weight }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    const { heightCm, weightKg } = formMeasurements(form)
    const bpm = num(form.avg_bpm)
    if ([heightCm, weightKg, bpm].some((n) => n != null && !Number.isFinite(n))) {
      setError('Height, weight and BPM must be numbers.')
      return
    }
    setSaving(true)
    try {
      // A changed weight is logged as of today rather than overwriting the old
      // one, so workouts from earlier dates keep the weight they were done at.
      // A blanked field is left alone: history isn't cleared from here.
      if (weightKg != null && weightKg !== savedWeightKg) {
        await api.post('/bodyweight/', { date: isoDate(new Date()), weight_kg: weightKg })
        await loadHistory()
      }
      const p = await api.patch('/profile/', {
        weight_unit: form.weight_unit,
        height_cm: heightCm,
        sex: form.sex,
        date_of_birth: form.date_of_birth || null,
        avg_bpm: bpm,
      })
      setProfile(p)
      loadProfile(p)
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!form) return error ? <div className="error">{error}</div> : <div className="empty">Loading…</div>

  const imperial = form.weight_unit === 'lb'
  const field = { marginBottom: 14 }

  return (
    <div style={{ maxWidth: 420 }}>
      <h1>Profile</h1>
      {welcome && (
        <p className="muted">Welcome! Add your vitals now, or skip and fill them in any time.</p>
      )}
      <form className="card" onSubmit={onSubmit}>
        <div style={field}>
          <label>Units</label>
          <select value={form.weight_unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="lb">Imperial (lb, ft/in)</option>
            <option value="kg">Metric (kg, cm)</option>
          </select>
          <div className="muted small" style={{ marginTop: 4 }}>
            Also the default unit for new sets.
          </div>
        </div>

        <div style={field}>
          <label>Height</label>
          {imperial ? (
            <div className="row" style={{ gap: 6 }}>
              <input type="number" min="0" value={form.height_ft} onChange={(e) => set('height_ft', e.target.value)} />
              <span className="muted">ft</span>
              <input type="number" min="0" step="0.1" value={form.height_in} onChange={(e) => set('height_in', e.target.value)} />
              <span className="muted">in</span>
            </div>
          ) : (
            <div className="row" style={{ gap: 6 }}>
              <input type="number" min="0" step="0.1" value={form.height_cm} onChange={(e) => set('height_cm', e.target.value)} />
              <span className="muted">cm</span>
            </div>
          )}
        </div>

        <div style={field}>
          <label>Weight</label>
          <div className="row" style={{ gap: 6 }}>
            <input type="number" min="0" step="0.1" value={form.weight} onChange={(e) => set('weight', e.target.value)} />
            <span className="muted">{form.weight_unit}</span>
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            A new weight is logged as of today. Earlier workouts keep the weight from their own date.
          </div>
        </div>

        <div style={field}>
          <label>Sex</label>
          <select value={form.sex} onChange={(e) => set('sex', e.target.value)}>
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style={field}>
          <label>Date of birth</label>
          <input
            type="date"
            max={isoDate(new Date())}
            value={form.date_of_birth}
            onChange={(e) => set('date_of_birth', e.target.value)}
          />
          {form.date_of_birth && (
            <span className="muted small" style={{ marginLeft: 8 }}>age {ageFrom(form.date_of_birth)}</span>
          )}
        </div>

        <div style={field}>
          <label>Avg resting BPM</label>
          <div className="row" style={{ gap: 6 }}>
            <input type="number" min="0" value={form.avg_bpm} onChange={(e) => set('avg_bpm', e.target.value)} />
            <span className="muted">bpm</span>
          </div>
        </div>

        <div className="row">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          {saved && <span className="muted small">Saved.</span>}
        </div>
        {error && <div className="error">{error}</div>}
      </form>

      <BodyweightHistory history={history} unit={form.weight_unit} onChange={refreshWeight} />
    </div>
  )
}

// Past bodyweights, for backfilling a weight you didn't log at the time or
// fixing a typo. Each entry applies to workouts from its date until the next.
function BodyweightHistory({ history, unit, onChange }) {
  const [date, setDate] = useState(() => isoDate(new Date()))
  const [weight, setWeight] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const show = (kg) => (unit === 'lb' ? kgToLb(Number(kg)) : Number(kg))

  async function run(action) {
    setError(null)
    setBusy(true)
    try {
      await action()
      await onChange()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function add(e) {
    e.preventDefault()
    const n = num(weight)
    if (n == null || !Number.isFinite(n)) {
      setError('Enter a weight.')
      return
    }
    const weight_kg = unit === 'lb' ? lbToKg(n) : round(n, 2)
    // Same-day entries replace the old one (the API upserts by date).
    run(async () => {
      await api.post('/bodyweight/', { date, weight_kg })
      setWeight('')
    })
  }

  function remove(entry) {
    if (!confirm(`Delete the ${entry.date} weight? Workouts already logged keep the weight recorded with them.`)) return
    run(() => api.del(`/bodyweight/${entry.id}/`))
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Bodyweight history</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Changing or deleting entries here won't alter workouts
        already logged. Workouts logged with no bodyweight on record pick one up when you log a weight.
      </p>

      {history.length === 0 ? (
        <div className="muted small" style={{ marginBottom: 12 }}>No weights logged yet.</div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {history.map((entry) => (
            <div key={entry.id} className="row between" style={{ padding: '4px 0' }}>
              <span>{entry.date}</span>
              <span className="row" style={{ gap: 8 }}>
                <span>
                  {show(entry.weight_kg)} {unit}
                </span>
                <button type="button" className="btn danger small" disabled={busy} onClick={() => remove(entry)}>
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <form className="row" style={{ gap: 6 }} onSubmit={add}>
        <input type="date" max={isoDate(new Date())} value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="number" min="0" step="0.1" placeholder="weight" value={weight} onChange={(e) => setWeight(e.target.value)} />
        <span className="muted">{unit}</span>
        <button className="btn small" type="submit" disabled={busy || !date}>
          Log
        </button>
      </form>
      {error && <div className="error">{error}</div>}
    </div>
  )
}
