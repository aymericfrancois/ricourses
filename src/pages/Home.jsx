import { Link } from 'react-router-dom'
import { Settings, CalendarDays, ShoppingCart, ScanLine } from 'lucide-react'

function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center relative">

      <Link
        to="/parametres"
        className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-green-600 hover:bg-white hover:shadow transition-all"
        aria-label="Paramètres"
      >
        <Settings size={22} />
      </Link>

      <div className="text-center">
        <h1 className="text-4xl font-bold text-green-600 mb-2">Ricourses</h1>
        <p className="text-gray-500 text-lg">Gestion de courses & repas</p>
        <div className="mt-8 flex gap-5 sm:gap-6 justify-center flex-wrap px-4">
          <div className="bg-white rounded-xl shadow p-6 w-40 sm:w-44">
            <CalendarDays size={32} className="text-green-600 mx-auto mb-2" />
            <p className="font-medium text-gray-700">Planning hebdo</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6 w-40 sm:w-44">
            <ShoppingCart size={32} className="text-green-600 mx-auto mb-2" />
            <p className="font-medium text-gray-700">Liste courses</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6 w-40 sm:w-44">
            <ScanLine size={32} className="text-green-600 mx-auto mb-2" />
            <p className="font-medium text-gray-700">Scanner ticket</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
