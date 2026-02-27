import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Parametres from './pages/Parametres'

function App() {
  return (
    <BrowserRouter basename="/ricourses">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/parametres" element={<Parametres />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
