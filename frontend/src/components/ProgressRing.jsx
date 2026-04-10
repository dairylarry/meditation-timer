import '../styles/ProgressRing.css'

const SIZE = 280
const STROKE = 8
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function ProgressRing({ progress }) {
  const offset = CIRCUMFERENCE * (1 - progress)
  const strokeColor = progress >= 0.5 ? '#4a7a5e' : '#6a9e7c'

  return (
    <svg className="progress-ring" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <circle
        className="progress-ring-bg"
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        strokeWidth={STROKE}
      />
      <circle
        className="progress-ring-fg"
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        strokeWidth={STROKE}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        stroke={strokeColor}
      />
    </svg>
  )
}
