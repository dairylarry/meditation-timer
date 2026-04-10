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

      <div className="log-session-body">
        <div className="log-card">
          <div className="log-row">
            <span className="log-row-label">time</span>
            <input
              className="log-time-input"
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
            />
          </div>
          <div className="log-divider" />
          <div className="log-row">
            <span className="log-row-label">duration</span>
            <div className="log-duration">
              <button className="log-picker-btn" onClick={() => setDuration(d => Math.max(1, d - 1))}>−</button>
              <span className="log-duration-value">{duration}<span className="log-duration-unit"> min</span></span>
              <button className="log-picker-btn" onClick={() => setDuration(d => d + 1)}>+</button>
            </div>
          </div>
        </div>

        <div className="log-card">
          <textarea
            className="log-note-textarea"
            placeholder="how was your session? (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={4}
          />
        </div>

        {error && <div className="log-error">{error}</div>}

        <button
          className="log-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'saving…' : 'save'}
        </button>
      </div>
    </div>
  )
}
