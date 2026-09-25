import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDuration } from '../../format.js'
import { summarizeWorkouts, weekDays, weekRange, weekTotals } from '../../stats.js'

// "Sep 20 – Sep 26" from two YYYY-MM-DD strings, without going through Date
// (which would reinterpret them as UTC).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function shortDate(iso) {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
}

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

function TipLine({ label, value }) {
  return (
    <div className="tip-line">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

// What a day's marker means, spelled out. Shown on hover and on keyboard focus;
// purely CSS-driven, so there's no hover state to track in React.
function DayTooltip({ day }) {
  const s = day.summary
  const trained = day.workouts.length > 0
  return (
    <div className="day-tip" role="tooltip">
      <div className="tip-date">
        {day.dayName}, {shortDate(day.iso)}
        {day.isToday && <span className="muted small"> · today</span>}
      </div>

      {!trained ? (
        <div className="muted small">Rest day — nothing logged.</div>
      ) : (
        <>
          <TipLine label="Split" value={s.split || '—'} />
          <TipLine label="Exercises" value={s.exerciseCount} />
          {s.totalSets > 0 && (
            <TipLine
              label="Sets"
              value={s.warmupSets ? `${s.totalSets} (${s.warmupSets} warmup)` : s.totalSets}
            />
          )}
          {/* A cardio-only day has no sets to report — count segments instead
              of showing a bare "Sets 0". */}
          {s.cardioSegments > 0 && (
            <TipLine
              label="Segments"
              value={s.cardioSegments}
            />
          )}
          {s.volumeLb > 0 && <TipLine label="Volume" value={`${s.volumeLb.toLocaleString()} lb`} />}
          {s.cardioSeconds > 0 && <TipLine label="Cardio" value={formatDuration(s.cardioSeconds)} />}
          {s.cardioDistanceMi > 0 && (
            <TipLine label="Distance" value={`${s.cardioDistanceMi.toFixed(1)} mi`} />
          )}
          {s.muscles.length > 0 && (
            <div className="tip-muscles">
              {s.muscles.map((m) => (
                <span key={m.name} className={`muscle primary ${m.split}`.trim()}>
                  {m.name}
                </span>
              ))}
            </div>
          )}
          {s.workoutCount > 1 && (
            <div className="muted small" style={{ marginTop: 6 }}>
              {s.workoutCount} workouts · opens the first
            </div>
          )}
        </>
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
        {days.map((day) => {
          // Cardio has no split, so a cardio-only day would fall through to the
          // default accent and look identical to strength. Tint it like the
          // cardio pill instead. A mixed day keeps its split hue.
          const tone = day.split || (day.summary.cardioSegments > 0 ? 'cardio' : '')
          const cell = (
            <>
              <div className="muted small">{day.letter}</div>
              <div className="week-day-num">{day.dayOfMonth}</div>
              <div className={`dot ${day.workouts.length ? `on ${tone}` : ''}`.trim()} />
              <DayTooltip day={day} />
            </>
          )
          const className = `week-day${day.isToday ? ' today' : ''}`
          // Days with a workout jump straight to it; the rest are inert, but
          // still hoverable so the tooltip can say the day was a rest day.
          return day.workouts.length ? (
            <Link
              key={day.iso}
              to={`/workouts/${day.workouts[0].id}`}
              className={className}
              style={{ color: 'inherit' }}
            >
              {cell}
            </Link>
          ) : (
            <div key={day.iso} className={className} tabIndex={0}>
              {cell}
            </div>
          )
        })}
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
