import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Trash2, Plus, RotateCcw, X,
  Check, ChevronDown, ChevronUp, Bookmark, BookmarkCheck,
} from 'lucide-react'
import { usePlats } from '../hooks/usePlats'
import { usePlanningContext } from '../context/PlanningContext'

const UNITES = ['g', 'kg', 'L', 'cL', 'mL', 'pièce', 'c.à.s', 'c.à.c']
const BLOCS_LIBRES = [
  { key: 'petitDejeuner', label: 'Petit Déjeuner' },
  { key: 'achatsPonctuels', label: 'Achats Ponctuels' },
  { key: 'alicya', label: 'Alicya' },
]

// ---- Combobox Plats ----
function PlatCombobox({ value, onChange, plats, onCreatePlat }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selectedPlat = plats.find(p => p.id === value)
  const filtered = (query.trim()
    ? plats.filter(p => p.nom.toLowerCase().includes(query.toLowerCase()))
    : [...plats]
  ).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
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
        className={`w-full rounded-lg border bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 ${value ? 'border-green-300 pr-6' : 'border-gray-200'}`}
      />
      {value && (
        <button
          onMouseDown={e => { e.preventDefault(); onChange(null); setQuery(''); setOpen(false) }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
        >
          <X size={12} />
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-0.5">
          {filtered.map(p => (
            <li
              key={p.id}
              onMouseDown={e => { e.preventDefault(); onChange(p.id); setQuery(''); setOpen(false) }}
              className={`px-3 py-2 text-xs cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors ${value === p.id ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'}`}
            >
              {p.nom}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query.trim() && (
        <div className="absolute z-30 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-0.5 overflow-hidden">
          <button
            onMouseDown={e => {
              e.preventDefault()
              const id = onCreatePlat(query.trim())
              if (id) { onChange(id); setQuery(''); setOpen(false) }
            }}
            className="w-full px-3 py-2.5 text-xs text-left text-green-600 hover:bg-green-50 font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus size={12} />
            Créer « {query.trim()} »
          </button>
        </div>
      )}
    </div>
  )
}

// ---- Combobox Ingrédients ----
function IngredientCombobox({ value, onChange, suggestions, placeholder = 'Ingrédient', className = '' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const filtered = query.trim()
    ? suggestions.filter(n => n.toLowerCase().includes(query.toLowerCase()))
    : suggestions

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        type="text"
        value={open ? query : value}
        onFocus={() => { setQuery(value); setOpen(true) }}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
        required
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto mt-0.5">
          {filtered.map(nom => (
            <li
              key={nom}
              onMouseDown={e => { e.preventDefault(); onChange(nom); setQuery(''); setOpen(false) }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors ${value === nom ? 'font-medium text-green-700' : 'text-gray-700'}`}
            >
              {nom}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---- Mini-gestionnaire d'ingrédients par repas ----
function RepasEditor({ plat, delta, onToggleExclu, onSetOverride, onAddExtra, onRemoveExtra, suggestions }) {
  const [formExtra, setFormExtra] = useState({ nom: '', quantite: '', unite: 'g' })

  function handleAddExtra(e) {
    e.preventDefault()
    onAddExtra(formExtra)
    setFormExtra({ nom: '', quantite: '', unite: 'g' })
  }

  return (
    <div className="mt-2 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden text-xs">
      <div className="divide-y divide-gray-100">
        {plat.ingredients.map(ing => {
          const exclu = delta.excluded.includes(ing.id)
          const qte = delta.overrides[ing.id]?.quantite ?? ing.quantite
          const unite = delta.overrides[ing.id]?.unite ?? ing.unite
          return (
            <div key={ing.id} className={`flex items-center gap-2 px-3 py-1.5 ${exclu ? 'opacity-50' : ''}`}>
              <button
                type="button"
                onClick={() => onToggleExclu(ing.id)}
                className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${exclu ? 'border-gray-300 bg-gray-200' : 'border-green-400 bg-green-50 hover:bg-red-50 hover:border-red-300'}`}
              >
                {!exclu && <Check size={9} className="text-green-600" />}
              </button>
              <span className={`flex-1 min-w-0 font-medium text-gray-700 truncate ${exclu ? 'line-through text-gray-400' : ''}`}>
                {ing.nom}
              </span>
              {!exclu && (
                <>
                  <input
                    type="number" min="0" step="any"
                    value={qte}
                    onChange={e => onSetOverride(ing.id, e.target.value, unite)}
                    className="w-14 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                  <select
                    value={unite}
                    onChange={e => onSetOverride(ing.id, qte, e.target.value)}
                    className="rounded border border-gray-200 bg-white px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                  >
                    {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </>
              )}
              <button type="button" onClick={() => onToggleExclu(ing.id)} className={`shrink-0 transition-colors ${exclu ? 'text-gray-400 hover:text-green-500' : 'text-gray-300 hover:text-red-400'}`}>
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>

      {delta.extras.length > 0 && (
        <div className="border-t border-dashed border-gray-200">
          <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ajoutés pour ce repas</p>
          {delta.extras.map(extra => (
            <div key={extra.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="flex-1 font-medium text-green-700 truncate">{extra.nom}</span>
              <span className="text-gray-400 tabular-nums">{extra.quantite > 0 ? `${extra.quantite} ${extra.unite}` : extra.unite}</span>
              <button type="button" onClick={() => onRemoveExtra(extra.id)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAddExtra} className="border-t border-gray-100 px-3 py-2 flex flex-wrap gap-1.5 items-center">
        <IngredientCombobox
          value={formExtra.nom}
          onChange={nom => setFormExtra(f => ({ ...f, nom }))}
          suggestions={suggestions}
          placeholder="+ Ingrédient"
          className="flex-1 min-w-24"
        />
        <input
          type="number" min="0" step="any"
          value={formExtra.quantite}
          onChange={e => setFormExtra(f => ({ ...f, quantite: e.target.value }))}
          placeholder="Qté"
          className="w-14 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <select
          value={formExtra.unite}
          onChange={e => setFormExtra(f => ({ ...f, unite: e.target.value }))}
          className="rounded-lg border border-gray-200 bg-white px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button type="submit" className="flex items-center gap-1 rounded-lg bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 transition-colors">
          <Plus size={11} />Ajouter
        </button>
      </form>
    </div>
  )
}

// ---- Page Planning ----
function Planning() {
  const { plats, ajouterPlat, ajouterIngredient } = usePlats()
  const {
    semaine, espacesLibres,
    setMidi, setSoir,
    ajouterIngredientLibre, supprimerIngredientLibre, updateIngredientLibre,
    toggleExclu, setOverride, addExtra, removeExtra,
    resetPlanning, injectDefaultWeek, saveCurrentWeekAsDefault,
  } = usePlanningContext()

  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmInject, setConfirmInject] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSaveAsDefault() {
    const ok = await saveCurrentWeekAsDefault()
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }
  const [openSlots, setOpenSlots] = useState({})

  const [formsLibres, setFormsLibres] = useState({
    petitDejeuner: { nom: '', quantite: '', unite: 'g', platId: null },
    achatsPonctuels: { nom: '', quantite: '', unite: 'g', platId: null },
    alicya: { nom: '', quantite: '', unite: 'g', platId: null },
  })

  const ingredientSuggestions = useMemo(() => {
    const seen = new Set()
    plats.forEach(p => p.ingredients.forEach(i => seen.add(i.nom)))
    Object.values(espacesLibres).flat().forEach(i => seen.add(i.nom))
    return [...seen].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [plats, espacesLibres])

  const libresComboSuggestions = useMemo(() => {
    const names = new Set(ingredientSuggestions)
    plats.forEach(p => names.add(p.nom))
    return [...names].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [ingredientSuggestions, plats])

  function toggleSlot(key) {
    setOpenSlots(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function setFormLibre(bloc, field, value) {
    if (field === 'nom') {
      const matchingPlat = plats.find(p => p.nom === value)
      setFormsLibres(prev => ({ ...prev, [bloc]: { ...prev[bloc], nom: value, platId: matchingPlat?.id ?? null } }))
    } else {
      setFormsLibres(prev => ({ ...prev, [bloc]: { ...prev[bloc], [field]: value } }))
    }
  }

  function handleAjouterLibre(e, bloc) {
    e.preventDefault()
    ajouterIngredientLibre(bloc, formsLibres[bloc])
    setFormsLibres(prev => ({ ...prev, [bloc]: { nom: '', quantite: '', unite: 'g', platId: null } }))
  }

  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true)
    } else {
      resetPlanning()
      setConfirmReset(false)
      setOpenSlots({})
    }
  }

  function renderSlotToggle(jour, idx, repas) {
    const platId = jour[repas]
    if (!platId) return null
    const plat = plats.find(p => p.id === platId)
    if (!plat) return null
    const delta = jour[`${repas}Delta`] ?? { excluded: [], overrides: {}, extras: [] }
    const isModified = delta.excluded.length > 0 || delta.extras.length > 0 || Object.keys(delta.overrides).length > 0
    const slotKey = `${idx}-${repas}`
    const isOpen = !!openSlots[slotKey]
    const nbEffectifs = plat.ingredients.length - delta.excluded.length + delta.extras.length

    return (
      <>
        <button
          type="button"
          onClick={() => toggleSlot(slotKey)}
          className={`mt-1 flex items-center gap-1 text-[10px] font-medium transition-colors ${isModified ? 'text-orange-500 hover:text-orange-600' : 'text-gray-400 hover:text-gray-500'}`}
        >
          {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {nbEffectifs} ingr.{isModified && ' · modifié'}
        </button>
        {isOpen && (
          <RepasEditor
            plat={plat}
            delta={delta}
            onToggleExclu={ingId => toggleExclu(idx, repas, ingId)}
            onSetOverride={(ingId, q, u) => setOverride(idx, repas, ingId, q, u)}
            onAddExtra={extra => addExtra(idx, repas, extra)}
            onRemoveExtra={extraId => removeExtra(idx, repas, extraId)}
            suggestions={ingredientSuggestions}
          />
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* La Semaine */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">La Semaine</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
            {semaine.map((jour, idx) => (
              <div key={jour.jour} className="flex items-start gap-2 px-4 py-2.5">
                <span className="w-24 text-sm font-semibold text-gray-700 shrink-0 pt-1.5">{jour.jour}</span>
                <div className="flex flex-1 gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Midi</label>
                    <PlatCombobox value={jour.midi} onChange={platId => setMidi(idx, platId)} plats={plats} onCreatePlat={ajouterPlat} />
                    {renderSlotToggle(jour, idx, 'midi')}
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Soir</label>
                    <PlatCombobox value={jour.soir} onChange={platId => setSoir(idx, platId)} plats={plats} onCreatePlat={ajouterPlat} />
                    {renderSlotToggle(jour, idx, 'soir')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Les Espaces Libres */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Les Espaces Libres</h2>
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
                        <li key={ing.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                          <span className="flex-1 font-medium text-gray-800 truncate min-w-0">{ing.nom}</span>
                          <input
                            type="number" min="0" step="any"
                            value={ing.quantite}
                            onChange={e => updateIngredientLibre(key, ing.id, e.target.value, ing.unite)}
                            className="w-14 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                          <select
                            value={ing.unite}
                            onChange={e => updateIngredientLibre(key, ing.id, ing.quantite, e.target.value)}
                            className="rounded border border-gray-200 bg-white px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                          >
                            {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <button
                            onClick={() => supprimerIngredientLibre(key, ing.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
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
                    <IngredientCombobox
                      value={formsLibres[key].nom}
                      onChange={nom => setFormLibre(key, 'nom', nom)}
                      suggestions={libresComboSuggestions}
                      placeholder="Ingrédient ou plat"
                      className="flex-1 min-w-28"
                    />
                    <input
                      type="text"
                      value={formsLibres[key].quantite}
                      onChange={e => setFormLibre(key, 'quantite', e.target.value)}
                      placeholder="Qté (opt.)"
                      className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {formsLibres[key].quantite && (
                      <select
                        value={formsLibres[key].unite}
                        onChange={e => setFormLibre(key, 'unite', e.target.value)}
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    )}
                    <button type="submit" className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 active:scale-95 transition-all">
                      <Plus size={14} />Ajouter
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Actions planning */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSaveAsDefault}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-green-100 text-green-700 border border-green-200' : 'border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
          >
            {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            {saved ? 'Modèle sauvegardé !' : 'Sauvegarder comme modèle'}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {confirmInject ? (
            <>
              <span className="text-sm text-gray-600">Attention, cela va écraser la semaine en cours.</span>
              <button
                onClick={() => { injectDefaultWeek(plats, ajouterPlat, ajouterIngredient); setConfirmInject(false); setOpenSlots({}) }}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Confirmer
              </button>
              <button onClick={() => setConfirmInject(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-100 transition-colors">Annuler</button>
            </>
          ) : (
            <button
              onClick={() => { setConfirmReset(false); setConfirmInject(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
            >
              <RotateCcw size={14} />Semaine type
            </button>
          )}

          {!confirmInject && (
            confirmReset ? (
              <>
                <span className="text-sm text-gray-600">Tout effacer ?</span>
                <button onClick={handleReset} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors">Confirmer</button>
                <button onClick={() => setConfirmReset(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-100 transition-colors">Annuler</button>
              </>
            ) : (
              <button onClick={handleReset} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <RotateCcw size={14} />Réinitialiser le planning
              </button>
            )
          )}
        </div>

      </main>
    </div>
  )
}

export default Planning
