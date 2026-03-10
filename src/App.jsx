import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { MagasinProvider } from './context/MagasinContext'
import { PlanningProvider } from './context/PlanningContext'
import Header from './components/Header'
import Home from './pages/Home'
import Parametres from './pages/Parametres'
import ListeCourses from './pages/ListeCourses'
import Planning from './pages/Planning'

function App() {
  return (
    <BrowserRouter basename="/ricourses">
      <MagasinProvider>
        <PlanningProvider>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/parametres" element={<Parametres />} />
            <Route path="/liste" element={<ListeCourses />} />
            <Route path="/planning" element={<Planning />} />
          </Routes>
        </PlanningProvider>
      </MagasinProvider>
    </BrowserRouter>
  )
}

export default App
