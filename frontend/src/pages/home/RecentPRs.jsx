import { Link } from 'react-router-dom'
import { hasWorkingSets, recentRecords } from '../../stats.js'

// Records set lately: the last few times a lift went above its previous best.
// Complements the all-time board below it — this one is about what just moved.
export default function RecentPRs({ workouts, limit = 5 }) {
  const records = recentRecords(workouts, limit)

  // With no strength history at all, the all-time section already says so.
  if (records.length === 0 && !hasWorkingSets(workouts)) return null

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Recent PRs</h2>
        <span className="muted small">Newest first</span>
      </div>

      {records.length === 0 ? (
        <div className="muted small" style={{ marginTop: 10 }}>
          No new PRs yet — beat a previous best and it'll show up here.
        </div>
      ) : (
        records.map((r) => (
          <div key={`${r.exerciseId}-${r.date}-${r.weight}`} className="pr-row">
            <div>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                {r.split && <span className={`pill ${r.split}`}>{r.split}</span>}
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                up from {r.previousWeight} {r.previousUnit} ·{' '}
                <Link to={`/workouts/${r.workoutId}`}>{r.date}</Link>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="pr-value">
                {r.weight} {r.weightUnit}
              </div>
              <div className="pr-gain small">
                +{r.gain} {r.weightUnit}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
