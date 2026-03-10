import { Link, NavLink } from 'react-router-dom'
import { CalendarDays, Settings, ScanLine } from 'lucide-react'
import { useMagasinContext } from '../context/MagasinContext'

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
  }`

function Header() {
  const { magasins, magasinActif, setMagasinActif } = useMagasinContext()

  return (
    <header className="bg-white shadow-sm sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4">

        {/* Ligne unique — flex-wrap pour mobile */}
        <div className="flex items-center gap-3 py-3 flex-wrap">

          {/* Logo */}
          <Link
            to="/"
            className="text-lg font-bold text-green-600 shrink-0 mr-2"
          >
            Ricourses
          </Link>

          {/* Navigation */}
          <nav className="flex gap-1 flex-1 flex-wrap">
            <NavLink to="/planning" className={navLinkClass}>
              <CalendarDays size={15} />
              <span>Planning</span>
            </NavLink>
            <NavLink to="/parametres" className={navLinkClass}>
              <Settings size={15} />
              <span>Paramètres</span>
            </NavLink>
            <button
              disabled
              title="Bientôt disponible"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-300 cursor-not-allowed"
            >
              <ScanLine size={15} />
              <span>Scanner</span>
            </button>
          </nav>

          {/* Sélecteur de magasin */}
          <select
            value={magasinActif}
            onChange={e => setMagasinActif(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm"
          >
            {magasins.map(m => (
              <option key={m.id} value={m.nom}>{m.nom}</option>
            ))}
          </select>

        </div>
      </div>
    </header>
  )
}

export default Header
