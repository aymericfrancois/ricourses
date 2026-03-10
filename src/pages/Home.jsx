import { Link } from 'react-router-dom'
import { CalendarDays, ScanLine } from 'lucide-react'

function Home() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-4xl font-bold text-green-600 mb-2">Ricourses</h1>
        <p className="text-gray-500 text-lg">Gestion de courses & repas</p>
        <div className="mt-8 flex gap-5 sm:gap-6 justify-center flex-wrap">
          <Link
            to="/planning"
            className="bg-white rounded-xl shadow p-6 w-40 sm:w-44 hover:shadow-md hover:border-green-200 border border-transparent transition-all"
          >
            <CalendarDays size={32} className="text-green-600 mx-auto mb-2" />
            <p className="font-medium text-gray-700">Planning hebdo</p>
          </Link>
          <div className="bg-white rounded-xl shadow p-6 w-40 sm:w-44 opacity-50">
            <ScanLine size={32} className="text-green-600 mx-auto mb-2" />
            <p className="font-medium text-gray-700">Scanner ticket</p>
            <p className="text-xs text-gray-400 mt-1">Bientôt</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
