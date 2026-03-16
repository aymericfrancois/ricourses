import { Link } from 'react-router-dom'
import { CalendarDays, ScanLine, UtensilsCrossed, LayoutList, Leaf } from 'lucide-react'

function Home() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-4xl font-bold text-green-600 mb-2">Ricourses</h1>
        <p className="text-gray-500 text-lg">Gestion de courses & repas</p>
        <div className="mt-8 flex gap-4 justify-center flex-wrap max-w-xl mx-auto">
          <Link
            to="/planning"
            className="bg-white rounded-xl shadow p-5 w-36 hover:shadow-md hover:border-green-200 border border-transparent transition-all"
          >
            <CalendarDays size={28} className="text-green-600 mx-auto mb-2" />
            <p className="font-medium text-gray-700 text-sm">Planning</p>
          </Link>
          <Link
            to="/plats"
            className="bg-white rounded-xl shadow p-5 w-36 hover:shadow-md hover:border-green-200 border border-transparent transition-all"
          >
            <UtensilsCrossed size={28} className="text-green-600 mx-auto mb-2" />
            <p className="font-medium text-gray-700 text-sm">Plats</p>
          </Link>
          <Link
            to="/rayons"
            className="bg-white rounded-xl shadow p-5 w-36 hover:shadow-md hover:border-green-200 border border-transparent transition-all"
          >
            <LayoutList size={28} className="text-green-600 mx-auto mb-2" />
            <p className="font-medium text-gray-700 text-sm">Rayons</p>
          </Link>
          <Link
            to="/ingredients"
            className="bg-white rounded-xl shadow p-5 w-36 hover:shadow-md hover:border-green-200 border border-transparent transition-all"
          >
            <Leaf size={28} className="text-green-600 mx-auto mb-2" />
            <p className="font-medium text-gray-700 text-sm">Ingrédients</p>
          </Link>
          <div className="bg-white rounded-xl shadow p-5 w-36 opacity-40">
            <ScanLine size={28} className="text-green-600 mx-auto mb-2" />
            <p className="font-medium text-gray-700 text-sm">Scanner</p>
            <p className="text-xs text-gray-400 mt-1">Bientôt</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
