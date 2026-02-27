import { Link } from 'react-router-dom'
import { Settings, CalendarDays, ShoppingCart, ScanLine } from 'lucide-react'
import { useMagasinContext } from '../context/MagasinContext'

function Home() {
  const { magasins, magasinActif, setMagasinActif } = useMagasinContext()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <select
          value={magasinActif}
          onChange={e => setMagasinActif(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm"
        >
          {magasins.map(m => (
            <option key={m.id} value={m.nom}>{m.nom}</option>
          ))}
        </select>

        <Link
          to="/parametres"
          className="p-2 rounded-full text-gray-400 hover:text-green-600 hover:bg-white hover:shadow transition-all"
          aria-label="Paramètres"
        >
          <Settings size={22} />
        </Link>
      </div>

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-green-600 mb-2">Ricourses</h1>
          <p className="text-gray-500 text-lg">Gestion de courses & repas</p>
          <div className="mt-8 flex gap-5 sm:gap-6 justify-center flex-wrap px-4">
            <div className="bg-white rounded-xl shadow p-6 w-40 sm:w-44">
              <CalendarDays size={32} className="text-green-600 mx-auto mb-2" />
              <p className="font-medium text-gray-700">Planning hebdo</p>
            </div>
            <Link
              to="/liste"
              className="bg-white rounded-xl shadow p-6 w-40 sm:w-44 hover:shadow-md hover:border-green-200 border border-transparent transition-all"
            >
              <ShoppingCart size={32} className="text-green-600 mx-auto mb-2" />
              <p className="font-medium text-gray-700">Liste courses</p>
            </Link>
            <div className="bg-white rounded-xl shadow p-6 w-40 sm:w-44">
              <ScanLine size={32} className="text-green-600 mx-auto mb-2" />
              <p className="font-medium text-gray-700">Scanner ticket</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

export default Home
