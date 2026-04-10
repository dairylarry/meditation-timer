import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSessions, updateSessionNote } from '../lib/sessions'
import { useAuth } from '../context/AuthContext'
import '../styles/Reflect.css'

function formatTime(isoString) {
  const d = new Date(isoString)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function todayDateString() {
  return new Date().toISOString().split('T')[0]
}

export default function Reflect() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [todaySessions, setTodaySessions] = useState([])
  const [selected, setSelected] = useState(null) // the session object being edited
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    if (!user?.userId) return
    const today = todayDateString()
    fetchSessions({ userId: user.userId })
      .then(sessions => {
        const mine = sessions
          .filter(s => s.date === today)
          .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
        setTodaySessions(mine)
        // Auto-select if there's only one session today.
        if (mine.length === 1) {
          setSelected(mine[0])
          setNoteText(mine[0].note || '')
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [user?.userId])

  function pickSession(s) {
    setSelected(s)
    setNoteText(s.note || '')
    setSavedFlash(false)
  }

  function backFromEditor() {
    // If there are multiple sessions today, go back to the picker.
    // Otherwise (single session) go back to landing.
    if (todaySessions.length > 1) {
      setSelected(null)
      setNoteText('')
      setSavedFlash(false)
    } else {
      navigate('/')
    }
  }

  async function handleSave() {
    if (!selected || !user?.userId) return
    setSaving(true)
    setError('')
    try {
      await updateSessionNote({
        userId: user.userId,
        completedAt: selected.completedAt,
        note: noteText.trim(),
      })
      // Update local copy so a subsequent pick shows the saved text
      setTodaySessions(prev =>
        prev.map(s => s.completedAt === selected.completedAt ? { ...s, note: noteText.trim() } : s)
      )
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (e) {
      setError('save failed, try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="reflect">
      <button
        className="btn-back"
        onClick={() => selected && todaySessions.length > 1 ? backFromEditor() : navigate('/')}
      >
        ← back
      </button>
      <h1 className="reflect-title">reflect</h1>

      {loading && <p className="reflect-status">loading…</p>}
      {error && !loading && <p className="reflect-status reflect-error">{error}</p>}

      {!loading && !error && todaySessions.length === 0 && (
        <p className="reflect-status">no sessions today</p>
      )}

      {!loading && !error && todaySessions.length > 1 && !selected && (
        <div className="reflect-picker">
          <div className="reflect-picker-label">pick a session</div>
          {todaySessions.map(s => (
            <button
              key={s.completedAt}
              className="reflect-picker-card"
              onClick={() => pickSession(s)}
            >
              <span className="reflect-picker-time">{formatTime(s.completedAt)}</span>
              <span className="reflect-picker-duration">{s.durationMinutes} min</span>
              {s.note && <span className="reflect-picker-dot" />}
            </button>
          ))}
        </div>
      )}

      {!loading && !error && selected && (
        <div className="reflect-editor">
          <div className="reflect-editor-context">
            <span>{formatTime(selected.completedAt)}</span>
            <span>·</span>
            <span>{selected.durationMinutes} min</span>
          </div>
          <textarea
            className="reflect-textarea"
            placeholder="how was your session?"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={8}
            autoFocus
          />
          {savedFlash && <div className="reflect-saved">saved</div>}
          <button
            className="reflect-save"
            onClick={handleSave}
            disabled={saving || !noteText.trim()}
          >
            {saving ? 'saving…' : 'save'}
          </button>
        </div>
      )}
    </div>
  )
}
