// Aggregation helpers for the home screen. Pure functions over the workout list
// returned by GET /api/workouts/ (owner-scoped, newest first, entries nested).
//
// Two things about the API shape drive most of the care below:
//   - `weight`/`distance` are DRF DecimalFields, so they arrive as STRINGS.
//   - `weight_unit` is per set, so a history can mix lb and kg.

import { workoutSummary } from './format.js'

const LB_PER_KG = 2.20462
const MI_PER_KM = 0.621371
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Local YYYY-MM-DD. Not toISOString(), which converts to UTC and lands on the
// wrong day for anyone west of Greenwich. Workout.date is a plain DateField, so
// everything here buckets by this string rather than by Date objects.
export function isoDate(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Normalize a logged weight to pounds so mixed-unit sets are comparable.
export function toLb(weight, unit) {
  const n = Number(weight)
  if (!Number.isFinite(n)) return 0
  return unit === 'kg' ? n * LB_PER_KG : n
}

// A set that counts toward volume and PRs: strength, not a warmup, and actually
// loaded (bodyweight sets have weight === null).
export function isWorkingSet(entry) {
  return (
    entry.exercise_category === 'strength' &&
    !entry.is_warmup &&
    entry.weight != null &&
    entry.reps != null
  )
}

// The Sun–Sat week containing `today`, as the seven local date strings.
export function weekRange(today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  start.setDate(start.getDate() - start.getDay()) // back up to Sunday
  const days = []
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    days.push(isoDate(d))
  }
  return { startIso: days[0], endIso: days[6], days }
}

// One cell per day of the week, carrying that day's workouts and the dominant
// split of the first of them (used to tint the marker).
export function weekDays(workouts, range, today = new Date()) {
  const todayIso = isoDate(today)
  return range.days.map((iso, i) => {
    const dayWorkouts = workouts.filter((w) => w.date === iso)
    const first = dayWorkouts[0]
    return {
      iso,
      letter: DAY_LETTERS[i],
      dayOfMonth: Number(iso.slice(8, 10)),
      isToday: iso === todayIso,
      workouts: dayWorkouts,
      split: first ? workoutSummary(first.entries).split : '',
    }
  })
}

// Week-level totals, computed from the cells so the two always agree.
export function weekTotals(days) {
  const exercises = new Set()
  let workoutCount = 0
  let workingSets = 0
  let volumeLb = 0
  let cardioSeconds = 0
  let cardioDistanceMi = 0

  for (const day of days) {
    for (const w of day.workouts) {
      workoutCount += 1
      for (const e of w.entries) {
        exercises.add(e.exercise)
        if (isWorkingSet(e)) {
          workingSets += 1
          volumeLb += toLb(e.weight, e.weight_unit) * e.reps
        }
        if (e.exercise_category === 'cardio') {
          if (e.duration_seconds != null) cardioSeconds += e.duration_seconds
          if (e.distance != null) {
            const n = Number(e.distance)
            if (Number.isFinite(n)) {
              cardioDistanceMi += e.distance_unit === 'km' ? n * MI_PER_KM : n
            }
          }
        }
      }
    }
  }

  return {
    workoutCount,
    exerciseCount: exercises.size,
    workingSets,
    volumeLb: Math.round(volumeLb),
    cardioSeconds,
    cardioDistanceMi,
  }
}

// The user's de facto favorite lifts: the strength exercises they log the most
// sets of. Ties break toward the more recently trained, then by name so the
// order is stable across renders.
export function topExercises(workouts, limit = 4) {
  const byExercise = new Map()
  for (const w of workouts) {
    for (const e of w.entries) {
      if (e.exercise_category !== 'strength') continue
      let row = byExercise.get(e.exercise)
      if (!row) {
        row = {
          id: e.exercise,
          name: e.exercise_name,
          muscleGroup: e.exercise_muscle_group,
          split: e.exercise_split,
          secondaryMuscles: e.exercise_secondary_muscles,
          setCount: 0,
          lastDate: w.date,
        }
        byExercise.set(e.exercise, row)
      }
      row.setCount += 1
      if (w.date > row.lastDate) row.lastDate = w.date
    }
  }

  return [...byExercise.values()]
    .sort(
      (a, b) =>
        b.setCount - a.setCount ||
        b.lastDate.localeCompare(a.lastDate) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
}

// Heaviest weight ever lifted for one exercise, warmups excluded. Ranked on the
// lb-normalized value but reported in the unit it was logged in. Ties go to the
// higher rep count, then to the first date it was hit.
export function personalRecord(workouts, exerciseId) {
  let best = null
  for (const w of workouts) {
    for (const e of w.entries) {
      if (e.exercise !== exerciseId || !isWorkingSet(e)) continue
      const lb = toLb(e.weight, e.weight_unit)
      const better =
        !best ||
        lb > best.lb ||
        (lb === best.lb && e.reps > best.reps) ||
        (lb === best.lb && e.reps === best.reps && w.date < best.date)
      if (better) {
        best = {
          lb,
          weight: Number(e.weight),
          weightUnit: e.weight_unit,
          reps: e.reps,
          date: w.date,
          workoutId: w.id,
        }
      }
    }
  }
  return best
}
