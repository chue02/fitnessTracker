// Aggregation helpers for the home screen. Pure functions over the workout list
// returned by GET /api/workouts/ (owner-scoped, newest first, entries nested).
//
// Two things about the API shape drive most of the care below:
//   - `weight`/`distance` are DRF DecimalFields, so they arrive as STRINGS.
//   - `weight_unit` is per set, so a history can mix lb and kg.

import { isoDate, parseIso, SPLIT_ORDER, workoutSummary } from './format.js'

const LB_PER_KG = 2.20462
const MI_PER_KM = 0.621371
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Re-exported so callers of the stats module don't need two imports.
export { isoDate }

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

// One cell per day of the week, carrying that day's workouts and a summary of
// them (the dominant split tints the marker; the rest feeds the hover tooltip).
export function weekDays(workouts, range, today = new Date()) {
  const todayIso = isoDate(today)
  return range.days.map((iso, i) => {
    const dayWorkouts = workouts.filter((w) => w.date === iso)
    const summary = summarizeWorkouts(dayWorkouts)
    return {
      iso,
      letter: DAY_LETTERS[i],
      dayName: DAY_NAMES[i],
      dayOfMonth: Number(iso.slice(8, 10)),
      isToday: iso === todayIso,
      workouts: dayWorkouts,
      summary,
      split: summary.split,
    }
  })
}

// Totals over an arbitrary set of workouts — one day's worth or a whole week.
// `split` and `muscles` come from the shared workoutSummary so the home screen
// labels a day the same way the journal labels a workout.
export function summarizeWorkouts(workouts) {
  const exercises = new Set()
  const allEntries = []
  let workoutCount = 0
  let workingSets = 0
  let warmupSets = 0
  let cardioSegments = 0
  let volumeLb = 0
  let cardioSeconds = 0
  let cardioDistanceMi = 0

  for (const w of workouts) {
    workoutCount += 1
    for (const e of w.entries) {
      exercises.add(e.exercise)
      allEntries.push(e)
      if (isWorkingSet(e)) {
        workingSets += 1
        volumeLb += toLb(e.weight, e.weight_unit) * e.reps
      }
      if (e.exercise_category === 'strength' && e.is_warmup) warmupSets += 1
      if (e.exercise_category === 'cardio') {
        cardioSegments += 1
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

  const { split, muscles } = workoutSummary(allEntries)
  return {
    workoutCount,
    exerciseCount: exercises.size,
    workingSets,
    warmupSets,
    // Every logged strength set, warmups included. Cardio segments aren't sets.
    totalSets: allEntries.filter((e) => e.exercise_category === 'strength').length,
    cardioSegments,
    volumeLb: Math.round(volumeLb),
    cardioSeconds,
    cardioDistanceMi,
    split,
    muscles,
  }
}

// Week-level totals. Derived from the same cells the strip renders, so the two
// can never disagree.
export function weekTotals(days) {
  return summarizeWorkouts(days.flatMap((d) => d.workouts))
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

// The most recent times a lift beat its own previous best, newest first.
//
// A first-ever logged set is NOT a record here: with nothing to compare against
// there is no improvement to report, and counting them would bury a real PR
// under every new exercise the user tries.
export function recentRecords(workouts, limit = 5) {
  // Oldest first, so "previous best" means what it says. The API sorts newest
  // first by (-date, -created_at); this is that comparison reversed.
  const ordered = [...workouts].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      String(a.created_at).localeCompare(String(b.created_at)) ||
      a.id - b.id,
  )

  const best = new Map() // exercise id -> the top working set so far
  const records = []

  for (const w of ordered) {
    for (const e of w.entries) {
      if (!isWorkingSet(e)) continue
      const current = { lb: toLb(e.weight, e.weight_unit), weight: Number(e.weight), unit: e.weight_unit, reps: e.reps }
      const prev = best.get(e.exercise)
      if (!prev) {
        best.set(e.exercise, current)
        continue
      }
      if (current.lb > prev.lb) {
        records.push({
          exerciseId: e.exercise,
          name: e.exercise_name,
          split: e.exercise_split,
          muscleGroup: e.exercise_muscle_group,
          weight: current.weight,
          weightUnit: current.unit,
          reps: current.reps,
          // Reported in the new set's unit so the delta reads consistently.
          gain: Math.round((current.lb - prev.lb) * (current.unit === 'kg' ? 1 / LB_PER_KG : 1) * 10) / 10,
          previousWeight: prev.weight,
          previousUnit: prev.unit,
          date: w.date,
          workoutId: w.id,
        })
        best.set(e.exercise, current)
      }
    }
  }

  return records.reverse().slice(0, limit)
}

// Whether the history contains any weighted working set at all — used to tell
// "no PRs yet" apart from "no strength training logged yet".
export function hasWorkingSets(workouts) {
  return workouts.some((w) => w.entries.some(isWorkingSet))
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

// --- Training habits ---

// The Sunday of the week containing a YYYY-MM-DD, as a YYYY-MM-DD. Week keys
// are compared as strings, so they're immune to the UTC parsing trap.
export function weekStartIso(iso) {
  const d = parseIso(iso)
  d.setDate(d.getDate() - d.getDay())
  return isoDate(d)
}

// Consecutive Sun–Sat weeks with at least one workout.
//
// An unlogged CURRENT week doesn't break the streak — it hasn't failed yet, it's
// just in progress — so counting starts at last week when this week is empty.
// Otherwise the number would collapse to 0 every Sunday morning.
export function weekStreaks(workouts, today = new Date()) {
  const weeks = new Set(workouts.map((w) => weekStartIso(w.date)))
  const thisWeek = weekStartIso(isoDate(today))

  // Step back one week from a week-start key.
  const prevWeek = (iso) => {
    const d = parseIso(iso)
    d.setDate(d.getDate() - 7)
    return isoDate(d)
  }

  let current = 0
  let cursor = weeks.has(thisWeek) ? thisWeek : prevWeek(thisWeek)
  while (weeks.has(cursor)) {
    current += 1
    cursor = prevWeek(cursor)
  }

  // Longest ever: walk the sorted week keys and count unbroken runs.
  let longest = 0
  let run = 0
  let previous = null
  for (const week of [...weeks].sort()) {
    run = previous !== null && prevWeek(week) === previous ? run + 1 : 1
    if (run > longest) longest = run
    previous = week
  }

  return { current, longest, totalWorkouts: workouts.length }
}

// Workouts per week over the last N COMPLETED weeks. The current week is
// excluded: a week that's only two days old would drag the average down.
// Shorter histories divide by the weeks they actually have.
export function avgWorkoutsPerWeek(workouts, today = new Date(), weeks = 8) {
  if (workouts.length === 0) return 0
  const thisWeek = weekStartIso(isoDate(today))

  const start = parseIso(thisWeek)
  start.setDate(start.getDate() - weeks * 7)
  const windowStart = isoDate(start)

  const earliestWeek = workouts.reduce(
    (min, w) => (min === null || w.date < min ? weekStartIso(w.date) : min),
    null,
  )
  const from = windowStart > earliestWeek ? windowStart : earliestWeek

  // Completed weeks between `from` and the current week, at least one.
  const spanDays = (parseIso(thisWeek) - parseIso(from)) / 86400000
  const divisor = Math.max(1, Math.round(spanDays / 7))

  const counted = workouts.filter((w) => w.date >= from && weekStartIso(w.date) !== thisWeek)
  return Math.round((counted.length / divisor) * 10) / 10
}

// How much each split has been trained lately, and how long since it last was.
//
// Sessions are counted PER WORKOUT, not per set: a workout contributes +1 to
// every distinct split it touches, so a push/pull day counts for both. The
// question is "did I train legs", not "how much legs volume".
//
// `daysSince` deliberately looks past the window — a split untrained for 60 days
// should say so rather than vanish. `null` means never trained.
export function splitBalance(workouts, today = new Date(), windowDays = 30) {
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - windowDays + 1)
  const cutoffIso = isoDate(cutoff)
  const todayIso = isoDate(today)

  const sessions = new Map()
  const lastSeen = new Map()

  for (const w of workouts) {
    const present = new Set()
    for (const e of w.entries) {
      // Cardio has no split; track it as its own row.
      present.add(e.exercise_category === 'cardio' ? 'cardio' : e.exercise_split || '')
    }
    present.delete('')
    for (const key of present) {
      if (w.date >= cutoffIso && w.date <= todayIso) {
        sessions.set(key, (sessions.get(key) || 0) + 1)
      }
      const seen = lastSeen.get(key)
      if (!seen || w.date > seen) lastSeen.set(key, w.date)
    }
  }

  const daysBetween = (iso) =>
    Math.round((parseIso(todayIso) - parseIso(iso)) / 86400000)

  const keys = [...SPLIT_ORDER]
  if (sessions.has('cardio') || lastSeen.has('cardio')) keys.push('cardio')

  return keys.map((split) => ({
    split,
    sessions: sessions.get(split) || 0,
    daysSince: lastSeen.has(split) ? daysBetween(lastSeen.get(split)) : null,
  }))
}
