// Small display helpers shared across pages.

// Canonical orderings — also used as deterministic tie-breakers.
export const CIRCUIT_ORDER = ['pull', 'push', 'legs', 'core']
export const MUSCLE_ORDER = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'cardio', 'other',
]

// Summarize a workout for its history card: the dominant circuit and the top 2
// primary muscles, counted by DISTINCT exercise (not per set). Ties break by the
// canonical orderings above. Muscle items carry their dominant circuit for tint.
export function workoutSummary(entries) {
  // Collapse entries to distinct exercises.
  const byExercise = new Map()
  for (const e of entries) {
    if (!byExercise.has(e.exercise)) {
      byExercise.set(e.exercise, {
        circuit: e.exercise_circuit || '',
        muscle: e.exercise_muscle_group || '',
      })
    }
  }
  const exercises = [...byExercise.values()]

  const circuitCounts = new Map()
  const muscleCounts = new Map()
  // For each muscle, tally which circuits it appeared under (for the pill tint).
  const muscleCircuits = new Map()
  for (const { circuit, muscle } of exercises) {
    if (circuit) circuitCounts.set(circuit, (circuitCounts.get(circuit) || 0) + 1)
    if (muscle && muscle !== 'cardio') {
      muscleCounts.set(muscle, (muscleCounts.get(muscle) || 0) + 1)
      if (!muscleCircuits.has(muscle)) muscleCircuits.set(muscle, new Map())
      if (circuit) {
        const m = muscleCircuits.get(muscle)
        m.set(circuit, (m.get(circuit) || 0) + 1)
      }
    }
  }

  // count desc, then by the given canonical order.
  const rank = (order) => (a, b) =>
    b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0])

  const topCircuit = [...circuitCounts].sort(rank(CIRCUIT_ORDER))[0]
  const circuit = topCircuit ? topCircuit[0] : ''

  const muscles = [...muscleCounts]
    .sort(rank(MUSCLE_ORDER))
    .slice(0, 2)
    .map(([name]) => {
      const counts = muscleCircuits.get(name)
      const dominant = counts && counts.size
        ? [...counts].sort(rank(CIRCUIT_ORDER))[0][0]
        : ''
      return { name, circuit: dominant }
    })

  return { circuit, muscles }
}

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
