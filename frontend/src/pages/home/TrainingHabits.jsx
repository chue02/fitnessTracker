import { avgWorkoutsPerWeek, splitBalance, weekStreaks } from '../../stats.js'

// A split untrained for longer than this gets its gap tinted, so neglect is
// visible without reading the numbers.
const STALE_DAYS = 10
const WINDOW_DAYS = 30

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

function SplitRow({ row, max }) {
  const width = max > 0 ? Math.round((row.sessions / max) * 100) : 0
  const stale = row.daysSince === null || row.daysSince > STALE_DAYS
  return (
    <div className="split-row">
      <span className={`split-name ${row.split}`}>{row.split}</span>
      <span className="split-bar">
        {/* A zero-session split still shows its track, so the gap is legible. */}
        <span className={`split-bar-fill ${row.split}`} style={{ width: `${width}%` }} />
      </span>
      <span className="split-count muted small">
        {row.sessions} session{row.sessions === 1 ? '' : 's'}
      </span>
      <span className={`split-since small${stale ? ' split-stale' : ''}`}>
        {row.daysSince === null
          ? '—'
          : row.daysSince === 0
            ? 'today'
            : `${row.daysSince}d ago`}
      </span>
    </div>
  )
}

// How consistently the user trains, and what they're neglecting — the two
// questions a week-at-a-time view can't answer.
export default function TrainingHabits({ workouts }) {
  const streaks = weekStreaks(workouts)
  const avg = avgWorkoutsPerWeek(workouts)
  const balance = splitBalance(workouts, new Date(), WINDOW_DAYS)
  const max = Math.max(...balance.map((b) => b.sessions), 0)

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Training habits</h2>

      <div className="stat-row" style={{ marginTop: 0 }}>
        <Stat
          label="Week streak"
          value={`${streaks.current} week${streaks.current === 1 ? '' : 's'}`}
        />
        <Stat label="Longest streak" value={`${streaks.longest} wk`} />
        {/* No completed weeks yet (or none in range) — "0" would read as a
            judgement rather than "not enough history". */}
        <Stat label="Avg / week" value={avg > 0 ? avg : '—'} />
        <Stat label="Total workouts" value={streaks.totalWorkouts} />
      </div>

      <div className="split-balance">
        <div className="muted small">Split balance · last {WINDOW_DAYS} days</div>
        {balance.map((row) => (
          <SplitRow key={row.split} row={row} max={max} />
        ))}
      </div>
    </div>
  )
}
