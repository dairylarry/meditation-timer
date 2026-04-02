import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/Landing.css'

export default function Landing() {
  const navigate = useNavigate()
  const [duration, setDuration] = useState(10)
  const [showCountdown, setShowCountdown] = useState(false)

  useEffect(() => {
    const savedDuration = localStorage.getItem('lastDuration')
    if (savedDuration) setDuration(parseInt(savedDuration, 10))
    const savedShow = localStorage.getItem('showCountdown')
    if (savedShow !== null) setShowCountdown(savedShow === 'true')
  }, [])

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
        <button className="btn-history" onClick={() => navigate('/history')}>
          history
        </button>
        <button className="btn-history" onClick={() => navigate('/brahmavihara')}>
          brahmavihārā 4
        </button>
      </div>
    </div>
  )
}
