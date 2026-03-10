import { useState, useRef, useEffect } from 'react'
import { Trash2, Plus, ShoppingCart, Package, RotateCcw, X } from 'lucide-react'
import { usePlats } from '../hooks/usePlats'
import { useMagasinContext } from '../context/MagasinContext'
import { usePlanningContext } from '../context/PlanningContext'

const UNITES = ['g', 'kg', 'L', 'cL', 'mL', 'pièce', 'c.à.s', 'c.à.c']

const BLOCS_LIBRES = [
  { key: 'petitDejeuner', label: 'Petit Déjeuner' },
  { key: 'achatsPonctuels', label: 'Achats Ponctuels' },
  { key: 'alicya', label: 'Alicya' },
]

// ---- Composant Autocomplétion ----
function PlatCombobox({ value, onChange, plats }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const selectedPlat = plats.find(p => p.id === value)

  const filtered = query.trim()
    ? plats.filter(p => p.nom.toLowerCase().includes(query.toLowerCase()))
    : plats

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={open ? query : (selectedPlat?.nom ?? '')}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        placeholder="— choisir —"
        className={`w-full rounded-lg border bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 ${
          value ? 'border-green-300 pr-6' : 'border-gray-200'
        }`}
      />
      {value && (
        <button
          onMouseDown={e => { e.preventDefault(); onChange(null); setQuery(''); setOpen(false) }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
          aria-label="Effacer"
        >
          <X size={12} />
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-0.5">
          {filtered.map(p => (
            <li
              key={p.id}
              onMouseDown={e => {
                e.preventDefault()
                onChange(p.id)
                setQuery('')
                setOpen(false)
              }}
              className={`px-3 py-2 text-xs cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors ${
                value === p.id ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'
              }`}
            >
              {p.nom}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query.trim() && (
        <div className="absolute z-30 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-0.5 px-3 py-2 text-xs text-gray-400 italic">
          Aucun plat trouvé
        </div>
      )}
    </div>
  )
}

// ---- Page Planning ----
function Planning() {
  const { plats } = usePlats()
  const { magasins, magasinActif, getRayon } = useMagasinContext()
  const {
    semaine, espacesLibres,
    setMidi, setSoir,
    ajouterIngredientLibre, supprimerIngredientLibre,
    resetPlanning,
  } = usePlanningContext()

  const [confirmReset, setConfirmReset] = useState(false)

  const [formsLibres, setFormsLibres] = useState({
    petitDejeuner: { nom: '', quantite: '', unite: 'g' },
    achatsPonctuels: { nom: '', quantite: '', unite: 'g' },
    alicya: { nom: '', quantite: '', unite: 'g' },
  })

  function setFormLibre(bloc, field, value) {
    setFormsLibres(prev => ({
      ...prev,
      [bloc]: { ...prev[bloc], [field]: value },
    }))
  }

  function handleAjouterLibre(e, bloc) {
    e.preventDefault()
    ajouterIngredientLibre(bloc, formsLibres[bloc])
    setFormsLibres(prev => ({
      ...prev,
      [bloc]: { nom: '', quantite: '', unite: 'g' },
    }))
  }

  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true)
    } else {
      resetPlanning()
      setConfirmReset(false)
    }
  }

  // ---- Calcul liste de courses ----
  const magasinCourant = magasins.find(m => m.nom === magasinActif)
  const rayonsOrdonnes = magasinCourant?.rayons.map(r => r.nom) ?? []

  const ingredientsMap = {}

  const freqMap = {}
  for (const { midi, soir } of semaine) {
    if (midi) freqMap[midi] = (freqMap[midi] || 0) + 1
    if (soir) freqMap[soir] = (freqMap[soir] || 0) + 1
  }
  for (const [platId, count] of Object.entries(freqMap)) {
    const plat = plats.find(p => p.id === platId)
    if (!plat) continue
    for (const ing of plat.ingredients) {
      const key = ing.nom.toLowerCase()
      if (!ingredientsMap[key]) {
        ingredientsMap[key] = { nom: ing.nom, quantite: 0, unite: ing.unite }
      }
      ingredientsMap[key].quantite += Number(ing.quantite) * count
    }
  }

  for (const { key } of BLOCS_LIBRES) {
    for (const ing of espacesLibres[key]) {
      const mapKey = ing.nom.toLowerCase()
      if (!ingredientsMap[mapKey]) {
        ingredientsMap[mapKey] = { nom: ing.nom, quantite: 0, unite: ing.unite }
      }
      ingredientsMap[mapKey].quantite += Number(ing.quantite) || 0
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
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-6xl mx-auto px-4 py-6 md:grid md:grid-cols-5 md:gap-6 md:items-start">

        {/* ===== COLONNE GAUCHE : ÉDITEUR ===== */}
        <div className="md:col-span-3 space-y-6">

          {/* La Semaine */}
          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              La Semaine
            </h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
              {semaine.map((jour, idx) => (
                <div key={jour.jour} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="w-24 text-sm font-semibold text-gray-700 shrink-0">
                    {jour.jour}
                  </span>
                  <div className="flex flex-1 gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide block mb-0.5">
                        Midi
                      </label>
                      <PlatCombobox
                        value={jour.midi}
                        onChange={platId => setMidi(idx, platId)}
                        plats={plats}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide block mb-0.5">
                        Soir
                      </label>
                      <PlatCombobox
                        value={jour.soir}
                        onChange={platId => setSoir(idx, platId)}
                        plats={plats}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Les Espaces Libres */}
          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Les Espaces Libres
            </h2>
            <div className="space-y-4">
              {BLOCS_LIBRES.map(({ key, label }) => (
                <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="px-4 py-3 border-b border-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    {espacesLibres[key].length > 0 ? (
                      <ul className="space-y-1.5">
                        {espacesLibres[key].map(ing => (
                          <li
                            key={ing.id}
                            className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2"
                          >
                            <span className="flex-1 min-w-0">
                              <span className="font-medium">{ing.nom}</span>
                              {ing.quantite > 0 && (
                                <span className="text-gray-400 ml-2">{ing.quantite} {ing.unite}</span>
                              )}
                            </span>
                            <button
                              onClick={() => supprimerIngredientLibre(key, ing.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                              aria-label={`Supprimer ${ing.nom}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Aucun ingrédient ajouté.</p>
                    )}

                    <form onSubmit={e => handleAjouterLibre(e, key)} className="flex flex-wrap gap-2 pt-1">
                      <input
                        type="text"
                        value={formsLibres[key].nom}
                        onChange={e => setFormLibre(key, 'nom', e.target.value)}
                        placeholder="Ingrédient"
                        className="flex-1 min-w-28 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                        required
                      />
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={formsLibres[key].quantite}
                        onChange={e => setFormLibre(key, 'quantite', e.target.value)}
                        placeholder="Qté"
                        className="w-20 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <select
                        value={formsLibres[key].unite}
                        onChange={e => setFormLibre(key, 'unite', e.target.value)}
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <button
                        type="submit"
                        className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 active:scale-95 transition-all"
                      >
                        <Plus size={14} />
                        Ajouter
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Bouton Reset */}
          <div className="flex items-center gap-3">
            {confirmReset ? (
              <>
                <span className="text-sm text-gray-600">Réinitialiser le planning ?</span>
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
                >
                  Confirmer
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-100 transition-colors"
                >
                  Annuler
                </button>
              </>
            ) : (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <RotateCcw size={14} />
                Réinitialiser le planning
              </button>
            )}
          </div>

        </div>

        {/* ===== COLONNE DROITE : LISTE DE COURSES ===== */}
        <div className="mt-6 md:mt-0 md:col-span-2 md:sticky md:top-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Liste de courses
            {totalIngredients > 0 && (
              <span className="ml-2 text-gray-300 font-normal normal-case">
                ({totalIngredients} ingr.)
              </span>
            )}
          </h2>

          {totalIngredients === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300 bg-white rounded-xl shadow-sm border border-gray-100">
              <ShoppingCart size={36} className="mb-3" />
              <p className="text-sm text-center leading-relaxed">
                Sélectionnez des plats<br />ou ajoutez des ingrédients libres.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {rayonsOrdonnes.map(rayonNom => {
                const items = grouped[rayonNom]
                if (!items || items.length === 0) return null
                return (
                  <section key={rayonNom}>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                      {rayonNom}
                      <span className="ml-2 text-gray-300 font-normal normal-case">({items.length})</span>
                    </h3>
                    <ul className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
                      {items.map(item => (
                        <li key={item.nom} className="flex items-center gap-3 px-4 py-2.5">
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

              {orphelins.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Package size={13} />
                    Autres / Non classés
                    <span className="text-gray-300 font-normal normal-case">({orphelins.length})</span>
                  </h3>
                  <ul className="bg-white rounded-xl shadow-sm border border-orange-100 divide-y divide-gray-50">
                    {orphelins.map(item => (
                      <li key={item.nom} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-4 h-4 rounded border-2 border-orange-200 shrink-0" />
                        <span className="flex-1 text-sm font-medium text-gray-600">{item.nom}</span>
                        <span className="text-sm text-gray-400 tabular-nums">
                          {item.quantite > 0 ? `${item.quantite} ${item.unite}` : item.unite}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Assignez un rayon dans Paramètres → Catalogue
                  </p>
                </section>
              )}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}

export default Planning
