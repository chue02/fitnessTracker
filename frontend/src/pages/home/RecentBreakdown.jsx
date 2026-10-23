import { useState } from 'react'
import BreakdownTable, { ByToggle } from '../../components/BreakdownTable.jsx'
import { weeklyBreakdown } from '../../stats.js'

const WINDOW_DAYS = 7

// A pivot of the last week's lifting, by exercise or by muscle. Modelled on the
// user's spreadsheet: Lbs Wtd Avg is Σ(weight × reps) / Σ(reps), i.e. volume per
// rep, not a flat mean of the set weights.
export default function RecentBreakdown({ workouts }) {
  const [by, setBy] = useState('exercise')
  const sections = weeklyBreakdown(workouts, { by, days: WINDOW_DAYS })

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Last {WINDOW_DAYS} days</h2>
        <ByToggle by={by} onChange={setBy} />
      </div>

      {sections.length === 0 ? (
        <div className="muted small" style={{ marginTop: 14 }}>
          No strength sets logged in the last {WINDOW_DAYS} days.
        </div>
      ) : (
        <BreakdownTable sections={sections} by={by} />
      )}
    </div>
  )
}
