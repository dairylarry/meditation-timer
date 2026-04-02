import { useNavigate } from 'react-router-dom'
import '../styles/Brahmavihara.css'

export default function Brahmavihara() {
  const navigate = useNavigate()

  return (
    <div className="brahma">
      <h1 className="brahma-title">brahmavihārā 4</h1>
      <p className="brahma-subtitle">the four sublime states of mind</p>

      <div className="brahma-cards">
        <div className="brahma-card">
          <h2 className="brahma-card-name">mettā</h2>
          <p className="brahma-card-meaning">loving-kindness</p>
          <p className="brahma-card-desc">
            benevolence, friendliness, goodwill, wishing for others to be happy,
            having good wishes for others without discrimination including
            kindness to animals.
          </p>
        </div>

        <div className="brahma-card">
          <h2 className="brahma-card-name">karuṇā</h2>
          <p className="brahma-card-meaning">compassion</p>
          <p className="brahma-card-desc">
            desire to help others escape suffering, and compassion for others
            who are suffering.
          </p>
        </div>

        <div className="brahma-card">
          <h2 className="brahma-card-name">muditā</h2>
          <p className="brahma-card-meaning">sympathetic joy</p>
          <p className="brahma-card-desc">
            joining in praise and rejoicing in the success and goodness of
            others. no jealousy, and joy when seeing others happy.
          </p>
        </div>

        <div className="brahma-card">
          <h2 className="brahma-card-name">upekkhā</h2>
          <p className="brahma-card-meaning">equanimity</p>
          <p className="brahma-card-desc">
            neutrality, having a mind that is neutral, firm, unshakable, and
            fair, not biased by feelings of love and hate.
          </p>
        </div>
      </div>

      <button className="btn-back" onClick={() => navigate('/')}>
        ← back
      </button>
    </div>
  )
}
