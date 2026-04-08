import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Session from './pages/Session'
import History from './pages/History'
import Brahmavihara from './pages/Brahmavihara'
import Account from './pages/Account'
import Login from './pages/Login'
import './styles/App.css'

function AuthedRoutes() {
  const { authState } = useAuth()

  if (authState === 'loading') {
    return <div className="app-loading" />
  }

  if (authState === 'unauthenticated') {
    return <Login />
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/session" element={<Session />} />
      <Route path="/history" element={<History />} />
      <Route path="/brahmavihara" element={<Brahmavihara />} />
      <Route path="/account" element={<Account />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/meditation-timer">
      <AuthProvider>
        <AuthedRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
