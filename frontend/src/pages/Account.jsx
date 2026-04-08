import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/Account.css'

export default function Account() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  async function handleLogout() {
    await logout()
    // AuthProvider will flip authState; App will render Login automatically.
  }

  return (
    <div className="account">
      <button className="btn-back" onClick={() => navigate('/')}>
        ← back
      </button>
      <h1 className="account-title">account</h1>
      <div className="account-info">
        <div className="account-label">signed in as</div>
        <div className="account-username">{user?.username || '—'}</div>
      </div>
      <button className="account-logout" onClick={handleLogout}>
        log out
      </button>
    </div>
  )
}
