import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { recordSession } from '../lib/sessions'
import { useAuth } from '../context/AuthContext'
import { meditationDate } from '../lib/dateUtils'
import '../styles/LogSession.css'

function nowTimeString() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function LogSession() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [time, setTime] = useState(nowTimeString())
  const [duration, setDuration] = useState(10)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const date = meditationDate()
      // Build completedAt from today's meditation date + chosen time
      const [y, m, d] = date.split('-').map(Number)
      const [h, min] = time.split(':').map(Number)
      const completedAt = new Date(y, m - 1, d, h, min, 0).toISOString()
      await recordSession({
        userId: user.userId,
        date,
        completedAt,
        durationMinutes: duration,
        note: note.trim() || undefined,
      })
      navigate('/')
    } catch (e) {
      setError('failed to save, try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="log-session">
      <button className="btn-back" onClick={() => navigate('/')}>← back</button>
      <h1 className="log-session-title">log session</h1>

      <div className="log-session-form">
        <div className="log-session-field">
          <label className="log-session-label">time</label>
          <input
            className="log-session-time"
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
          />
        </div>

        <div className="log-session-field">
          <label className="log-session-label">duration</label>
          <div className="log-session-duration">
            <button
              className="picker-btn"
              onClick={() => setDuration(d => Math.max(1, d - 1))}
            >−</button>
            <div className="duration-display">
              <span className="duration-value">{duration}</span>
              <span className="duration-unit">min</span>
            </div>
            <button
              className="picker-btn"
              onClick={() => setDuration(d => d + 1)}
            >+</button>
          </div>
        </div>

        <div className="log-session-field">
          <label className="log-session-label">note <span className="log-session-optional">(optional)</span></label>
          <textarea
            className="log-session-textarea"
            placeholder="how was your session?"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={4}
          />
        </div>

        {error && <div className="log-session-error">{error}</div>}

        <button
          className="log-session-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'saving…' : 'save'}
        </button>
      </div>
    </div>
  )
}
