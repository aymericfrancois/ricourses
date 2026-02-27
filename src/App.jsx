import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { MagasinProvider } from './context/MagasinContext'
import Home from './pages/Home'
import Parametres from './pages/Parametres'
import ListeCourses from './pages/ListeCourses'

function App() {
  return (
    <BrowserRouter basename="/ricourses">
      <MagasinProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/parametres" element={<Parametres />} />
          <Route path="/liste" element={<ListeCourses />} />
        </Routes>
      </MagasinProvider>
    </BrowserRouter>
  )
}

export default App
