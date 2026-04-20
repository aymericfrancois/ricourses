import { Link } from 'react-router-dom'
import { CalendarDays, ScanLine, UtensilsCrossed, LayoutList, Leaf, ShoppingCart } from 'lucide-react'

const TILES = [
  { to: '/planning', icon: CalendarDays, label: 'Planning', desc: 'La semaine & les repas' },
  { to: '/courses', icon: ShoppingCart, label: 'Courses', desc: 'Liste de courses live' },
  { to: '/scanner', icon: ScanLine, label: 'Scanner', desc: 'Ticket & Tricount' },
  { to: '/plats', icon: UtensilsCrossed, label: 'Plats', desc: 'Catalogue de recettes' },
  { to: '/rayons', icon: LayoutList, label: 'Rayons', desc: 'Sections des magasins' },
  { to: '/ingredients', icon: Leaf, label: 'Ingrédients', desc: 'Mapping & splits' },
]

function Home() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-10 anim-in">
      <div className="text-center mb-10">
        <p className="chip mb-3">Accueil</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight ink">Ricourses</h1>
        <p className="ink-3 mt-2 text-base">Gestion de courses & repas</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
        {TILES.map(({ to, icon: Icon, label, desc }) => (
          <Link
            key={to}
            to={to}
            className="glass sheen p-5 flex flex-col gap-2 transition-transform hover:-translate-y-0.5"
          >
            <span className="accent-soft-bg rounded-xl w-10 h-10 flex items-center justify-center">
              <Icon size={20} className="accent-text" />
            </span>
            <p className="font-bold ink text-[15px] mt-1">{label}</p>
            <p className="ink-3 text-xs leading-snug">{desc}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}

export default Home
