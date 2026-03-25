import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Trash2, Plus, ShoppingCart, Package, RotateCcw, X,
  Check, ChevronDown, ChevronUp, GripVertical,
} from 'lucide-react'
import {
  DndContext, DragOverlay, useDroppable, useDraggable,
  useSensor, useSensors, MouseSensor, TouchSensor,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { usePlats } from '../hooks/usePlats'
import { useMagasinContext } from '../context/MagasinContext'
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

// ---- Ingrédient draggable ----
function DraggableIngredient({ item, isChecked, onToggle, borderColor }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ing:${item.nom}`,
    data: item,
  })
  const style = { transform: CSS.Translate.toString(transform) }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2.5 select-none transition-all hover:bg-gray-50 ${isChecked ? 'opacity-50' : ''} ${isDragging ? 'opacity-20' : ''}`}
    >
      <span
        {...listeners}
        {...attributes}
        className="touch-none cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0"
      >
        <GripVertical size={14} />
      </span>
      <span
        onClick={onToggle}
        className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors cursor-pointer ${isChecked ? 'border-green-500 bg-green-500' : borderColor}`}
      >
        {isChecked && <Check size={10} className="text-white" />}
      </span>
      <span
        onClick={onToggle}
        className={`flex-1 text-sm font-medium transition-colors cursor-pointer ${isChecked ? 'line-through text-gray-400' : 'text-gray-800'}`}
      >
        {item.nom}
      </span>
      <span className={`text-sm tabular-nums transition-colors ${isChecked ? 'text-gray-300' : 'text-gray-400'}`}>
        {item.quantite > 0 ? `${item.quantite} ${item.unite}` : item.unite}
      </span>
    </li>
  )
}

// ---- Zone droppable (rayon) ----
function DroppableRayon({ rayonId, label, items, checkedItems, onToggleChecked, isOrphan = false }) {
  const { setNodeRef, isOver } = useDroppable({ id: `rayon:${rayonId}` })
  const sorted = [...items].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  const isEmpty = items.length === 0
  const borderClass = isOrphan ? 'border-orange-100' : 'border-gray-100'

  return (
    <section ref={setNodeRef} className={`rounded-xl transition-all ${isOver ? 'ring-2 ring-green-400 ring-offset-1' : ''}`}>
      <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2 ${isOver ? 'text-green-600' : isEmpty ? 'text-gray-300' : 'text-gray-400'}`}>
        {isOrphan && <Package size={13} />}
        {label}
        <span className="font-normal normal-case opacity-60">({items.length})</span>
        {isOver && <span className="text-green-500 font-normal normal-case text-[10px]">← déposer ici</span>}
      </h3>
      {isEmpty ? (
        <div className={`rounded-xl border-2 border-dashed px-4 py-3 text-center text-xs italic transition-colors ${isOver ? 'border-green-300 text-green-400 bg-green-50' : 'border-gray-200 text-gray-300'}`}>
          Aucun ingrédient
        </div>
      ) : (
        <ul className={`bg-white rounded-xl shadow-sm border divide-y divide-gray-50 transition-colors ${isOver ? 'border-green-300' : borderClass}`}>
          {sorted.map(item => (
            <DraggableIngredient
              key={item.nom}
              item={item}
              isChecked={checkedItems.has(item.nom.toLowerCase())}
              onToggle={() => onToggleChecked(item.nom.toLowerCase())}
              borderColor={isOrphan ? 'border-orange-200' : 'border-gray-300'}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

// ---- Page Planning ----
function Planning() {
  const { plats, ajouterPlat } = usePlats()
  const { magasins, magasinActif, getRayon, setRayon } = useMagasinContext()
  const {
    semaine, espacesLibres,
    setMidi, setSoir,
    ajouterIngredientLibre, supprimerIngredientLibre, updateIngredientLibre,
    toggleExclu, setOverride, addExtra, removeExtra,
    resetPlanning,
  } = usePlanningContext()

  const [confirmReset, setConfirmReset] = useState(false)
  const [openSlots, setOpenSlots] = useState({})
  const [checkedItems, setCheckedItems] = useState(() => new Set())
  const [activeItem, setActiveItem] = useState(null)

  const [formsLibres, setFormsLibres] = useState({
    petitDejeuner: { nom: '', quantite: '', unite: 'g', platId: null },
    achatsPonctuels: { nom: '', quantite: '', unite: 'g', platId: null },
    alicya: { nom: '', quantite: '', unite: 'g', platId: null },
  })

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const ingredientSuggestions = useMemo(() => {
    const seen = new Set()
    plats.forEach(p => p.ingredients.forEach(i => seen.add(i.nom)))
    Object.values(espacesLibres).flat().forEach(i => seen.add(i.nom))
    return [...seen].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [plats, espacesLibres])

  // Suggestions mixtes pour les Espaces Libres : ingrédients + noms de plats
  const libresComboSuggestions = useMemo(() => {
    const names = new Set(ingredientSuggestions)
    plats.forEach(p => names.add(p.nom))
    return [...names].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [ingredientSuggestions, plats])

  function toggleSlot(key) {
    setOpenSlots(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleChecked(key) {
    setCheckedItems(prev => {
      const s = new Set(prev)
      s.has(key) ? s.delete(key) : s.add(key)
      return s
    })
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
      setCheckedItems(new Set())
    }
  }

  // ---- DnD handlers ----
  function handleDragStart({ active }) {
    setActiveItem(active.data.current)
  }

  function handleDragEnd({ active, over }) {
    setActiveItem(null)
    if (!over) return
    const ingNom = active.id.replace(/^ing:/, '')
    if (over.id.startsWith('rayon:')) {
      const newRayon = over.id.slice(6) // '' means unclassified
      setRayon(ingNom, newRayon)
    }
  }

  // ---- Calcul liste de courses ----
  const magasinCourant = magasins.find(m => m.nom === magasinActif)
  const rayonsOrdonnes = magasinCourant?.rayons.map(r => r.nom) ?? []

  const ingredientsMap = {}

  for (const jour of semaine) {
    for (const repas of ['midi', 'soir']) {
      const platId = jour[repas]
      const delta = jour[`${repas}Delta`] ?? { excluded: [], overrides: {}, extras: [] }
      if (!platId) continue
      const plat = plats.find(p => p.id === platId)
      if (!plat) continue
      for (const ing of plat.ingredients) {
        if (delta.excluded.includes(ing.id)) continue
        const key = ing.nom.toLowerCase()
        const qteActuelle = Number(delta.overrides[ing.id]?.quantite ?? ing.quantite)
        const uniteActuelle = delta.overrides[ing.id]?.unite ?? ing.unite
        if (!ingredientsMap[key]) ingredientsMap[key] = { nom: ing.nom, quantite: 0, unite: uniteActuelle }
        ingredientsMap[key].quantite += qteActuelle
      }
      for (const extra of delta.extras) {
        const key = extra.nom.toLowerCase()
        if (!ingredientsMap[key]) ingredientsMap[key] = { nom: extra.nom, quantite: 0, unite: extra.unite }
        ingredientsMap[key].quantite += Number(extra.quantite) || 0
      }
    }
  }
  for (const { key } of BLOCS_LIBRES) {
    for (const ing of espacesLibres[key]) {
      if (ing.platId) {
        const plat = plats.find(p => p.id === ing.platId)
        if (plat) {
          const multiplier = Number(ing.quantite) || 1
          for (const platIng of plat.ingredients) {
            const mapKey = platIng.nom.toLowerCase()
            if (!ingredientsMap[mapKey]) ingredientsMap[mapKey] = { nom: platIng.nom, quantite: 0, unite: platIng.unite }
            ingredientsMap[mapKey].quantite += Number(platIng.quantite) * multiplier
          }
        }
      } else {
        const mapKey = ing.nom.toLowerCase()
        if (!ingredientsMap[mapKey]) ingredientsMap[mapKey] = { nom: ing.nom, quantite: 0, unite: ing.unite }
        ingredientsMap[mapKey].quantite += Number(ing.quantite) || 0
      }
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

  // ---- Helper slot toggle ----
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
      <main className="max-w-6xl mx-auto px-4 py-6 md:grid md:grid-cols-5 md:gap-6 md:items-start">

        {/* ===== COLONNE GAUCHE ===== */}
        <div className="md:col-span-3 space-y-6">

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

          {/* Reset */}
          <div className="flex items-center gap-3">
            {confirmReset ? (
              <>
                <span className="text-sm text-gray-600">Réinitialiser le planning ?</span>
                <button onClick={handleReset} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors">Confirmer</button>
                <button onClick={() => setConfirmReset(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-100 transition-colors">Annuler</button>
              </>
            ) : (
              <button onClick={handleReset} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <RotateCcw size={14} />Réinitialiser le planning
              </button>
            )}
          </div>
        </div>

        {/* ===== COLONNE DROITE : LISTE DE COURSES ===== */}
        <div className="mt-6 md:mt-0 md:col-span-2 md:sticky md:top-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Liste de courses
            {totalIngredients > 0 && <span className="ml-2 text-gray-300 font-normal normal-case">({totalIngredients} ingr.)</span>}
          </h2>
          {totalIngredients > 0 && (
            <p className="text-[10px] text-gray-400 mb-3">Glissez un ingrédient vers un rayon pour le reclasser.</p>
          )}

          {rayonsOrdonnes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300 bg-white rounded-xl shadow-sm border border-gray-100">
              <ShoppingCart size={36} className="mb-3" />
              <p className="text-sm text-center leading-relaxed">Sélectionnez des plats<br />ou ajoutez des ingrédients libres.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="space-y-4">
                {rayonsOrdonnes.map(rayonNom => (
                  <DroppableRayon
                    key={rayonNom}
                    rayonId={rayonNom}
                    label={rayonNom}
                    items={grouped[rayonNom] ?? []}
                    checkedItems={checkedItems}
                    onToggleChecked={toggleChecked}
                  />
                ))}

                {orphelins.length > 0 && (
                  <>
                    <DroppableRayon
                      rayonId=""
                      label="Autres / Non classés"
                      items={orphelins}
                      checkedItems={checkedItems}
                      onToggleChecked={toggleChecked}
                      isOrphan
                    />
                    <p className="text-xs text-gray-400 text-center">
                      Assignez un rayon dans Paramètres → Catalogue, ou glissez l&apos;ingrédient sur un rayon.
                    </p>
                  </>
                )}
              </div>

              <DragOverlay>
                {activeItem && (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-green-400 rounded-xl shadow-xl text-sm pointer-events-none">
                    <GripVertical size={14} className="text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-800 flex-1">{activeItem.nom}</span>
                    <span className="text-gray-400 tabular-nums">
                      {activeItem.quantite > 0 ? `${activeItem.quantite} ${activeItem.unite}` : activeItem.unite}
                    </span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>

      </main>
    </div>
  )
}

export default Planning
