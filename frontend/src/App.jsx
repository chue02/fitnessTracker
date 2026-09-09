import { NavLink, Route, Routes } from 'react-router-dom'
import WorkoutList from './pages/WorkoutList.jsx'
import NewWorkout from './pages/NewWorkout.jsx'
import WorkoutDetail from './pages/WorkoutDetail.jsx'
import Exercises from './pages/Exercises.jsx'

function Nav() {
  return (
    <nav className="nav">
      <span className="brand">🏋️ Fitness Tracker</span>
      <NavLink to="/" end className={({ isActive }) => 'link' + (isActive ? ' active' : '')}>
        Journal
      </NavLink>
      <NavLink to="/exercises" className={({ isActive }) => 'link' + (isActive ? ' active' : '')}>
        Exercises
      </NavLink>
      <span className="spacer" />
      <NavLink to="/workouts/new" className="btn small">
        + New workout
      </NavLink>
    </nav>
  )
}

export default function App() {
  return (
    <>
      <Nav />
      <div className="container">
        <Routes>
          <Route path="/" element={<WorkoutList />} />
          <Route path="/workouts/new" element={<NewWorkout />} />
          <Route path="/workouts/:id/edit" element={<NewWorkout />} />
          <Route path="/workouts/:id" element={<WorkoutDetail />} />
          <Route path="/exercises" element={<Exercises />} />
        </Routes>
      </div>
    </>
  )
}
