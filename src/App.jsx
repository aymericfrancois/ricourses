import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MagasinProvider } from './context/MagasinContext'
import { PlanningProvider } from './context/PlanningContext'
import Header from './components/Header'
import Home from './pages/Home'
import Parametres from './pages/Parametres'
import ListeCourses from './pages/ListeCourses'
import Planning from './pages/Planning'
import ShoppingList from './pages/ShoppingList'
import Scanner from './pages/Scanner'

function App() {
  return (
    <BrowserRouter basename="/ricourses">
      <MagasinProvider>
        <PlanningProvider>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/courses" element={<ShoppingList />} />
            <Route path="/liste" element={<ListeCourses />} />
            <Route path="/plats" element={<Parametres />} />
            <Route path="/rayons" element={<Parametres />} />
            <Route path="/ingredients" element={<Parametres />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PlanningProvider>
      </MagasinProvider>
    </BrowserRouter>
  )
}

export default App
