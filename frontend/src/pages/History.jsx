import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MonthGrid from '../components/MonthGrid'
import { fetchSessions } from '../lib/sessions'
import { useAuth } from '../context/AuthContext'
import '../styles/History.css'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function formatTime(isoString) {
  const d = new Date(isoString)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatSelectedDate(dateStr) {
  // dateStr is YYYY-MM-DD — parse as local date to avoid timezone shifts
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function History() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [completedDates, setCompletedDates] = useState(new Set())
  const [sessionsByDate, setSessionsByDate] = useState({})
  const [earliestDate, setEarliestDate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(now.getFullYear())

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  // Hide left arrow if we're at or before the earliest month with data
  const isEarliestMonth = earliestDate
    ? year < earliestDate.year || (year === earliestDate.year && month <= earliestDate.month)
    : true // hide by default until data loads

  useEffect(() => {
    if (!user?.userId) return
    fetchSessions({ userId: user.userId })
      .then(sessions => {
        const dates = new Set(sessions.map(s => s.date))
        setCompletedDates(dates)

        // Group sessions by date
        const byDate = {}
        for (const s of sessions) {
          if (!byDate[s.date]) byDate[s.date] = []
          byDate[s.date].push(s)
        }
        setSessionsByDate(byDate)

        if (sessions.length > 0) {
          const sorted = sessions.map(s => s.date).sort()
          const [y, m] = sorted[0].split('-').map(Number)
          setEarliestDate({ year: y, month: m - 1 })
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [user?.userId])

  // Set of 'YYYY-MM' strings that have at least one session
  const monthsWithData = new Set(
    [...completedDates].map(d => d.slice(0, 7))
  )

  function selectPickerMonth(m) {
    setMonth(m)
    setYear(pickerYear)
    setSelectedDate(null)
    setPickerOpen(false)
  }

  function goBack() {
    setSelectedDate(null)
    if (month === 0) {
      setMonth(11)
      setYear(y => y - 1)
    } else {
      setMonth(m => m - 1)
    }
  }

  function goForward() {
    if (isCurrentMonth) return
    setSelectedDate(null)
    if (month === 11) {
      setMonth(0)
      setYear(y => y + 1)
    } else {
      setMonth(m => m + 1)
    }
  }

  const selectedSessions = selectedDate
    ? (sessionsByDate[selectedDate] || []).slice().sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    : []

  return (
    <div className="history">
      <button className="btn-back" onClick={() => navigate('/')}>
        ← back
      </button>
      <h1 className="history-title">History</h1>

      <div className="history-nav">
        {!isEarliestMonth ? (
          <button className="history-arrow" onClick={goBack}>←</button>
        ) : (
          <span className="history-arrow history-arrow-hidden">←</span>
        )}
        <button
          className="history-month-btn"
          onClick={() => { setPickerYear(year); setPickerOpen(v => !v) }}
        >
          {MONTH_NAMES[month]} {year} <span className="history-month-caret">▾</span>
        </button>
        {!isCurrentMonth ? (
          <button className="history-arrow" onClick={goForward}>→</button>
        ) : (
          <span className="history-arrow history-arrow-hidden">→</span>
        )}
      </div>

      {pickerOpen && (
        <div className="history-picker">
          <div className="history-picker-year-nav">
            <button
              className="history-picker-year-arrow"
              onClick={() => setPickerYear(y => y - 1)}
              disabled={earliestDate && pickerYear <= earliestDate.year}
            >←</button>
            <span className="history-picker-year">{pickerYear}</span>
            <button
              className="history-picker-year-arrow"
              onClick={() => setPickerYear(y => y + 1)}
              disabled={pickerYear >= now.getFullYear()}
            >→</button>
          </div>
          <div className="history-picker-grid">
            {MONTH_ABBR.map((abbr, m) => {
              const isFuture = pickerYear > now.getFullYear() ||
                (pickerYear === now.getFullYear() && m > now.getMonth())
              const hasData = monthsWithData.has(
                `${pickerYear}-${String(m + 1).padStart(2, '0')}`
              )
              const isActive = pickerYear === year && m === month
              const disabled = isFuture || (!hasData && !isActive)
              return (
                <button
                  key={m}
                  className={`history-picker-month${isActive ? ' history-picker-month-active' : ''}`}
                  disabled={disabled}
                  onClick={() => selectPickerMonth(m)}
                >
                  {abbr}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {loading && <p className="history-status">Loading…</p>}
      {error && <p className="history-status history-error">Failed to load: {error}</p>}

      {!loading && !error && (
        <div className="history-months">
          <MonthGrid
            year={year}
            month={month}
            completedDates={completedDates}
            selectedDate={selectedDate}
            onDayClick={setSelectedDate}
          />
        </div>
      )}

      {!loading && !error && selectedDate && selectedSessions.length > 0 && (
        <div className="history-detail">
          <div className="history-detail-date">{formatSelectedDate(selectedDate)}</div>
          {selectedSessions.map(s => (
            <div key={s.completedAt} className="history-detail-session">
              <div className="history-detail-row">
                <span className="history-detail-time">{formatTime(s.completedAt)}</span>
                <span className="history-detail-duration">{s.durationMinutes} min</span>
              </div>
              {s.note && (
                <div className="history-detail-note">{s.note}</div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
