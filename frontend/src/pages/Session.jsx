import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ProgressRing from '../components/ProgressRing'
import { getOrCreateContext, startKeepalive, stopKeepalive, loadGong, playBuffer, closeContext } from '../lib/audio'
import { recordSession, updateSessionNote } from '../lib/sessions'
import { meditationDate } from '../lib/dateUtils'
import { useAuth } from '../context/AuthContext'
import '../styles/Session.css'

const COUNTDOWN_SECONDS = 10

export default function Session() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const duration = location.state?.duration || parseInt(localStorage.getItem('lastDuration'), 10) || 10
  const showCountdown = location.state?.showCountdown ?? (localStorage.getItem('showCountdown') === 'true')
  const totalSeconds = duration * 60

  const [timerState, setTimerState] = useState('countdown') // countdown | running | done
  const [remaining, setRemaining] = useState(totalSeconds)
  const [countdownLeft, setCountdownLeft] = useState(COUNTDOWN_SECONDS)
  const [finishTime, setFinishTime] = useState('')

  // Note state for the done screen. `completedAt` is the ISO timestamp of the
  // just-finished session, used as the SK for the DynamoDB update.
  const [completedAt, setCompletedAt] = useState(null)
  const [noteMode, setNoteMode] = useState('hidden') // hidden | editing | saved
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteError, setNoteError] = useState('')

  const originRef = useRef(null)
  const intervalRef = useRef(null)
  const halfwayFiredRef = useRef(false)
  const wakeLockRef = useRef(null)
  const gongMidRef = useRef(null)
  const gongEndRef = useRef(null)

  const handleDone = useCallback(async () => {
    clearInterval(intervalRef.current)
    setTimerState('done')
    setRemaining(0)

    // Record to DynamoDB before playing end gong
    const nowIso = new Date().toISOString()
    setCompletedAt(nowIso)
    try {
      await recordSession({
        userId: user?.userId,
        date: meditationDate(),
        completedAt: nowIso,
        durationMinutes: duration,
      })
    } catch (e) {
      console.warn('Failed to record session:', e.message)
    }

    // Play end gong
    try {
      const ctx = getOrCreateContext()
      if (gongEndRef.current) playBuffer(ctx, gongEndRef.current)
    } catch (_) {}

    stopKeepalive()
    releaseWakeLock()
  }, [duration, user?.userId])

  async function handleSaveNote() {
    if (!completedAt || !user?.userId) return
    setNoteSaving(true)
    setNoteError('')
    try {
      await updateSessionNote({
        userId: user.userId,
        completedAt,
        note: noteText.trim(),
      })
      setNoteMode('saved')
    } catch (e) {
      console.warn('Failed to save note:', e.message)
      setNoteError('save failed, try again')
    } finally {
      setNoteSaving(false)
    }
  }

  function releaseWakeLock() {
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
      wakeLockRef.current = null
    }
  }

  function startMeditationTimer(ctx) {
    const end = new Date(Date.now() + totalSeconds * 1000)
    setFinishTime(end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
    originRef.current = ctx.currentTime

    intervalRef.current = setInterval(() => {
      const elapsed = ctx.currentTime - originRef.current
      const left = Math.max(0, totalSeconds - elapsed)

      setRemaining(Math.ceil(left))

      // Halfway gong
      if (!halfwayFiredRef.current && elapsed >= totalSeconds / 2) {
        halfwayFiredRef.current = true
        if (gongMidRef.current) {
          try { playBuffer(ctx, gongMidRef.current) } catch (_) {}
        }
      }

      // Done
      if (left <= 0) {
        handleDone()
      }
    }, 250)
  }

  // Initialize audio and countdown on mount
  useEffect(() => {
    // Use 'playback' so gongs bypass the iOS silent/mute switch (iOS 17.4+).
    // Tradeoff: pauses Spotify/music when a session starts.
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'playback' } catch (_) {}
    }

    const ctx = getOrCreateContext()
    startKeepalive(ctx)

    // Request wake lock
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then(lock => { wakeLockRef.current = lock })
        .catch(() => {})
    }

    // Pre-decode gong audio
    const base = import.meta.env.BASE_URL
    loadGong(ctx, `${base}gong-mid.mp3`).then(buf => { gongMidRef.current = buf }).catch(() => {})
    loadGong(ctx, `${base}gong-end.mp3`).then(buf => { gongEndRef.current = buf }).catch(() => {})

    // Start the countdown
    const countdownOrigin = ctx.currentTime

    intervalRef.current = setInterval(() => {
      const elapsed = ctx.currentTime - countdownOrigin
      const left = Math.max(0, COUNTDOWN_SECONDS - elapsed)
      setCountdownLeft(Math.ceil(left))

      if (left <= 0) {
        clearInterval(intervalRef.current)
        // Play gong-mid to signal meditation is starting
        if (gongMidRef.current) {
          try { playBuffer(ctx, gongMidRef.current) } catch (_) {}
        }
        setTimerState('running')
        startMeditationTimer(ctx)
      }
    }, 250)

    return () => {
      clearInterval(intervalRef.current)
      stopKeepalive()
      closeContext()
      releaseWakeLock()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Resume AudioContext + wake lock after iOS backgrounding
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && timerState !== 'done') {
        const ctx = getOrCreateContext()
        if (ctx.state === 'suspended') ctx.resume()
        if (!wakeLockRef.current && 'wakeLock' in navigator) {
          navigator.wakeLock.request('screen')
            .then(lock => { wakeLockRef.current = lock })
            .catch(() => {})
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [timerState])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`
  const progress = totalSeconds > 0 ? 1 - remaining / totalSeconds : 1

  const dimmed = timerState === 'running'

  return (
    <div className={`session${dimmed ? ' session-dimmed' : ''}`}>
      <button className="btn-back" onClick={() => navigate('/')}>
        ← back
      </button>
      {timerState === 'countdown' && (
        <div className="session-countdown">
          <div className="session-countdown-value">{countdownLeft}</div>
          <div className="session-countdown-label">get ready</div>
        </div>
      )}

      {timerState === 'running' && (
        <>
          <ProgressRing progress={progress} />
          {showCountdown && <div className="session-time">{timeStr}</div>}
          <div className="session-finish">session ends at {finishTime}</div>
        </>
      )}

      {timerState === 'done' && (
        <div className="session-done">
          <div className="session-done-text">done</div>

          {noteMode === 'hidden' && (
            <button
              className="session-note-link"
              onClick={() => setNoteMode('editing')}
            >
              + add note
            </button>
          )}

          {noteMode === 'editing' && (
            <div className="session-note-editor">
              <textarea
                className="session-note-textarea"
                placeholder="how was your session?"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={5}
                autoFocus
              />
              {noteError && <div className="session-note-error">{noteError}</div>}
              <button
                className="session-note-save"
                onClick={handleSaveNote}
                disabled={noteSaving || !noteText.trim()}
              >
                {noteSaving ? 'saving…' : 'save'}
              </button>
            </div>
          )}

          {noteMode === 'saved' && (
            <div className="session-note-saved">note saved</div>
          )}
        </div>
      )}

    </div>
  )
}
