import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { CalendarDays, ScanLine, UtensilsCrossed, LayoutList, Leaf, ShoppingCart, Store, Check, ChevronDown, LogOut, Euro } from 'lucide-react'
import { useMagasinContext } from '../context/MagasinContext'
import { supabase } from '../supabaseClient'

const navLinkClass = ({ isActive }) =>
  `nav-link ${isActive ? 'active' : ''}`

const NAV_ITEMS = [
  { to: '/planning', icon: CalendarDays, label: 'Planning' },
  { to: '/courses', icon: ShoppingCart, label: 'Courses' },
  { to: '/scanner', icon: ScanLine, label: 'Scanner' },
  { to: '/plats', icon: UtensilsCrossed, label: 'Plats' },
  { to: '/rayons', icon: LayoutList, label: 'Rayons' },
  { to: '/ingredients', icon: Leaf, label: 'Ingrédients' },
  { to: '/prix', icon: Euro, label: 'Prix' },
]

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
    <header className="sticky top-0 z-30 px-2 sm:px-4 pt-2 sm:pt-4">
      <div className="max-w-6xl mx-auto glass-strong sheen px-2 sm:px-3 py-1.5 sm:py-2.5 flex items-center gap-1.5 sm:gap-3 relative">

        {/* Barre tricolore enseigne */}
        <div className="absolute top-0 left-0 right-0 h-1 magasin-grad-bg rounded-t-[var(--radius)]" />

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="magasin-grad-bg rounded-xl w-8 h-8 flex items-center justify-center font-extrabold text-sm shadow-sm">R</span>
          <span className="hidden sm:inline font-extrabold tracking-tight ink text-[15px]">Ricourses</span>
        </Link>

        {/* Navigation */}
        <nav className="flex gap-0.5 sm:gap-1 flex-1 overflow-x-auto no-scrollbar items-center">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} className={navLinkClass} title={item.label}>
                <Icon size={15} />
                <span className="hidden md:inline">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Sélecteur de magasin */}
        <div className="relative shrink-0" ref={wrapRef}>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full bg-white/60 hover:bg-white/80 text-[12px] sm:text-[13px] font-semibold ink-2 border border-white/70 transition-colors"
            title={magasinActif}
          >
            <Store size={14} className="ink-3 shrink-0" />
            <span className="hidden sm:inline">{magasinActif}</span>
            <ChevronDown size={14} className="ink-3 shrink-0" />
          </button>
          {open && (
            <div className="absolute right-0 mt-2 min-w-[200px] popover p-1.5 anim-pop z-40">
              <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold ink-3 uppercase tracking-widest">Magasin</p>
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
              <div className="border-t border-black/5 my-1.5" />
              <button
                type="button"
                onClick={() => { setOpen(false); supabase.auth.signOut() }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold ink-2 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LogOut size={14} />
                <span>Se déconnecter</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  )
}

export default Header
