// Aggregation helpers for the home screen. Pure functions over the workout list
// returned by GET /api/workouts/ (owner-scoped, newest first, entries nested).
//
// Three things about the API shape drive most of the care below:
//   - `weight`/`distance` are DRF DecimalFields, so they arrive as STRINGS.
//   - `weight_unit` is per set, so a history can mix lb and kg.
//   - A calisthenics set's `weight` is already the TOTAL load (the bodyweight
//     stored with its workout plus any added weight), computed by the server
//     when the workout was saved. Stats never look up bodyweight themselves.

import {
  EQUIPMENT_ORDER, isoDate, MUSCLE_ORDER, parseIso, SPLIT_ORDER, workoutSummary,
} from './format.js'

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

// Calisthenics sets are bodyweight work; their stored `weight` includes the
// body (see the note at the top). Used to label such loads.
export function isBodyweightSet(entry) {
  return entry.equipment === 'calisthenics'
}

// A set that counts toward volume and PRs: strength, not a warmup, and actually
// loaded (weight is null when nothing was logged, or for a calisthenics set
// saved before any bodyweight was on record).
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

// Compare loads to the hundredth of a pound, so a set logged in kg and the same
// load logged in lb don't differ by float noise and pass for a "heavier" lift.
const sameOrLighter = (lb, bestLb) => Math.round(lb * 100) <= Math.round(bestLb * 100)

// Where `value` sits in `order`, with anything unlisted after everything listed.
const orderIndex = (order, value) => {
  const i = order.indexOf(value)
  return i === -1 ? order.length : i
}

// Every PR ever set, per exercise AND resistance (bench on a barbell and bench
// on dumbbells are separate records), oldest record first within each group.
//
// A PR is a strictly heavier load than the best before it. Two rules keep the
// log free of noise:
//   - Each workout contributes at most one record per lift: its heaviest set
//     (ties to more reps). Ramping 100 → 110 → 120 in one session is one PR.
//   - Matching or falling short of the best never logs, so repeat maxes
//     (45, 45, 45) don't show up as fresh records.
// The first session of each lift is kept as the baseline, flagged `initial`.
//
// Groups come back in split order, then resistance, then name — the same
// shape as the home breakdown.
export function prHistory(workouts) {
  // Oldest first, so "previous best" means what it says. The API sorts newest
  // first by (-date, -created_at); this is that comparison reversed.
  const ordered = [...workouts].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      String(a.created_at).localeCompare(String(b.created_at)) ||
      a.id - b.id,
  )

  const groups = new Map() // `${exercise}::${equipment}` -> group

  for (const w of ordered) {
    // This session's heaviest working set per lift.
    const sessionBest = new Map()
    for (const e of w.entries) {
      if (!isWorkingSet(e)) continue
      const key = `${e.exercise}::${e.equipment || ''}`
      const lb = toLb(e.weight, e.weight_unit)
      const top = sessionBest.get(key)
      if (!top || lb > top.lb || (lb === top.lb && e.reps > top.entry.reps)) {
        sessionBest.set(key, { lb, entry: e })
      }
    }

    for (const [key, { lb, entry: e }] of sessionBest) {
      let group = groups.get(key)
      if (!group) {
        group = {
          key,
          exerciseId: e.exercise,
          equipment: e.equipment || '',
          name: e.exercise_name,
          split: e.exercise_split,
          muscleGroup: e.exercise_muscle_group,
          records: [],
        }
        groups.set(key, group)
      }

      const prev = group.records[group.records.length - 1]
      if (prev && sameOrLighter(lb, prev.lb)) continue

      const weight = Number(e.weight)
      group.records.push({
        lb,
        weight,
        weightUnit: e.weight_unit,
        reps: e.reps,
        bodyweight: isBodyweightSet(e),
        date: w.date,
        workoutId: w.id,
        initial: !prev,
        // Reported in the new set's unit so the delta reads consistently.
        gain: prev
          ? Math.round((lb - prev.lb) * (e.weight_unit === 'kg' ? 1 / LB_PER_KG : 1) * 10) / 10
          : null,
        previousWeight: prev ? prev.weight : null,
        previousUnit: prev ? prev.weightUnit : null,
      })
    }
  }

  return [...groups.values()].sort(
    (a, b) =>
      orderIndex(SPLIT_ORDER, a.split) - orderIndex(SPLIT_ORDER, b.split) ||
      orderIndex(EQUIPMENT_ORDER, a.equipment) - orderIndex(EQUIPMENT_ORDER, b.equipment) ||
      a.name.localeCompare(b.name),
  )
}

// The most recent times a lift beat its own previous best, newest first.
// Built on prHistory so the home card and the Records page always agree.
//
// A lift's baseline (first session) is NOT a record here: with nothing to
// compare against there is no improvement to report, and counting them would
// bury a real PR under every new exercise the user tries.
export function recentRecords(workouts, limit = 5) {
  const records = []
  for (const g of prHistory(workouts)) {
    for (const r of g.records) {
      if (r.initial) continue
      records.push({
        exerciseId: g.exerciseId,
        equipment: g.equipment,
        name: g.name,
        split: g.split,
        muscleGroup: g.muscleGroup,
        ...r,
      })
    }
  }
  // Newest first; same-day records go by the later-saved workout.
  return records
    .sort((a, b) => b.date.localeCompare(a.date) || b.workoutId - a.workoutId)
    .slice(0, limit)
}

// Whether the history contains any weighted working set at all — used to tell
// "no PRs yet" apart from "no strength training logged yet".
export function hasWorkingSets(workouts) {
  return workouts.some((w) => w.entries.some(isWorkingSet))
}

// Heaviest weight ever lifted for one exercise, warmups excluded. Ranked on the
// lb-normalized value but reported in the unit it was logged in. Ties go to the
// higher rep count, then to the first date it was hit.
// `equipment` narrows the record to one resistance (pass '' for sets logged
// without one). Omit it to rank every resistance together.
export function personalRecord(workouts, exerciseId, equipment = null) {
  let best = null
  for (const w of workouts) {
    for (const e of w.entries) {
      if (e.exercise !== exerciseId || !isWorkingSet(e)) continue
      if (equipment !== null && (e.equipment || '') !== equipment) continue
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
          bodyweight: isBodyweightSet(e),
          // Which resistance it was set on — informative when `equipment` was omitted.
          equipment: e.equipment || '',
          date: w.date,
          workoutId: w.id,
        }
      }
    }
  }
  return best
}

// A logged distance in `unit` ('mi' or 'km'); null when missing or unparsable.
export function distanceIn(distance, fromUnit, unit) {
  if (distance == null) return null
  const n = Number(distance)
  if (!Number.isFinite(n)) return null
  if (fromUnit === unit) return n
  return unit === 'mi' ? n * MI_PER_KM : n / MI_PER_KM
}

// Bests for one cardio exercise: fastest pace, farthest distance, longest time.
//
// Records are per SESSION: every segment of the exercise in one workout is
// summed, so a run logged as mile splits counts as one run and short intervals
// don't pass for race pace. Pace only uses segments with both a distance and a
// time. Each record is null if nothing logged supports it; ties go to the
// first date it was hit, as with personalRecord.
//
// `minDistance` (in `unit`) limits the pace record to sessions at least that
// long, e.g. 5 for "fastest 5 km+". It allows 0.5% of slack so a 5K logged as
// 3.1 mi still counts as 5 km. Farthest and longest ignore it.
export function cardioRecords(workouts, exerciseId, unit = 'mi', minDistance = 0) {
  const qualifies = (distance) => distance >= minDistance * 0.995
  let fastest = null
  let farthest = null
  let longest = null
  const beats = (best, value, date, lowerIsBetter = false) =>
    !best ||
    (lowerIsBetter ? value < best.value : value > best.value) ||
    (value === best.value && date < best.date)

  for (const w of workouts) {
    let distance = 0
    let seconds = 0
    let pacedDistance = 0
    let pacedSeconds = 0
    for (const e of w.entries) {
      if (e.exercise !== exerciseId || e.exercise_category !== 'cardio') continue
      const d = distanceIn(e.distance, e.distance_unit, unit)
      const s = e.duration_seconds
      if (d != null) distance += d
      if (s != null) seconds += s
      if (d > 0 && s > 0) {
        pacedDistance += d
        pacedSeconds += s
      }
    }

    const at = { date: w.date, workoutId: w.id }
    if (pacedDistance > 0 && qualifies(pacedDistance)) {
      const pace = pacedSeconds / pacedDistance // seconds per unit
      if (beats(fastest, pace, w.date, true)) fastest = { value: pace, distance: pacedDistance, ...at }
    }
    if (distance > 0 && beats(farthest, distance, w.date)) farthest = { value: distance, ...at }
    if (seconds > 0 && beats(longest, seconds, w.date)) longest = { value: seconds, ...at }
  }

  return { unit, fastest, farthest, longest }
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

// --- Last-7-days breakdown ---
// A pivot of recent training: per split, then either per resistance+exercise or
// per muscle. Mirrors the columns of the user's spreadsheet:
//   MAX Lbs, Lbs Wtd Avg, SUM of Sets, SUM of Reps, Avg Reps/Set
// where the weighted average is volume over reps, i.e. Σ(weight × reps) / Σ(reps).

// Roll a list of sets into that stat line. Weight-less sets still count toward
// sets/reps but can't contribute to a load average, so a group with no loaded
// sets reports null rather than a misleading 0.
function statsFor(entries) {
  let sets = 0
  let reps = 0
  let volumeLb = 0
  let loadedReps = 0
  let maxLb = null

  for (const e of entries) {
    sets += 1
    const r = e.reps ?? 0
    reps += r
    if (e.weight != null) {
      const lb = toLb(e.weight, e.weight_unit)
      if (maxLb === null || lb > maxLb) maxLb = lb
      volumeLb += lb * r
      loadedReps += r
    }
  }

  return {
    sets,
    reps,
    maxLb,
    wtdAvgLb: loadedReps > 0 ? volumeLb / loadedReps : null,
    avgRepsPerSet: sets > 0 ? reps / sets : 0,
  }
}

// Every strength set from the trailing `days`-day window, warmups excluded.
function recentStrengthEntries(workouts, today, days) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))
  const startIso = isoDate(start)
  const endIso = isoDate(today)

  const out = []
  for (const w of workouts) {
    if (w.date < startIso || w.date > endIso) continue
    for (const e of w.entries) {
      // Cardio has no reps or load, and warmups would deflate the averages.
      if (e.exercise_category !== 'strength' || e.is_warmup) continue
      out.push(e)
    }
  }
  return out
}

// `by: 'exercise'` groups split -> resistance -> exercise; `by: 'muscle'`
// groups split -> primary muscle. Returns one section per split, each with its
// own subtotal. No grand total — the splits don't meaningfully sum.
export function weeklyBreakdown(workouts, { by = 'exercise', today = new Date(), days = 7 } = {}) {
  const entries = recentStrengthEntries(workouts, today, days)

  // split -> row key -> entries
  const bySplit = new Map()
  for (const e of entries) {
    const split = e.exercise_split || 'other'
    if (!bySplit.has(split)) bySplit.set(split, new Map())
    const rows = bySplit.get(split)

    const key =
      by === 'muscle'
        ? e.exercise_muscle_group || 'other'
        // Resistance is recorded per set, so the same lift done on a bar and on
        // a machine is two rows — which is what "per exercise per resistance" means.
        : `${e.equipment || ''}::${e.exercise}`
    if (!rows.has(key)) rows.set(key, [])
    rows.get(key).push(e)
  }

  const splitRank = (s) => {
    const i = SPLIT_ORDER.indexOf(s)
    return i === -1 ? SPLIT_ORDER.length : i
  }

  return [...bySplit.entries()]
    .sort((a, b) => splitRank(a[0]) - splitRank(b[0]) || a[0].localeCompare(b[0]))
    .map(([split, rowMap]) => {
      const rows = [...rowMap.entries()].map(([key, group]) => {
        const first = group[0]
        return by === 'muscle'
          ? { key, group: null, label: key, ...statsFor(group) }
          : {
              key,
              group: first.equipment || '',
              label: first.exercise_name,
              ...statsFor(group),
            }
      })

      if (by === 'muscle') {
        rows.sort(
          (a, b) =>
            MUSCLE_ORDER.indexOf(a.label) - MUSCLE_ORDER.indexOf(b.label) ||
            a.label.localeCompare(b.label),
        )
      } else {
        const rank = (code) => {
          const i = EQUIPMENT_ORDER.indexOf(code)
          return i === -1 ? EQUIPMENT_ORDER.length : i
        }
        // Alphabetical by lift, so the same movement on two resistances sits
        // on adjacent rows — the resistance tag is what tells them apart.
        rows.sort(
          (a, b) => a.label.localeCompare(b.label) || rank(a.group) - rank(b.group),
        )
      }

      return {
        split,
        rows,
        totals: statsFor([...rowMap.values()].flat()),
      }
    })
}
