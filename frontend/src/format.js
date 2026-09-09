// Small display helpers shared across pages.

// Canonical orderings — also used as deterministic tie-breakers.
export const SPLIT_ORDER = ['pull', 'push', 'legs', 'core']

// Each muscle group belongs to exactly one split (mirrors the backend's
// MUSCLE_TO_SPLIT). Used to keep muscle/split filters consistent with each other.
export const MUSCLE_TO_SPLIT = {
  back: 'pull', biceps: 'pull', forearms: 'pull',
  chest: 'push', shoulders: 'push', triceps: 'push',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs',
  abs: 'core',
}
// Muscles ordered split-major (pull, push, legs, core) so sorting by muscle
// naturally groups exercises under their split.
export const MUSCLE_ORDER = [
  'back', 'biceps', 'forearms', // pull
  'chest', 'shoulders', 'triceps', // push
  'quads', 'hamstrings', 'glutes', 'calves', // legs
  'abs', // core
  'cardio', 'other',
]

// Summarize a workout for its journal card: the dominant split and the top 2
// primary muscles, counted by DISTINCT exercise (not per set). Ties break by the
// canonical orderings above. Muscle items carry their dominant split for tint.
export function workoutSummary(entries) {
  // Collapse entries to distinct exercises.
  const byExercise = new Map()
  for (const e of entries) {
    if (!byExercise.has(e.exercise)) {
      byExercise.set(e.exercise, {
        split: e.exercise_split || '',
        muscle: e.exercise_muscle_group || '',
      })
    }
  }
  const exercises = [...byExercise.values()]

  const splitCounts = new Map()
  const muscleCounts = new Map()
  // For each muscle, tally which splits it appeared under (for the pill tint).
  const muscleSplits = new Map()
  for (const { split, muscle } of exercises) {
    if (split) splitCounts.set(split, (splitCounts.get(split) || 0) + 1)
    if (muscle && muscle !== 'cardio') {
      muscleCounts.set(muscle, (muscleCounts.get(muscle) || 0) + 1)
      if (!muscleSplits.has(muscle)) muscleSplits.set(muscle, new Map())
      if (split) {
        const m = muscleSplits.get(muscle)
        m.set(split, (m.get(split) || 0) + 1)
      }
    }
  }

  // count desc, then by the given canonical order.
  const rank = (order) => (a, b) =>
    b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0])

  const topSplit = [...splitCounts].sort(rank(SPLIT_ORDER))[0]
  const split = topSplit ? topSplit[0] : ''

  const muscles = [...muscleCounts]
    .sort(rank(MUSCLE_ORDER))
    .slice(0, 2)
    .map(([name]) => {
      const counts = muscleSplits.get(name)
      const dominant = counts && counts.size
        ? [...counts].sort(rank(SPLIT_ORDER))[0][0]
        : ''
      return { name, split: dominant }
    })

  return { split, muscles }
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
