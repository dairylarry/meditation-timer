import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Session from './pages/Session'
import History from './pages/History'
import Brahmavihara from './pages/Brahmavihara'
import './styles/App.css'

export default function App() {
  return (
    <BrowserRouter basename="/meditation-timer">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/session" element={<Session />} />
        <Route path="/history" element={<History />} />
        <Route path="/brahmavihara" element={<Brahmavihara />} />
      </Routes>
    </BrowserRouter>
  )
}
