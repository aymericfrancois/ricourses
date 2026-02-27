import { Link } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, Package } from 'lucide-react'
import { usePlats } from '../hooks/usePlats'
import { useMagasinContext } from '../context/MagasinContext'

function ListeCourses() {
  const { plats } = usePlats()
  const { magasins, magasinActif, setMagasinActif, getRayon } = useMagasinContext()

  const magasinCourant = magasins.find(m => m.nom === magasinActif)
  const rayonsOrdonnes = magasinCourant?.rayons.map(r => r.nom) ?? []

  // Agréger tous les ingrédients de tous les plats
  const ingredientsMap = {}
  for (const plat of plats) {
    for (const ing of plat.ingredients) {
      const key = ing.nom.toLowerCase()
      if (!ingredientsMap[key]) {
        ingredientsMap[key] = { nom: ing.nom, quantite: 0, unite: ing.unite }
      }
      ingredientsMap[key].quantite += Number(ing.quantite) || 0
    }
  }

  // Grouper par rayon selon l'ordre du magasin actif
  const grouped = {}
  const orphelins = []

  for (const item of Object.values(ingredientsMap)) {
    const rayon = getRayon(item.nom)
    if (rayon && rayonsOrdonnes.includes(rayon)) {
      if (!grouped[rayon]) grouped[rayon] = []
      grouped[rayon].push(item)
    } else {
      orphelins.push(item)
    }
  }

  const totalIngredients = Object.values(ingredientsMap).length

  return (
    <div className="min-h-screen bg-gray-50">

      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            to="/"
            className="p-1.5 rounded-lg text-gray-500 hover:text-green-600 hover:bg-gray-100 transition-colors"
            aria-label="Retour à l'accueil"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Liste de courses</h1>
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
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {totalIngredients === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-300">
            <ShoppingCart size={40} className="mb-3" />
            <p className="text-sm text-center">
              Aucun ingrédient trouvé.<br />Ajoutez des plats dans les Paramètres.
            </p>
          </div>
        ) : (
          <>
            {/* Rayons dans l'ordre du magasin */}
            {rayonsOrdonnes.map(rayonNom => {
              const items = grouped[rayonNom]
              if (!items || items.length === 0) return null
              return (
                <section key={rayonNom}>
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {rayonNom}
                    <span className="ml-2 text-gray-300 font-normal normal-case">({items.length})</span>
                  </h2>
                  <ul className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
                    {items.map(item => (
                      <li key={item.nom} className="flex items-center gap-3 px-4 py-3">
                        <span className="w-4 h-4 rounded border-2 border-gray-300 shrink-0" />
                        <span className="flex-1 text-sm font-medium text-gray-800">{item.nom}</span>
                        <span className="text-sm text-gray-400 tabular-nums">
                          {item.quantite > 0 ? `${item.quantite} ${item.unite}` : item.unite}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}

            {/* Orphelins */}
            {orphelins.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Package size={13} />
                  Autres / Non classés
                  <span className="text-gray-300 font-normal normal-case">({orphelins.length})</span>
                </h2>
                <ul className="bg-white rounded-xl shadow-sm border border-orange-100 divide-y divide-gray-50">
                  {orphelins.map(item => (
                    <li key={item.nom} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-4 h-4 rounded border-2 border-orange-200 shrink-0" />
                      <span className="flex-1 text-sm font-medium text-gray-600">{item.nom}</span>
                      <span className="text-sm text-gray-400 tabular-nums">
                        {item.quantite > 0 ? `${item.quantite} ${item.unite}` : item.unite}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Assignez un rayon à ces ingrédients dans Paramètres → Plats
                </p>
              </section>
            )}
          </>
        )}

      </main>
    </div>
  )
}

export default ListeCourses
