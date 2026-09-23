import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import WorkoutList from './pages/WorkoutList.jsx'
import NewWorkout from './pages/NewWorkout.jsx'
import WorkoutDetail from './pages/WorkoutDetail.jsx'
import Exercises from './pages/Exercises.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import { useAuth } from './auth.jsx'

function Nav() {
  const { user, logout } = useAuth()
  return (
    <nav className="nav">
      <span className="brand">🏋️ Fitness Tracker</span>
      {user ? (
        <>
          <NavLink to="/" end className={({ isActive }) => 'link' + (isActive ? ' active' : '')}>
            Home
          </NavLink>
          <NavLink to="/journal" className={({ isActive }) => 'link' + (isActive ? ' active' : '')}>
            Journal
          </NavLink>
          <NavLink to="/exercises" className={({ isActive }) => 'link' + (isActive ? ' active' : '')}>
            Exercises
          </NavLink>
          <span className="spacer" />
          <NavLink to="/workouts/new" className="btn small">
            + New workout
          </NavLink>
          <span className="muted" style={{ marginLeft: 12 }}>{user.username}</span>
          <button className="btn small ghost" onClick={logout} style={{ marginLeft: 8 }}>
            Log out
          </button>
        </>
      ) : (
        // `/` is public now, so signed-out visitors still need a way in.
        <>
          <span className="spacer" />
          <NavLink to="/login" className={({ isActive }) => 'link' + (isActive ? ' active' : '')}>
            Log in
          </NavLink>
          <NavLink to="/register" className="btn small">
            Sign up
          </NavLink>
        </>
      )}
    </nav>
  )
}

// Gate app routes behind auth; wait out the initial token check to avoid a flash.
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <>
      <Nav />
      <div className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Home />} />
          <Route path="/journal" element={<ProtectedRoute><WorkoutList /></ProtectedRoute>} />
          <Route path="/workouts/new" element={<ProtectedRoute><NewWorkout /></ProtectedRoute>} />
          <Route path="/workouts/:id/edit" element={<ProtectedRoute><NewWorkout /></ProtectedRoute>} />
          <Route path="/workouts/:id" element={<ProtectedRoute><WorkoutDetail /></ProtectedRoute>} />
          <Route path="/exercises" element={<ProtectedRoute><Exercises /></ProtectedRoute>} />
        </Routes>
      </div>
    </>
  )
}
