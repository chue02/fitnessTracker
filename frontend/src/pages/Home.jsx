import { useAuth } from '../auth.jsx'
import MemberHome from './home/MemberHome.jsx'
import GuestHome from './home/GuestHome.jsx'

// The one public route. It picks a home screen by session rather than
// redirecting, so the signed-out experience can grow independently of the
// member dashboard — swap or extend GuestHome and nothing else moves.
export default function Home() {
  const { user, loading } = useAuth()
  // Same anti-flash rule as ProtectedRoute: don't show the guest page to
  // someone whose stored token is still being resolved.
  if (loading) return null
  return user ? <MemberHome user={user} /> : <GuestHome />
}
