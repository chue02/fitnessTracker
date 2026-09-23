import { Link } from 'react-router-dom'

// The home screen for a visitor with no session. Deliberately minimal — it's
// the counterpart to MemberHome, and the place to grow a real landing page.
export default function GuestHome() {
  return (
    <div>
      <h1>Track every set, see every PR.</h1>
      <p className="muted" style={{ marginTop: -8, maxWidth: 520 }}>
        Log strength and cardio workouts set by set, watch your week take shape, and keep
        your personal records in one place.
      </p>

      <div className="row" style={{ marginTop: 20 }}>
        <Link to="/register" className="btn">
          Create an account
        </Link>
        <Link to="/login" className="btn secondary">
          Log in
        </Link>
      </div>

      <div className="card" style={{ marginTop: 28 }}>
        <h2 style={{ marginTop: 0 }}>What you get</h2>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-value">Weekly view</div>
            <div className="muted small">Sun–Sat at a glance, tinted by split</div>
          </div>
          <div className="stat">
            <div className="stat-value">Per-set logging</div>
            <div className="muted small">Reps, weight, equipment, warmups</div>
          </div>
          <div className="stat">
            <div className="stat-value">Automatic PRs</div>
            <div className="muted small">Your heaviest lifts, tracked for you</div>
          </div>
        </div>
      </div>
    </div>
  )
}
