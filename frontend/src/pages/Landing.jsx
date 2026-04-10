import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSessions } from '../lib/sessions'
import { useAuth } from '../context/AuthContext'
import '../styles/Landing.css'

export default function Landing() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [duration, setDuration] = useState(10)
  const [showCountdown, setShowCountdown] = useState(false)
  const [hasTodaySession, setHasTodaySession] = useState(false)

  useEffect(() => {
    const savedDuration = localStorage.getItem('lastDuration')
    if (savedDuration) setDuration(parseInt(savedDuration, 10))
    const savedShow = localStorage.getItem('showCountdown')
    if (savedShow !== null) setShowCountdown(savedShow === 'true')
  }, [])

  useEffect(() => {
    if (!user?.userId) return

    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const today = `${yyyy}-${mm}-${dd}`

    console.log("Checking for sessions matching:", today)

    fetchSessions({ userId: user.userId })
      .then(sessions => {
        console.log("Total sessions fetched:", sessions.length)
        
        const found = sessions.some(s => {
          // Log each session to see what the data actually looks like
          console.log(`Checking session: ID=${s.id || 'N/A'}, Date Value="${s.date}"`)
          
          const isMatch = s.date && (s.date === today || s.date.startsWith(today))
          
          if (isMatch) console.log("✅ Match found!")
          return isMatch
        })

        setHasTodaySession(found)
      })
      .catch((err) => {
        console.error("Failed to fetch sessions:", err)
      })
  }, [user?.userId])

  useEffect(() => {
    localStorage.setItem('lastDuration', String(duration))
  }, [duration])

  useEffect(() => {
    localStorage.setItem('showCountdown', String(showCountdown))
  }, [showCountdown])

  return (
    <div className="landing">
      <h1 className="landing-title">meditation</h1>

      <div className="duration-picker">
        <button
          className="picker-btn"
          onClick={() => setDuration(d => Math.max(1, d - 1))}
        >
          −
        </button>
        <div className="duration-display">
          <span className="duration-value">{duration}</span>
          <span className="duration-unit">min</span>
        </div>
        <button
          className="picker-btn"
          onClick={() => setDuration(d => d + 1)}
        >
          +
        </button>
      </div>

      <label className="toggle-row" onClick={() => setShowCountdown(v => !v)}>
        <span className="toggle-label">show countdown</span>
        <span className={`toggle-switch ${showCountdown ? 'toggle-on' : ''}`}>
          <span className="toggle-knob" />
        </span>
      </label>

      <button
        className="btn-start"
        onClick={() => navigate('/session', { state: { duration, showCountdown } })}
      >
        start
      </button>

      <div className="landing-links">
        {hasTodaySession && (
          <button className="btn-history" onClick={() => navigate('/reflect')}>
            reflect
          </button>
        )}
        <button className="btn-history" onClick={() => navigate('/history')}>
          history
        </button>
        <button className="btn-history" onClick={() => navigate('/brahmavihara')}>
          brahmavihārā 4
        </button>
        <button className="btn-history" onClick={() => navigate('/account')}>
          account
        </button>
      </div>
    </div>
  )
}
