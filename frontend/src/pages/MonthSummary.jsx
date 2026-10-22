import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { errorMessage, formatDuration, monthLabel } from '../format.js'
import {
  breakdown, cardioBreakdown, DAY_LETTERS, groupByMonth, monthDays, monthRange, summarizeWorkouts,
} from '../stats.js'
import BreakdownTable, { ByToggle } from '../components/BreakdownTable.jsx'
import DayCell from '../components/DayCell.jsx'
import WorkoutCard from '../components/WorkoutCard.jsx'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

// The month as a Sun–Sat grid, a dot on each trained day — the home week
// strip, stretched to a month.
function MonthCalendar({ workouts, month }) {
  const days = monthDays(workouts, month)
  return (
    <div className="month-grid">
      {DAY_LETTERS.map((letter, i) => (
        <div key={i} className="month-grid-head muted small">{letter}</div>
      ))}
      {/* Blank cells push the 1st under its weekday. */}
      {Array.from({ length: days[0].weekday }, (_, i) => <div key={`pad-${i}`} />)}
      {days.map((day) => (
        <DayCell key={day.iso} day={day} />
      ))}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

// One month at a glance, reached from the journal's month dividers: a calendar
// of trained days and headline totals, the per-exercise strength pivot (same
// table as the home card), a cardio table, and the month's workouts.
export default function MonthSummary() {
  const { month } = useParams()
  const { user } = useAuth()
  const distanceUnit = user.profile?.weight_unit === 'kg' ? 'km' : 'mi'

  const [workouts, setWorkouts] = useState(null)
  const [error, setError] = useState(null)
  const [by, setBy] = useState('exercise')

  useEffect(() => {
    api.get('/workouts/').then(setWorkouts).catch((e) => setError(errorMessage(e)))
  }, [])

  if (!MONTH_RE.test(month)) return <div className="error">Not a month: {month}</div>
  if (error) return <div className="error">{error}</div>
  if (workouts === null) return <div className="empty">Loading…</div>

  // Neighbours are the nearest months that have workouts, so paging never
  // lands on an empty month. `groupByMonth` is newest first.
  const months = groupByMonth(workouts)
  const older = months.find((g) => g.month < month)?.month
  const newer = [...months].reverse().find((g) => g.month > month)?.month
  const monthWorkouts = months.find((g) => g.month === month)?.workouts || []

  const range = monthRange(month)
  const totals = summarizeWorkouts(monthWorkouts)
  const sections = breakdown(workouts, { by, ...range })
  const cardio = cardioBreakdown(workouts, { ...range, unit: distanceUnit })
  const totalReps = sections.reduce((n, s) => n + s.totals.reps, 0)
  const trainedDays = new Set(monthWorkouts.map((w) => w.date)).size

  return (
    <div>
      <Link to="/journal" className="small">← Journal</Link>
      <div className="row between" style={{ marginTop: 8 }}>
        <h1 style={{ margin: 0 }}>{monthLabel(month)}</h1>
        <span className="row" style={{ gap: 8 }}>
          {older ? (
            <Link to={`/journal/${older}`} className="btn small ghost" title={monthLabel(older)}>
              ‹ {monthLabel(older, { short: true })}
            </Link>
          ) : (
            <button className="btn small ghost" disabled title="No earlier workouts">‹</button>
          )}
          {newer ? (
            <Link to={`/journal/${newer}`} className="btn small ghost" title={monthLabel(newer)}>
              {monthLabel(newer, { short: true })} ›
            </Link>
          ) : (
            <button className="btn small ghost" disabled title="No later workouts">›</button>
          )}
        </span>
      </div>

      {monthWorkouts.length === 0 ? (
        <div className="empty" style={{ marginTop: 20 }}>
          Nothing logged in {monthLabel(month)}.
        </div>
      ) : (
        <>
          <div className="card" style={{ marginTop: 20 }}>
            <MonthCalendar workouts={monthWorkouts} month={month} />
            <div className="stat-row">
              <Stat label="Workouts" value={totals.workoutCount} />
              <Stat label="Days trained" value={trainedDays} />
              <Stat label="Exercises" value={totals.exerciseCount} />
              {totals.workingSets > 0 && <Stat label="Working sets" value={totals.workingSets} />}
              {totalReps > 0 && <Stat label="Reps" value={totalReps.toLocaleString()} />}
              {totals.volumeLb > 0 && (
                <Stat label="Volume" value={`${totals.volumeLb.toLocaleString()} lb`} />
              )}
              {totals.cardioSeconds > 0 && (
                <Stat label="Cardio time" value={formatDuration(totals.cardioSeconds)} />
              )}
              {cardio.some((c) => c.distance > 0) && (
                <Stat
                  label="Cardio dist."
                  value={`${cardio.reduce((d, c) => d + c.distance, 0).toFixed(1)} ${distanceUnit}`}
                />
              )}
            </div>
          </div>

          {sections.length > 0 && (
            <div className="card">
              <div className="row between">
                <h2 style={{ margin: 0 }}>Strength</h2>
                <ByToggle by={by} onChange={setBy} />
              </div>
              <BreakdownTable sections={sections} by={by} />
            </div>
          )}

          {cardio.length > 0 && (
            <div className="card">
              <h2 style={{ margin: 0 }}>Cardio</h2>
              <table className="breakdown">
                <thead>
                  <tr>
                    <th scope="col">Exercise</th>
                    <th scope="col" className="bd-num">Sessions</th>
                    <th scope="col" className="bd-num">Distance</th>
                    <th scope="col" className="bd-num">Time</th>
                    <th scope="col" className="bd-num">Avg pace</th>
                  </tr>
                </thead>
                <tbody>
                  {cardio.map((c) => (
                    <tr key={c.key}>
                      <td>{c.name}</td>
                      <td className="bd-num">{c.sessions}</td>
                      <td className="bd-num">
                        {c.distance > 0 ? `${c.distance.toFixed(2)} ${distanceUnit}` : '—'}
                      </td>
                      <td className="bd-num">{c.seconds > 0 ? formatDuration(c.seconds) : '—'}</td>
                      <td className="bd-num">
                        {c.pace != null ? `${formatDuration(Math.round(c.pace))} /${distanceUnit}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2>Workouts</h2>
          {monthWorkouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} />
          ))}
        </>
      )}
    </div>
  )
}
