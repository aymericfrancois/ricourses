import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { MagasinProvider } from './context/MagasinContext'
import { PlanningProvider } from './context/PlanningContext'
import { useAuth } from './hooks/useAuth'
import Header from './components/Header'
import Blobs from './components/Blobs'
import Home from './pages/Home'
import Parametres from './pages/Parametres'
import ListeCourses from './pages/ListeCourses'
import Planning from './pages/Planning'
import ShoppingList from './pages/ShoppingList'
import Scanner from './pages/Scanner'
import Login from './pages/Login'

function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <>
        <Blobs />
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 size={28} className="animate-spin ink-3" />
        </div>
      </>
    )
  }

  if (!session) {
    return (
      <>
        <Blobs />
        <Login />
      </>
    )
  }

  return (
    <BrowserRouter>
      <Blobs />
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
