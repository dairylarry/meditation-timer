import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ProgressRing from '../components/ProgressRing'
import { getOrCreateContext, startKeepalive, stopKeepalive, loadGong, playBuffer, closeContext } from '../lib/audio'
import { recordSession } from '../lib/sessions'
import '../styles/Session.css'

const COUNTDOWN_SECONDS = 10

export default function Session() {
  const location = useLocation()
  const navigate = useNavigate()
  const duration = location.state?.duration || parseInt(localStorage.getItem('lastDuration'), 10) || 10
  const showCountdown = location.state?.showCountdown ?? (localStorage.getItem('showCountdown') === 'true')
  const totalSeconds = duration * 60

  const [timerState, setTimerState] = useState('countdown') // countdown | running | done
  const [remaining, setRemaining] = useState(totalSeconds)
  const [countdownLeft, setCountdownLeft] = useState(COUNTDOWN_SECONDS)
  const [finishTime, setFinishTime] = useState('')

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
    try {
      await recordSession({
        date: new Date().toISOString().split('T')[0],
        completedAt: new Date().toISOString(),
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
  }, [duration])

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
    // Set ambient audio session so gongs mix with Spotify (iOS 17.4+)
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'ambient' } catch (_) {}
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
        </div>
      )}

      <button className="btn-back" onClick={() => navigate('/')}>
        ← back
      </button>
    </div>
  )
}
