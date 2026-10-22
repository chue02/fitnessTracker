import { Link } from 'react-router-dom'
import { formatDuration, shortDate } from '../format.js'

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
        <div className="muted small">
          {day.isFuture ? 'Nothing logged yet.' : 'Rest day — nothing logged.'}
        </div>
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

// One day on a calendar (the home week strip or a month grid), from
// `weekDays`/`monthDays`: the date, a dot marking whether it was trained, and
// a hover tooltip. `showLetter` adds the weekday initial above the date, for
// strips without a header row.
export default function DayCell({ day, showLetter = false }) {
  // Cardio has no split, so a cardio-only day would fall through to the
  // default accent and look identical to strength. Tint it like the
  // cardio pill instead. A mixed day keeps its split hue.
  const tone = day.split || (day.summary.cardioSegments > 0 ? 'cardio' : '')
  const cell = (
    <>
      {showLetter && <div className="muted small">{day.letter}</div>}
      <div className="week-day-num">{day.dayOfMonth}</div>
      <div className={`dot ${day.workouts.length ? `on ${tone}` : ''}`.trim()} />
      <DayTooltip day={day} />
    </>
  )
  // Sunday and Saturday cells sit on the calendar's edges, where a centered
  // tooltip would hang off the card.
  const edge = day.weekday === 0 ? ' edge-start' : day.weekday === 6 ? ' edge-end' : ''
  const className = `week-day${day.isToday ? ' today' : ''}${edge}`
  // Days with a workout jump straight to it; the rest are inert, but
  // still hoverable so the tooltip can say the day was a rest day.
  return day.workouts.length ? (
    <Link to={`/workouts/${day.workouts[0].id}`} className={className} style={{ color: 'inherit' }}>
      {cell}
    </Link>
  ) : (
    <div className={className} tabIndex={0}>
      {cell}
    </div>
  )
}
