import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { CalendarDays, ScanLine, UtensilsCrossed, LayoutList, Leaf, ShoppingCart, Store, Check, ChevronDown } from 'lucide-react'
import { useMagasinContext } from '../context/MagasinContext'

const navLinkClass = ({ isActive }) =>
  `nav-link ${isActive ? 'active' : ''}`

function Header() {
  const { magasins, magasinActif, setMagasinActif } = useMagasinContext()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <header className="sticky top-0 z-30 px-4 pt-4">
      <div className="max-w-6xl mx-auto glass-strong sheen px-3 py-2.5 flex items-center gap-3 flex-wrap">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="accent-bg rounded-xl w-8 h-8 flex items-center justify-center font-extrabold text-sm shadow-sm">R</span>
          <span className="font-extrabold tracking-tight ink text-[15px]">Ricourses</span>
        </Link>

        {/* Navigation */}
        <nav className="flex gap-1 flex-1 flex-wrap">
          <NavLink to="/planning" className={navLinkClass}>
            <CalendarDays size={15} />
            <span>Planning</span>
          </NavLink>
          <NavLink to="/courses" className={navLinkClass}>
            <ShoppingCart size={15} />
            <span>Courses</span>
          </NavLink>
          <NavLink to="/scanner" className={navLinkClass}>
            <ScanLine size={15} />
            <span>Scanner</span>
          </NavLink>
          <NavLink to="/plats" className={navLinkClass}>
            <UtensilsCrossed size={15} />
            <span>Plats</span>
          </NavLink>
          <NavLink to="/rayons" className={navLinkClass}>
            <LayoutList size={15} />
            <span>Rayons</span>
          </NavLink>
          <NavLink to="/ingredients" className={navLinkClass}>
            <Leaf size={15} />
            <span>Ingrédients</span>
          </NavLink>
        </nav>

        {/* Sélecteur de magasin */}
        <div className="relative" ref={wrapRef}>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 hover:bg-white/80 text-[13px] font-semibold ink-2 border border-white/70 transition-colors"
          >
            <Store size={14} className="ink-3" />
            <span>{magasinActif}</span>
            <ChevronDown size={14} className="ink-3" />
          </button>
          {open && (
            <div className="absolute right-0 mt-2 min-w-[180px] glass-strong sheen p-1.5 anim-pop z-40">
              {magasins.map(m => {
                const actif = m.nom === magasinActif
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setMagasinActif(m.nom); setOpen(false) }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
                      actif ? 'accent-soft-bg accent-text' : 'ink-2 hover:bg-white/60'
                    }`}
                  >
                    <span>{m.nom}</span>
                    {actif && <Check size={14} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </header>
  )
}

export default Header
