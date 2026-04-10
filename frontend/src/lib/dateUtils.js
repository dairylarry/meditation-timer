/**
 * Returns the "meditation day" date string (YYYY-MM-DD) for a given Date.
 * The day rolls over at 4am, so midnight–3:59am counts as the previous day.
 */
export function meditationDate(d = new Date()) {
  const adjusted = new Date(d.getTime() - 4 * 60 * 60 * 1000)
  const y = adjusted.getFullYear()
  const m = String(adjusted.getMonth() + 1).padStart(2, '0')
  const day = String(adjusted.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
