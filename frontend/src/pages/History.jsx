import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MonthGrid from '../components/MonthGrid'
import { fetchSessions } from '../lib/sessions'
import '../styles/History.css'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function History() {
  const navigate = useNavigate()
  const [completedDates, setCompletedDates] = useState(new Set())
  const [sessionsByDate, setSessionsByDate] = useState({})
  const [earliestDate, setEarliestDate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  // Hide left arrow if we're at or before the earliest month with data
  const isEarliestMonth = earliestDate
    ? year < earliestDate.year || (year === earliestDate.year && month <= earliestDate.month)
    : true // hide by default until data loads

  useEffect(() => {
    fetchSessions()
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
  }, [])

  function goBack() {
    if (month === 0) {
      setMonth(11)
      setYear(y => y - 1)
    } else {
      setMonth(m => m - 1)
    }
  }

  function goForward() {
    if (isCurrentMonth) return
    if (month === 11) {
      setMonth(0)
      setYear(y => y + 1)
    } else {
      setMonth(m => m + 1)
    }
  }

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
        <span className="history-month-label">{MONTH_NAMES[month]} {year}</span>
        {!isCurrentMonth ? (
          <button className="history-arrow" onClick={goForward}>→</button>
        ) : (
          <span className="history-arrow history-arrow-hidden">→</span>
        )}
      </div>

      {loading && <p className="history-status">Loading…</p>}
      {error && <p className="history-status history-error">Failed to load: {error}</p>}

      {!loading && !error && (
        <div className="history-months">
          <MonthGrid
            year={year}
            month={month}
            completedDates={completedDates}
            sessionsByDate={sessionsByDate}
          />
        </div>
      )}

    </div>
  )
}
