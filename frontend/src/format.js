// Small display helpers shared across pages.

export function formatDuration(totalSeconds) {
  if (totalSeconds == null) return ''
  const s = Number(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

// Parse "mm:ss" or "h:mm:ss" (or plain seconds) into total seconds.
export function parseDuration(text) {
  if (!text) return null
  const parts = String(text).split(':').map((p) => Number(p))
  if (parts.some((n) => Number.isNaN(n))) return null
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

// Human summary of a single entry, formatted by its exercise category.
export function describeEntry(entry) {
  if (entry.exercise_category === 'cardio') {
    const bits = []
    if (entry.distance != null) bits.push(`${Number(entry.distance)} ${entry.distance_unit}`)
    if (entry.duration_seconds != null) bits.push(`${formatDuration(entry.duration_seconds)}`)
    if (entry.avg_heart_rate != null) bits.push(`${entry.avg_heart_rate} bpm`)
    return bits.join(' · ') || '—'
  }
  const w = entry.weight != null ? `${Number(entry.weight)} ${entry.weight_unit}` : 'bodyweight'
  const reps = entry.reps != null ? `${entry.reps} reps` : ''
  const warm = entry.is_warmup ? ' (warmup)' : ''
  const summary = [reps, reps && w ? '@' : '', w].filter(Boolean).join(' ') + warm
  return entry.equipment ? `${summary} · ${equipmentLabel(entry.equipment)}` : summary
}

// Map a resistance code to its display label.
export function equipmentLabel(code) {
  const labels = {
    barbell: 'Barbell',
    dumbbell: 'Dumbbell',
    cable: 'Cable',
    machine: 'Machine',
    plates_machine: 'Plate Loaded Machine',
    calisthenics: 'Calisthenics',
  }
  return labels[code] || code
}
