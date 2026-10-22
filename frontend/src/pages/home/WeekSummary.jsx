import { useState } from 'react'
import { Link } from 'react-router-dom'
import DayCell from '../../components/DayCell.jsx'
import { formatDuration, shortDate } from '../../format.js'
import { summarizeWorkouts, weekDays, weekRange, weekTotals } from '../../stats.js'

// The strip pages back one week and no further.
const MAX_WEEKS_BACK = 1

// `delta` is the change from the same stat a week earlier; null hides the line.
// Up reads green, down reads muted grey rather than red — a deload week isn't a
// failure, and the arrow already carries the direction.
function Stat({ label, value, delta = null, format = (n) => n }) {
  return (
    <div className="stat">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
      {delta !== null && delta !== 0 && (
        <div className={`stat-delta small${delta > 0 ? ' up' : ''}`}>
          {delta > 0 ? '▲ +' : '▼ -'}
          {format(Math.abs(delta))}
        </div>
      )}
    </div>
  )
}

// This week at a glance: a Sun–Sat strip marking the days trained, plus totals.
export default function WeekSummary({ workouts }) {
  // Whole weeks back from the current one; 0 is this week.
  const [weekOffset, setWeekOffset] = useState(0)

  const today = new Date()
  const anchor = new Date(today.getFullYear(), today.getMonth(), today.getDate() - weekOffset * 7)
  const range = weekRange(anchor)
  // `today` stays the real today, so the highlight only appears on week 0.
  const days = weekDays(workouts, range, today)
  const totals = weekTotals(days)

  // The week before the one on screen, for the deltas. Paging back keeps the
  // comparison relative, so "Last week" is measured against two weeks ago.
  const prevAnchor = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - 7)
  const prevRange = weekRange(prevAnchor)
  const prev = summarizeWorkouts(workouts.filter((w) => w.date >= prevRange.startIso && w.date <= prevRange.endIso))
  // Against an empty week every stat is "+everything" — noise on a new account.
  const delta = (key) => (prev.workoutCount > 0 ? totals[key] - prev[key] : null)

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>{weekOffset === 0 ? 'This week' : 'Last week'}</h2>
        <span className="row" style={{ gap: 8 }}>
          <button
            className="btn small ghost"
            onClick={() => setWeekOffset(weekOffset + 1)}
            disabled={weekOffset >= MAX_WEEKS_BACK}
            aria-label="Previous week"
            title={weekOffset >= MAX_WEEKS_BACK ? "That's as far back as this goes" : 'Previous week'}
          >
            ‹
          </button>
          <span className="muted small" style={{ minWidth: 104, textAlign: 'center' }}>
            {shortDate(range.startIso)} – {shortDate(range.endIso)}
          </span>
          <button
            className="btn small ghost"
            onClick={() => setWeekOffset(weekOffset - 1)}
            disabled={weekOffset === 0}
            aria-label="Next week"
            title={weekOffset === 0 ? 'Already on the current week' : 'Next week'}
          >
            ›
          </button>
        </span>
      </div>

      <div className="week-strip">
        {days.map((day) => (
          <DayCell key={day.iso} day={day} showLetter />
        ))}
      </div>

      {totals.workoutCount === 0 ? (
        <div className="muted small" style={{ marginTop: 14 }}>
          {weekOffset === 0 ? (
            <>
              Nothing logged this week yet. <Link to="/workouts/new">Start one →</Link>
            </>
          ) : (
            'No workouts logged this week.'
          )}
        </div>
      ) : (
        <div className="stat-row">
          <Stat label="Workouts" value={totals.workoutCount} delta={delta('workoutCount')} />
          <Stat label="Exercises" value={totals.exerciseCount} />
          {totals.workingSets > 0 && (
            <Stat label="Working sets" value={totals.workingSets} delta={delta('workingSets')} />
          )}
          {totals.volumeLb > 0 && (
            <Stat
              label="Volume"
              value={`${totals.volumeLb.toLocaleString()} lb`}
              delta={delta('volumeLb')}
              format={(n) => `${n.toLocaleString()} lb`}
            />
          )}
          {totals.cardioSeconds > 0 && (
            <Stat label="Cardio time" value={formatDuration(totals.cardioSeconds)} />
          )}
          {totals.cardioDistanceMi > 0 && (
            <Stat label="Cardio dist." value={`${totals.cardioDistanceMi.toFixed(1)} mi`} />
          )}
        </div>
      )}
    </div>
  )
}
