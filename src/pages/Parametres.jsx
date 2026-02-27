import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
  Pencil, X, Check, Store, ChevronUp as Up, ChevronDown as Down,
} from 'lucide-react'
import { usePlats } from '../hooks/usePlats'
import { useMagasinContext } from '../context/MagasinContext'
import { ICONES, ICONES_LIST } from '../utils/icones'

const UNITES = ['g', 'kg', 'L', 'cL', 'mL', 'pièce', 'c.à.s', 'c.à.c']

function Parametres() {
  const { plats, ajouterPlat, supprimerPlat, updatePlatIcone, ajouterIngredient, supprimerIngredient } = usePlats()
  const {
    magasins, moveRayonUp, moveRayonDown, renommerRayon, ajouterRayon, supprimerRayon,
    magasinActif, setMagasinActif, getRayon, setRayon,
  } = useMagasinContext()

  const magasinCourant = magasins.find(m => m.nom === magasinActif)
  const rayonsActifs = magasinCourant?.rayons.map(r => r.nom) ?? []

  // --- Onglets ---
  const [activeTab, setActiveTab] = useState('plats')

  // --- État onglet Plats ---
  const [nomPlat, setNomPlat] = useState('')
  const [ingredientForms, setIngredientForms] = useState({})
  const [openForms, setOpenForms] = useState({})
  const [editIconePlat, setEditIconePlat] = useState(null)
  const [selectedPlatId, setSelectedPlatId] = useState(null)

  // --- État onglet Magasins ---
  const [editRayonId, setEditRayonId] = useState(null)
  const [editRayonNom, setEditRayonNom] = useState('')
  const [nouveauRayon, setNouveauRayon] = useState('')

  // ---- Plats helpers ----
  function handleAjouterPlat(e) {
    e.preventDefault()
    ajouterPlat(nomPlat)
    setNomPlat('')
  }

  function getIngredientForm(platId) {
    return ingredientForms[platId] ?? { nom: '', quantite: '', unite: 'g' }
  }

  function setIngredientField(platId, field, value) {
    setIngredientForms(prev => ({
      ...prev,
      [platId]: { ...getIngredientForm(platId), [field]: value },
    }))
  }

  function handleAjouterIngredient(e, platId) {
    e.preventDefault()
    const form = getIngredientForm(platId)
    ajouterIngredient(platId, form)
    setIngredientForms(prev => ({
      ...prev,
      [platId]: { nom: '', quantite: '', unite: 'g' },
    }))
  }

  function toggleForm(platId) {
    setOpenForms(prev => ({ ...prev, [platId]: !prev[platId] }))
  }

  function handlePickIcone(platId, icone) {
    updatePlatIcone(platId, icone)
    setEditIconePlat(null)
  }

  function handleSelectPlat(platId) {
    setSelectedPlatId(prev => prev === platId ? null : platId)
  }

  // ---- Magasins helpers ----
  function startEditRayon(rayon) {
    setEditRayonId(rayon.id)
    setEditRayonNom(rayon.nom)
  }

  function confirmEditRayon() {
    if (editRayonId && magasinCourant) {
      renommerRayon(magasinCourant.id, editRayonId, editRayonNom)
    }
    setEditRayonId(null)
    setEditRayonNom('')
  }

  function cancelEditRayon() {
    setEditRayonId(null)
    setEditRayonNom('')
  }

  function handleEditRayonKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); confirmEditRayon() }
    if (e.key === 'Escape') cancelEditRayon()
  }

  function handleSwitchMagasin(nom) {
    setMagasinActif(nom)
    setEditRayonId(null)
    setEditRayonNom('')
  }

  function handleAjouterRayon(e) {
    e.preventDefault()
    if (magasinCourant) ajouterRayon(magasinCourant.id, nouveauRayon)
    setNouveauRayon('')
  }

  const selectedPlat = plats.find(p => p.id === selectedPlatId)

  // ---- Store selector partagé ----
  const storeSelector = (
    <select
      value={magasinActif}
      onChange={e => setMagasinActif(e.target.value)}
      className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm"
    >
      {magasins.map(m => (
        <option key={m.id} value={m.nom}>{m.nom}</option>
      ))}
    </select>
  )

  // ---- JSX : liste ingrédients ----
  function renderIngredients(plat) {
    return (
      <div className="space-y-3">
        {plat.ingredients.length > 0 ? (
          <ul className="space-y-1.5">
            {plat.ingredients.map(ing => (
              <li
                key={ing.id}
                className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2"
              >
                <span className="flex-1 min-w-0">
                  <span className="font-medium">{ing.nom}</span>
                  <span className="text-gray-400 ml-2">{ing.quantite} {ing.unite}</span>
                </span>
                <select
                  value={getRayon(ing.nom)}
                  onChange={e => setRayon(ing.nom, e.target.value)}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500 max-w-36 shrink-0"
                >
                  <option value="">— rayon —</option>
                  {rayonsActifs.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button
                  onClick={() => supprimerIngredient(plat.id, ing.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                  aria-label={`Supprimer ${ing.nom}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-400 italic text-center py-3">Aucun ingrédient pour ce plat.</p>
        )}

        <form
          onSubmit={e => handleAjouterIngredient(e, plat.id)}
          className="flex flex-wrap gap-2 pt-1"
        >
          <input
            type="text"
            value={getIngredientForm(plat.id).nom}
            onChange={e => setIngredientField(plat.id, 'nom', e.target.value)}
            placeholder="Ingrédient"
            className="flex-1 min-w-28 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
          <input
            type="number"
            min="0"
            step="any"
            value={getIngredientForm(plat.id).quantite}
            onChange={e => setIngredientField(plat.id, 'quantite', e.target.value)}
            placeholder="Qté"
            className="w-20 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
          <select
            value={getIngredientForm(plat.id).unite}
            onChange={e => setIngredientField(plat.id, 'unite', e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {UNITES.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
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
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            to="/"
            className="p-1.5 rounded-lg text-gray-500 hover:text-green-600 hover:bg-gray-100 transition-colors"
            aria-label="Retour à l'accueil"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Paramètres</h1>

          {storeSelector}

          {/* Tab bar */}
          <div className="flex gap-1">
            {['plats', 'magasins'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab === 'plats' ? 'Plats' : 'Magasins'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">

        {/* ===== ONGLET PLATS ===== */}
        {activeTab === 'plats' && (
          <div className="md:grid md:grid-cols-[340px_1fr] md:gap-8 md:items-start">

            {/* Colonne gauche : form + liste plats */}
            <div className="space-y-6">
              <section>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Ajouter un plat
                </h2>
                <form onSubmit={handleAjouterPlat} className="flex gap-2">
                  <input
                    type="text"
                    value={nomPlat}
                    onChange={e => setNomPlat(e.target.value)}
                    placeholder="Nom du plat (ex: Poulet rôti)"
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 active:scale-95 transition-all"
                  >
                    <Plus size={16} />
                    Ajouter
                  </button>
                </form>
              </section>

              <section>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Mes plats ({plats.length})
                </h2>

                {plats.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-8">
                    Aucun plat enregistré. Ajoutez-en un ci-dessus.
                  </p>
                )}

                <div className="space-y-2">
                  {plats.map(plat => {
                    const Icon = ICONES[plat.icone] ?? ICONES.utensils
                    const isSelected = selectedPlatId === plat.id
                    return (
                      <div
                        key={plat.id}
                        className={`bg-white rounded-xl shadow-sm border transition-all ${
                          isSelected
                            ? 'border-green-400 ring-2 ring-green-100'
                            : 'border-gray-100'
                        }`}
                      >
                        {/* Ligne principale */}
                        <div
                          className="flex items-center gap-2 px-4 py-3 md:cursor-pointer"
                          onClick={() => handleSelectPlat(plat.id)}
                        >
                          <Icon size={18} className="text-green-600 shrink-0" />
                          <span className="flex-1 font-medium text-gray-800">{plat.nom}</span>

                          <button
                            onClick={e => { e.stopPropagation(); setEditIconePlat(editIconePlat === plat.id ? null : plat.id) }}
                            className="p-1.5 text-gray-300 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            aria-label="Éditer l'icône"
                          >
                            <Pencil size={14} />
                          </button>

                          {/* Expand toggle — mobile uniquement */}
                          <button
                            onClick={e => { e.stopPropagation(); toggleForm(plat.id) }}
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded-lg hover:bg-green-50 transition-colors md:hidden"
                          >
                            {openForms[plat.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            ({plat.ingredients.length})
                          </button>

                          {/* Compteur — desktop uniquement */}
                          <span className="hidden md:inline text-xs text-gray-400 tabular-nums">
                            {plat.ingredients.length} ingr.
                          </span>

                          <button
                            onClick={e => { e.stopPropagation(); supprimerPlat(plat.id) }}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label={`Supprimer ${plat.nom}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Picker d'icônes inline */}
                        {editIconePlat === plat.id && (
                          <div className="border-t border-gray-100 px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-500">Choisir une icône</span>
                              <button
                                onClick={() => setEditIconePlat(null)}
                                className="text-gray-300 hover:text-gray-500 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {ICONES_LIST.map(nom => {
                                const PickIcon = ICONES[nom]
                                const isIconSelected = (plat.icone ?? 'utensils') === nom
                                return (
                                  <button
                                    key={nom}
                                    onClick={() => handlePickIcone(plat.id, nom)}
                                    className={`p-2 rounded-lg border transition-all ${
                                      isIconSelected
                                        ? 'border-green-500 bg-green-50 text-green-600'
                                        : 'border-gray-200 text-gray-500 hover:border-green-300 hover:bg-green-50 hover:text-green-600'
                                    }`}
                                    title={nom}
                                  >
                                    <PickIcon size={18} />
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Ingrédients inline — mobile uniquement */}
                        {openForms[plat.id] && (
                          <div className="border-t border-gray-100 px-4 py-3 md:hidden">
                            {renderIngredients(plat)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>

            {/* Colonne droite — desktop uniquement */}
            <div className="hidden md:block sticky top-20">
              {selectedPlat ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                    {(() => {
                      const Icon = ICONES[selectedPlat.icone] ?? ICONES.utensils
                      return <Icon size={20} className="text-green-600 shrink-0" />
                    })()}
                    <h3 className="flex-1 text-base font-semibold text-gray-900">{selectedPlat.nom}</h3>
                    <span className="text-xs text-gray-400 tabular-nums">
                      {selectedPlat.ingredients.length} ingr.
                    </span>
                  </div>
                  <div className="px-5 py-4">
                    {renderIngredients(selectedPlat)}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-gray-300">
                  <ChevronDown size={36} className="mb-3" />
                  <p className="text-sm text-center leading-relaxed">
                    Sélectionnez un plat<br />pour voir ses ingrédients
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ===== ONGLET MAGASINS ===== */}
        {activeTab === 'magasins' && (
          <div className="md:grid md:grid-cols-[200px_1fr] md:gap-8 md:items-start">

            {/* Colonne gauche : sélecteur magasin */}
            <section>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Magasin
              </h2>
              <div className="flex gap-2 flex-wrap md:flex-col">
                {magasins.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleSwitchMagasin(m.nom)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm border-2 transition-all ${
                      magasinActif === m.nom
                        ? 'bg-green-600 text-white border-green-700 shadow-md font-semibold'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700'
                    }`}
                  >
                    <Store size={15} />
                    {m.nom}
                  </button>
                ))}
              </div>
            </section>

            {/* Colonne droite : rayons du magasin actif */}
            {magasinCourant && (
              <section>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Rayons —{' '}
                  <span className="text-gray-700 normal-case font-semibold">{magasinCourant.nom}</span>
                </h2>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
                  {magasinCourant.rayons.map((rayon, idx) => (
                    <div key={rayon.id} className="flex items-center gap-2 px-4 py-3">

                      <span className="text-xs text-gray-500 w-6 text-right shrink-0 font-mono">
                        {idx + 1}
                      </span>

                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveRayonUp(magasinCourant.id, idx)}
                          disabled={idx === 0}
                          className="p-1 text-gray-500 hover:text-green-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          aria-label="Monter"
                        >
                          <Up size={14} />
                        </button>
                        <button
                          onClick={() => moveRayonDown(magasinCourant.id, idx)}
                          disabled={idx === magasinCourant.rayons.length - 1}
                          className="p-1 text-gray-500 hover:text-green-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          aria-label="Descendre"
                        >
                          <Down size={14} />
                        </button>
                      </div>

                      {editRayonId === rayon.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={editRayonNom}
                          onChange={e => setEditRayonNom(e.target.value)}
                          onKeyDown={handleEditRayonKeyDown}
                          className="flex-1 rounded-lg border border-green-400 bg-white px-3 py-1 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      ) : (
                        <span className="flex-1 text-sm font-medium text-gray-800">{rayon.nom}</span>
                      )}

                      {editRayonId === rayon.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={confirmEditRayon}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            aria-label="Confirmer"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={cancelEditRayon}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                            aria-label="Annuler"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEditRayon(rayon)}
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            aria-label="Renommer"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => supprimerRayon(magasinCourant.id, rayon.id)}
                            disabled={magasinCourant.rayons.length <= 1}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                            aria-label="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAjouterRayon} className="flex gap-2 mt-4">
                  <input
                    type="text"
                    value={nouveauRayon}
                    onChange={e => setNouveauRayon(e.target.value)}
                    placeholder="Nom du nouveau rayon"
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 active:scale-95 transition-all"
                  >
                    <Plus size={16} />
                    Ajouter
                  </button>
                </form>
              </section>
            )}

          </div>
        )}

      </main>
    </div>
  )
}

export default Parametres
