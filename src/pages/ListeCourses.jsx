import { ShoppingCart, Package } from 'lucide-react'
import { usePlats } from '../hooks/usePlats'
import { useMagasinContext } from '../context/MagasinContext'

function ListeCourses() {
  const { plats } = usePlats()
  const { magasins, magasinActif, getRayon } = useMagasinContext()

  const magasinCourant = magasins.find(m => m.nom === magasinActif)
  const rayonsOrdonnes = magasinCourant?.rayons.map(r => r.nom) ?? []

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
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 anim-in">

      <div>
        <p className="chip mb-1.5">Catalogue complet</p>
        <h1 className="text-3xl font-extrabold tracking-tight ink">Liste de courses</h1>
      </div>

      {totalIngredients === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 ink-4 glass sheen">
          <ShoppingCart size={40} className="mb-3" />
          <p className="text-sm text-center ink-3">
            Aucun ingrédient trouvé.<br />Ajoutez des plats dans les Paramètres.
          </p>
        </div>
      ) : (
        <>
          {rayonsOrdonnes.map(rayonNom => {
            const items = grouped[rayonNom]
            if (!items || items.length === 0) return null
            return (
              <section key={rayonNom}>
                <h2 className="text-xs font-bold ink-3 uppercase tracking-widest mb-2">
                  {rayonNom}
                  <span className="ml-2 ink-4 font-normal normal-case">({items.length})</span>
                </h2>
                <ul className="glass sheen divide-y divide-white/40">
                  {items.map(item => (
                    <li key={item.nom} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-4 h-4 rounded border-2 border-[color:var(--ink-4)] shrink-0" />
                      <span className="flex-1 text-sm font-semibold ink">{item.nom}</span>
                      <span className="text-sm ink-3 tabular-nums mono">
                        {item.quantite > 0 ? `${item.quantite} ${item.unite}` : item.unite}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          {orphelins.length > 0 && (
            <section>
              <h2 className="text-xs font-bold ink-3 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Package size={13} />
                Autres / Non classés
                <span className="ink-4 font-normal normal-case">({orphelins.length})</span>
              </h2>
              <ul className="glass sheen divide-y divide-white/40 border border-orange-200/60">
                {orphelins.map(item => (
                  <li key={item.nom} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-4 h-4 rounded border-2 border-orange-300 shrink-0" />
                    <span className="flex-1 text-sm font-semibold text-orange-700">{item.nom}</span>
                    <span className="text-sm ink-3 tabular-nums mono">
                      {item.quantite > 0 ? `${item.quantite} ${item.unite}` : item.unite}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs ink-3 mt-2 text-center">
                Assignez un rayon à ces ingrédients dans Paramètres → Plats
              </p>
            </section>
          )}
        </>
      )}

    </main>
  )
}

export default ListeCourses
