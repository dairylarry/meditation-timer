import '../styles/MonthGrid.css'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function MonthGrid({ year, month, completedDates, selectedDate, onDayClick }) {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // getDay() returns 0=Sun, we want 0=Mon
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6

  const cells = []

  // Empty cells before day 1
  for (let i = 0; i < startOffset; i++) {
    cells.push(<div key={`empty-${i}`} className="month-cell month-cell-empty" />)
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const completed = completedDates.has(dateStr)
    const isSelected = selectedDate === dateStr
    cells.push(
      <div
        key={dateStr}
        className={`month-cell ${completed ? 'month-cell-completed' : 'month-cell-missed'}${isSelected ? ' month-cell-selected' : ''}`}
        onClick={() => {
          if (!completed) return
          onDayClick?.(isSelected ? null : dateStr)
        }}
      >
        {d}
      </div>
    )
  }

  return (
    <div className="month-grid-container">
      <div className="month-day-labels">
        {DAY_LABELS.map((label, i) => (
          <div key={i} className="month-day-label">{label}</div>
        ))}
      </div>
      <div className="month-grid">
        {cells}
      </div>
    </div>
  )
}
