import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  DndContext, DragOverlay,
  PointerSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable,
  MeasuringStrategy, pointerWithin,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Trash2, ChevronDown, Pencil, X, Check, Store, GripVertical, Search,
  GitMerge,
} from 'lucide-react'
import { usePlats } from '../hooks/usePlats'
import { useMagasinContext } from '../context/MagasinContext'
import { usePlanningContext } from '../context/PlanningContext'

const UNITES = ['g', 'kg', 'L', 'cL', 'mL', 'pièce', 'c.à.s', 'c.à.c']

const inputBase =
  'rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm ink placeholder:text-[color:var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40'
const inputSm =
  'rounded-lg border border-white/70 bg-white/60 px-2.5 py-1.5 text-sm ink placeholder:text-[color:var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40'
const inputXs =
  'rounded-md border border-white/70 bg-white/70 px-1.5 py-0.5 text-xs ink placeholder:text-[color:var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40'
const btnPrimary =
  'flex items-center gap-1.5 rounded-xl accent-bg px-4 py-2 text-sm font-semibold hover:brightness-110 active:scale-95 transition-all'
const btnPrimarySm =
  'flex items-center gap-1 rounded-lg accent-bg px-3 py-1.5 text-sm font-semibold hover:brightness-110 active:scale-95 transition-all'

// ---- Fast scroll mobile (barre latérale) ----
const THUMB_H = 44
function FastScroll() {
  const [thumbPct, setThumbPct] = useState(0)
  const trackRef = useRef(null)

  useEffect(() => {
    function sync() {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setThumbPct(max > 0 ? Math.min(1, window.scrollY / max) : 0)
    }
    sync()
    window.addEventListener('scroll', sync, { passive: true })
    return () => window.removeEventListener('scroll', sync)
  }, [])

  function handleTouchStart(e) {
    e.stopPropagation()
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    function move(ev) {
      ev.preventDefault()
      const touch = ev.touches[0]
      const pct = Math.max(0, Math.min(1, (touch.clientY - rect.top - THUMB_H / 2) / (rect.height - THUMB_H)))
      window.scrollTo({ top: pct * (document.documentElement.scrollHeight - window.innerHeight) })
    }
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', () => window.removeEventListener('touchmove', move), { once: true })
  }

  return (
    <div
      ref={trackRef}
      className="fixed right-1.5 top-[18%] bottom-[18%] z-40 md:hidden w-1.5 bg-white/50 rounded-full"
    >
      <div
        className="absolute w-full rounded-full bg-[color:var(--accent)]/60 touch-none"
        style={{ height: THUMB_H, top: `calc(${thumbPct * 100}% - ${thumbPct * THUMB_H}px)` }}
        onTouchStart={handleTouchStart}
      />
    </div>
  )
}

// ---- Détection automatique de doublons ----
function detecterDoublons(noms) {
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const pairs = []
  const vu = new Set()
  for (let i = 0; i < noms.length; i++) {
    for (let j = i + 1; j < noms.length; j++) {
      const a = noms[i], b = noms[j]
      const na = norm(a), nb = norm(b)
      if (na === nb || na + 's' === nb || nb + 's' === na || na + 'x' === nb || nb + 'x' === na) {
        const key = [na, nb].sort().join('|')
        if (!vu.has(key)) { pairs.push([a, b]); vu.add(key) }
      }
    }
  }
  return pairs.slice(0, 8)
}

const CATEGORIES_ORDER = ['PÂTES', 'Dej', 'Dîner', 'Élaborés', 'Conserves', 'Surgelés', 'Autres']
const CAT_COLORS = {
  'PÂTES': 'text-amber-600',
  'Dej': 'text-sky-600',
  'Dîner': 'text-violet-600',
  'Élaborés': 'text-rose-600',
  'Conserves': 'text-emerald-600',
  'Surgelés': 'text-cyan-600',
  'Autres': 'ink-3',
}
const CAT_EMOJIS = {
  'PÂTES': '🍝',
  'Dej': '🥪',
  'Dîner': '🍲',
  'Élaborés': '👨‍🍳',
  'Conserves': '🥫',
  'Surgelés': '❄️',
  'Autres': '🍽️',
}

// ---- Carte plat draggable ----
function DraggablePlatCard({ plat, isSelected, onSelect }) {
  const emoji = CAT_EMOJIS[plat.categorie] ?? '🍽️'
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: plat.id })
  const style = { transform: CSS.Translate.toString(transform) }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(plat.id)}
      className={`flex items-center gap-2 pl-1 pr-3 py-2 rounded-xl border select-none transition-all ${
        isDragging ? 'opacity-50 shadow-md z-10 relative' : ''
      } ${
        isSelected
          ? 'border-[color:var(--accent)]/40 ring-2 ring-[color:var(--accent)]/20 accent-soft-bg'
          : 'border-white/70 bg-white/60 hover:border-[color:var(--accent)]/40 hover:bg-white/80 backdrop-blur-sm'
      }`}
    >
      <span
        {...listeners}
        {...attributes}
        className="touch-none cursor-grab active:cursor-grabbing shrink-0 ink-4 hover:ink-3 transition-colors px-1"
        aria-label="Déplacer"
      >
        <GripVertical size={14} />
      </span>
      <span className="text-base shrink-0 leading-none">{emoji}</span>
      <span className={`text-sm font-semibold whitespace-nowrap ${isSelected ? 'accent-text' : 'ink-2'}`}>
        {plat.nom}
      </span>
    </div>
  )
}

// ---- Catégorie droppable ----
function DroppableCategorie({ categorie, plats, selectedPlatId, onSelectPlat }) {
  const { setNodeRef, isOver } = useDroppable({ id: `categorie:${categorie}` })

  return (
    <section
      ref={setNodeRef}
      className={`rounded-xl p-3 -mx-3 transition-all ${isOver ? 'accent-soft-bg ring-2 ring-[color:var(--accent)]/40 ring-offset-1' : ''}`}
    >
      <h3 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-3 ${
        isOver ? 'accent-text' : (CAT_COLORS[categorie] ?? 'ink-3')
      }`}>
        <span>{CAT_EMOJIS[categorie]}</span>
        {categorie}
        <span className="normal-case font-normal ink-4">{plats.length}</span>
      </h3>
      <div className="flex flex-wrap gap-2 min-h-10">
        {plats.length === 0 ? (
          <span className={`text-xs italic self-center transition-colors ${isOver ? 'accent-text' : 'ink-4'}`}>
            Déposer ici
          </span>
        ) : (
          plats.map(plat => (
            <DraggablePlatCard
              key={plat.id}
              plat={plat}
              isSelected={selectedPlatId === plat.id}
              onSelect={onSelectPlat}
            />
          ))
        )}
      </div>
    </section>
  )
}

// ---- Toggle Tricount compact (3 boutons emoji) ----
// Codes domaine : me=bleu, both=accent (50/50), ali=rose
const SPLIT_MINI_OPTS = [
  { val: 'me', emoji: '👦', active: 'bg-blue-500 text-white', title: 'Moi' },
  { val: 'both', emoji: '👥', active: 'accent-bg', title: '50/50' },
  { val: 'ali', emoji: '👩', active: 'bg-pink-500 text-white', title: 'Ali' },
]

function SplitMini({ value, onChange }) {
  return (
    <div className="flex rounded-md border border-white/70 bg-white/50 overflow-hidden shrink-0">
      {SPLIT_MINI_OPTS.map((opt, i) => (
        <button
          key={opt.val}
          type="button"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onChange(opt.val) }}
          title={opt.title}
          className={`w-6 h-6 flex items-center justify-center text-[11px] transition-colors ${i > 0 ? 'border-l border-white/70' : ''} ${
            value === opt.val ? opt.active : 'hover:bg-white/80'
          }`}
        >
          {opt.emoji}
        </button>
      ))}
    </div>
  )
}

// ---- Tag ingrédient draggable + actions ----
function IngredientTag({ nom, isAssigned, onRename, onDelete }) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [newNom, setNewNom] = useState(nom)
  const submittedRef = useRef(false)
  const { getSplit, setSplit } = useMagasinContext()

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: nom })
  const style = { transform: CSS.Translate.toString(transform) }

  function confirmRename() {
    const trimmed = newNom.trim()
    if (trimmed && trimmed !== nom) onRename(trimmed)
    setIsRenaming(false)
  }

  function cancelRename() {
    setNewNom(nom)
    setIsRenaming(false)
  }

  if (isRenaming) {
    return (
      <input
        autoFocus
        value={newNom}
        onChange={e => setNewNom(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submittedRef.current = true; confirmRename() }
          if (e.key === 'Escape') { submittedRef.current = true; cancelRename() }
        }}
        onBlur={() => {
          if (submittedRef.current) { submittedRef.current = false; return }
          confirmRename()
        }}
        className="rounded-lg border-2 border-[color:var(--accent)]/50 bg-white/80 px-3 py-1.5 text-sm ink focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 w-full"
      />
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 pl-3 pr-1.5 py-2 rounded-lg border bg-white/60 backdrop-blur-sm shadow-sm select-none transition-opacity ${
        isDragging ? 'opacity-50' : ''
      } ${isAssigned ? 'border-white/70' : 'border-orange-200/70'}`}
    >
      <span className={`flex-1 text-sm truncate min-w-0 ${isAssigned ? 'ink-2' : 'text-orange-600'}`}>{nom}</span>
      <SplitMini value={getSplit(nom)} onChange={val => setSplit(nom, val)} />
      <button
        type="button"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); setIsRenaming(true); setNewNom(nom) }}
        className="ink-4 hover:accent-text transition-colors shrink-0"
        aria-label={`Renommer ${nom}`}
      >
        <Pencil size={11} />
      </button>
      <button
        type="button"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation()
          if (window.confirm(`Supprimer l'ingrédient "${nom}" ?\n\nAttention : il sera retiré de toutes les recettes dans lesquelles il apparaît.`)) {
            onDelete()
          }
        }}
        className="ink-4 hover:text-red-500 transition-colors shrink-0"
        aria-label={`Supprimer ${nom}`}
      >
        <X size={10} />
      </button>
      <span
        {...listeners}
        {...attributes}
        className="touch-none cursor-grab active:cursor-grabbing shrink-0 ink-4 hover:ink-3 transition-colors px-1"
        aria-label="Déplacer"
      >
        <GripVertical size={12} />
      </span>
    </div>
  )
}

// ---- Section ingrédients droppable ----
function DroppableSection({ sectionId, title, ings, isUnassigned, onRenameIngredient, onDeleteIngredient, condensed }) {
  const { setNodeRef, isOver } = useDroppable({ id: sectionId })

  return (
    <section
      ref={setNodeRef}
      className={`rounded-xl px-3 py-2.5 -mx-3 transition-all ${
        isOver ? 'accent-soft-bg ring-2 ring-[color:var(--accent)]/40 ring-offset-1' : ''
      }`}
    >
      <h3 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${
        condensed ? 'mb-0' : 'mb-2.5'
      } ${
        isUnassigned ? 'text-orange-500' : isOver ? 'accent-text' : 'ink-3'
      }`}>
        {title}
        <span className={`normal-case font-normal ${isOver ? 'accent-text' : 'ink-4'}`}>{ings.length}</span>
        {condensed && isOver && (
          <span className="accent-text font-normal normal-case ml-auto">↓ déposer ici</span>
        )}
      </h3>
      <div className={`flex flex-col gap-1.5 ${condensed ? 'hidden' : ''}`}>
        {ings.map(({ key, nom: ingNom }) => (
          <IngredientTag
            key={key}
            nom={ingNom}
            isAssigned={!isUnassigned}
            onRename={nouveauNom => onRenameIngredient(ingNom, nouveauNom)}
            onDelete={() => onDeleteIngredient(ingNom)}
          />
        ))}
      </div>
    </section>
  )
}

// ---- Ligne rayon draggable ----
function DraggableRayonRow({ rayon, magasinCourant, total, renommerRayon, supprimerRayon }) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: rayon.id })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: rayon.id })
  const [editMode, setEditMode] = useState(false)
  const [editNom, setEditNom] = useState(rayon.nom)

  const setRef = node => { setDragRef(node); setDropRef(node) }
  const style = { transform: CSS.Translate.toString(transform) }

  function confirmEdit() {
    renommerRayon(magasinCourant.id, rayon.id, editNom)
    setEditMode(false)
  }
  function cancelEdit() {
    setEditNom(rayon.nom)
    setEditMode(false)
  }
  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); confirmEdit() }
    if (e.key === 'Escape') cancelEdit()
  }

  return (
    <div
      ref={setRef}
      style={style}
      className={`flex items-center gap-2 pl-4 pr-2 py-3 transition-all ${
        isDragging ? 'opacity-40 shadow-lg relative z-10 bg-white/80' : ''
      } ${isOver && !isDragging ? 'border-t-2 border-[color:var(--accent)]/60' : ''}`}
    >
      {editMode ? (
        <input
          autoFocus
          type="text"
          value={editNom}
          onChange={e => setEditNom(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded-lg border border-[color:var(--accent)]/50 bg-white/80 px-3 py-1 text-sm ink focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
        />
      ) : (
        <span className="flex-1 text-sm font-semibold ink">{rayon.nom}</span>
      )}

      {editMode ? (
        <div className="flex gap-1">
          <button onClick={confirmEdit} className="p-1.5 accent-text hover:accent-soft-bg rounded-lg transition-colors" aria-label="Confirmer">
            <Check size={14} />
          </button>
          <button onClick={cancelEdit} className="p-1.5 ink-3 hover:bg-white/60 rounded-lg transition-colors" aria-label="Annuler">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex gap-1">
          <button
            onClick={() => { setEditMode(true); setEditNom(rayon.nom) }}
            className="p-1.5 ink-3 hover:accent-text hover:accent-soft-bg rounded-lg transition-colors"
            aria-label="Renommer"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => supprimerRayon(magasinCourant.id, rayon.id)}
            disabled={total <= 1}
            className="p-1.5 ink-3 hover:text-red-500 hover:bg-red-50/50 rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
            aria-label="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      <button
        {...listeners}
        {...attributes}
        type="button"
        className="touch-none p-1 cursor-grab active:cursor-grabbing ink-4 hover:ink-3 transition-colors shrink-0"
        aria-label="Réordonner"
      >
        <GripVertical size={16} />
      </button>
    </div>
  )
}

// ======== Page Paramètres ========
function Parametres() {
  const {
    plats, ajouterPlat, supprimerPlat, renommerPlat, updatePlatCategorie,
    ajouterIngredient, supprimerIngredient, updateIngredient, renommerIngredient, supprimerIngredientDePlats,
    fusionnerIngredients,
  } = usePlats()
  const {
    magasins, renommerRayon, ajouterRayon, supprimerRayon, reorderRayons,
    magasinActif, setMagasinActif, getRayon, setRayon,
    renommerIngredientDansRayons, supprimerIngredientDansRayons,
    standaloneIngredients, ajouterIngredientStandalone,
    setSplit,
  } = useMagasinContext()
  const { espacesLibres } = usePlanningContext()

  const { pathname } = useLocation()
  const activeTab = pathname.endsWith('/rayons') ? 'rayons'
    : pathname.endsWith('/ingredients') ? 'ingredients'
    : 'plats'

  const magasinCourant = magasins.find(m => m.nom === magasinActif)
  const rayonsActifs = magasinCourant?.rayons.map(r => r.nom) ?? []

  const byCategorie = {}
  for (const plat of plats) {
    const cat = plat.categorie ?? 'Autres'
    if (!byCategorie[cat]) byCategorie[cat] = []
    byCategorie[cat].push(plat)
  }

  // --- État onglet Plats ---
  const [nomPlat, setNomPlat] = useState('')
  const [categorieNouveauPlat, setCategorieNouveauPlat] = useState('PÂTES')
  const [ingredientForms, setIngredientForms] = useState({})
  const [selectedPlatId, setSelectedPlatId] = useState(null)
  const [editPlatNomId, setEditPlatNomId] = useState(null)
  const [editPlatNomValue, setEditPlatNomValue] = useState('')
  const editPlatNomSubmittedRef = useRef(false)
  const [editIngId, setEditIngId] = useState(null)
  const [editIngValues, setEditIngValues] = useState({ quantite: '', unite: 'g' })

  // --- État onglet Ingrédients ---
  const [searchIngredients, setSearchIngredients] = useState('')
  const [activeIngId, setActiveIngId] = useState(null)
  const [nomNouvelIng, setNomNouvelIng] = useState('')
  const [rayonNouvelIng, setRayonNouvelIng] = useState('')
  const [splitNouvelIng, setSplitNouvelIng] = useState('both')
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [mergeKeep, setMergeKeep] = useState('')
  const [mergeRemove, setMergeRemove] = useState('')

  // --- État onglet Rayons ---
  const [nouveauRayon, setNouveauRayon] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 0, tolerance: 5 } }),
  )

  const _ingNamesSet = new Set()
  for (const p of plats) for (const i of p.ingredients) _ingNamesSet.add(i.nom)
  for (const nom of standaloneIngredients) _ingNamesSet.add(nom)
  const allIngredientNames = [..._ingNamesSet].sort((a, b) => a.localeCompare(b, 'fr'))

  // ---- Plats handlers ----
  function handleAjouterPlat(e) {
    e.preventDefault()
    ajouterPlat(nomPlat, categorieNouveauPlat)
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

  function handleSelectPlat(platId) {
    setSelectedPlatId(prev => prev === platId ? null : platId)
    setEditPlatNomId(null)
    setEditIngId(null)
  }

  function startEditPlatNom(plat) {
    setEditPlatNomId(plat.id)
    setEditPlatNomValue(plat.nom)
    editPlatNomSubmittedRef.current = false
  }

  function confirmEditPlatNom(platId) {
    renommerPlat(platId, editPlatNomValue)
    setEditPlatNomId(null)
  }

  function startEditIng(ing) {
    setEditIngId(ing.id)
    setEditIngValues({ quantite: ing.quantite, unite: ing.unite })
  }

  function confirmEditIng(platId) {
    updateIngredient(platId, editIngId, editIngValues)
    setEditIngId(null)
  }

  // ---- Plats DnD ----
  function handlePlatDragEnd({ active, over }) {
    if (!over) return
    const targetId = String(over.id)
    if (!targetId.startsWith('categorie:')) return
    updatePlatCategorie(String(active.id), targetId.slice('categorie:'.length))
  }

  // ---- Ingrédients : renommage + suppression ----
  function handleRenameIngredient(ancienNom, nouveauNom) {
    renommerIngredient(ancienNom, nouveauNom)
    renommerIngredientDansRayons(ancienNom, nouveauNom)
  }

  function handleDeleteIngredient(nom) {
    supprimerIngredientDePlats(nom)
    supprimerIngredientDansRayons(nom)
  }

  // ---- Ingrédients : ajout rapide ----
  function handleAjouterIngredientStandalone(e) {
    e.preventDefault()
    ajouterIngredientStandalone(nomNouvelIng, rayonNouvelIng)
    if (splitNouvelIng !== 'both') setSplit(nomNouvelIng, splitNouvelIng)
    setNomNouvelIng('')
    setRayonNouvelIng('')
    setSplitNouvelIng('both')
  }

  // ---- Ingrédients DnD ----
  function handleIngredientDragStart({ active }) {
    setActiveIngId(String(active.id))
  }

  function handleIngredientDragEnd({ active, over }) {
    setActiveIngId(null)
    if (!over) return
    if (!String(over.id).startsWith('section:')) return
    const targetRayon = String(over.id).slice('section:'.length)
    setRayon(String(active.id), targetRayon === '__unassigned__' ? '' : targetRayon)
  }

  // ---- Fusion d'ingrédients ----
  function handleFusion() {
    if (!mergeKeep || !mergeRemove || mergeKeep === mergeRemove) return
    fusionnerIngredients(mergeRemove, mergeKeep)
    supprimerIngredientDansRayons(mergeRemove)
    setShowMergeModal(false)
    setMergeKeep('')
    setMergeRemove('')
  }

  // ---- Rayons DnD ----
  function handleRayonDragEnd({ active, over }) {
    if (!over || active.id === over.id || !magasinCourant) return
    const rayons = magasinCourant.rayons
    const fromIdx = rayons.findIndex(r => r.id === active.id)
    const toIdx = rayons.findIndex(r => r.id === over.id)
    if (fromIdx === -1 || toIdx === -1) return
    const newRayons = [...rayons]
    const [moved] = newRayons.splice(fromIdx, 1)
    newRayons.splice(toIdx, 0, moved)
    reorderRayons(magasinCourant.id, newRayons)
  }

  function handleAjouterRayon(e) {
    e.preventDefault()
    if (magasinCourant) ajouterRayon(magasinCourant.id, nouveauRayon)
    setNouveauRayon('')
  }

  const selectedPlat = plats.find(p => p.id === selectedPlatId)
  const ingDragging = activeIngId !== null

  // ---- JSX : liste d'ingrédients d'un plat + form ----
  function renderIngredients(plat) {
    return (
      <div className="space-y-2">
        {plat.ingredients.length > 0 ? (
          <ul className="space-y-1">
            {plat.ingredients.map(ing => (
              <li
                key={ing.id}
                className="flex items-center gap-1.5 text-sm ink-2 glass-sm px-2.5 py-1.5 min-w-0"
              >
                {editIngId === ing.id ? (
                  <>
                    <span className="font-semibold min-w-0 flex-1 truncate text-xs">{ing.nom}</span>
                    <input
                      type="number" min="0" step="any" autoFocus
                      value={editIngValues.quantite}
                      onChange={e => setEditIngValues(prev => ({ ...prev, quantite: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); confirmEditIng(plat.id) }
                        if (e.key === 'Escape') setEditIngId(null)
                      }}
                      className={`w-16 shrink-0 ${inputXs}`}
                    />
                    <select
                      value={editIngValues.unite}
                      onChange={e => setEditIngValues(prev => ({ ...prev, unite: e.target.value }))}
                      className={`shrink-0 ${inputXs}`}
                    >
                      {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <select
                      value={getRayon(ing.nom)}
                      onChange={e => setRayon(ing.nom, e.target.value)}
                      className={`w-24 shrink-0 ${inputXs}`}
                    >
                      <option value="">— rayon —</option>
                      {rayonsActifs.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={() => confirmEditIng(plat.id)} className="p-0.5 accent-text hover:accent-soft-bg rounded shrink-0" aria-label="Confirmer">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setEditIngId(null)} className="p-0.5 ink-4 hover:ink-3 rounded shrink-0" aria-label="Annuler">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="font-semibold min-w-0 flex-1 truncate ink">{ing.nom}</span>
                    <span className="ink-3 text-xs shrink-0 whitespace-nowrap mono">{ing.quantite} {ing.unite}</span>
                    <select
                      value={getRayon(ing.nom)}
                      onChange={e => setRayon(ing.nom, e.target.value)}
                      className={`w-28 shrink-0 ${inputXs}`}
                    >
                      <option value="">— rayon —</option>
                      {rayonsActifs.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={() => startEditIng(ing)} className="p-0.5 ink-4 hover:accent-text transition-colors shrink-0" aria-label={`Modifier ${ing.nom}`}>
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => supprimerIngredient(plat.id, ing.id)} className="p-0.5 ink-4 hover:text-red-500 transition-colors shrink-0" aria-label={`Supprimer ${ing.nom}`}>
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs ink-3 italic text-center py-3">Aucun ingrédient pour ce plat.</p>
        )}

        <form onSubmit={e => handleAjouterIngredient(e, plat.id)} className="flex flex-wrap gap-1.5 pt-1">
          <datalist id={`ing-list-${plat.id}`}>
            {allIngredientNames.map(n => <option key={n} value={n} />)}
          </datalist>
          <input
            type="text"
            list={`ing-list-${plat.id}`}
            value={getIngredientForm(plat.id).nom}
            onChange={e => setIngredientField(plat.id, 'nom', e.target.value)}
            placeholder="Ingrédient"
            className={`flex-1 min-w-24 ${inputSm}`}
            required
          />
          <input
            type="number" min="0" step="any"
            value={getIngredientForm(plat.id).quantite}
            onChange={e => setIngredientField(plat.id, 'quantite', e.target.value)}
            placeholder="Qté"
            className={`w-16 ${inputSm}`}
            required
          />
          <select
            value={getIngredientForm(plat.id).unite}
            onChange={e => setIngredientField(plat.id, 'unite', e.target.value)}
            className={inputSm}
          >
            {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <button type="submit" className={btnPrimarySm}>
            <Plus size={14} />Ajouter
          </button>
        </form>
      </div>
    )
  }

  // ---- JSX : panneau d'édition d'un plat ----
  function renderEditPanel(plat, showClose = false) {
    const emoji = CAT_EMOJIS[plat.categorie] ?? '🍽️'
    const isEditingNom = editPlatNomId === plat.id

    return (
      <div className="glass sheen">
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-white/40">
          <span className="text-xl shrink-0 leading-none">{emoji}</span>

          {isEditingNom ? (
            <input
              autoFocus
              value={editPlatNomValue}
              onChange={e => setEditPlatNomValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); editPlatNomSubmittedRef.current = true; confirmEditPlatNom(plat.id) }
                if (e.key === 'Escape') { editPlatNomSubmittedRef.current = true; setEditPlatNomId(null) }
              }}
              onBlur={() => {
                if (editPlatNomSubmittedRef.current) { editPlatNomSubmittedRef.current = false; return }
                confirmEditPlatNom(plat.id)
              }}
              className="flex-1 rounded-lg border border-[color:var(--accent)]/50 bg-white/80 px-3 py-1 text-base font-bold ink focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
            />
          ) : (
            <>
              <h3 className="flex-1 text-base font-bold ink truncate">{plat.nom}</h3>
              <button onClick={() => startEditPlatNom(plat)} className="p-1.5 ink-4 hover:accent-text hover:accent-soft-bg rounded-lg transition-colors shrink-0" aria-label="Renommer le plat">
                <Pencil size={14} />
              </button>
            </>
          )}

          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${CAT_COLORS[plat.categorie ?? 'Autres'] ?? 'ink-3'} bg-white/70 border border-white/70`}>
            {plat.categorie ?? 'Autres'}
          </span>
          <button onClick={() => { supprimerPlat(plat.id); setSelectedPlatId(null) }} className="p-1.5 ink-4 hover:text-red-500 hover:bg-red-50/50 rounded-lg transition-colors shrink-0" aria-label={`Supprimer ${plat.nom}`}>
            <Trash2 size={15} />
          </button>
          {showClose && (
            <button onClick={() => setSelectedPlatId(null)} className="p-1.5 ink-4 hover:ink-2 hover:bg-white/60 rounded-lg transition-colors shrink-0" aria-label="Fermer">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="px-4 py-4">
          {renderIngredients(plat)}
        </div>
      </div>
    )
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 anim-in">

      <div className="mb-6">
        <p className="chip mb-1.5">Paramètres</p>
        <h1 className="text-3xl font-extrabold tracking-tight ink capitalize">{activeTab}</h1>
      </div>

      {/* ===== ONGLET PLATS ===== */}
      {activeTab === 'plats' && (
        <div className="md:grid md:grid-cols-[1fr_360px] md:gap-8 md:items-start">
          <div className="space-y-4">
            <section>
              <h2 className="text-xs font-bold ink-3 uppercase tracking-widest mb-3">Ajouter un plat</h2>
              <form onSubmit={handleAjouterPlat} className="flex flex-wrap gap-2">
                <input
                  type="text" value={nomPlat} onChange={e => setNomPlat(e.target.value)}
                  placeholder="Nom du plat (ex: Poulet rôti)"
                  className={`flex-1 min-w-40 ${inputBase}`}
                  required
                />
                <select value={categorieNouveauPlat} onChange={e => setCategorieNouveauPlat(e.target.value)} className={inputBase}>
                  {CATEGORIES_ORDER.map(c => <option key={c} value={c}>{CAT_EMOJIS[c]} {c}</option>)}
                </select>
                <button type="submit" className={btnPrimary}>
                  <Plus size={16} />Ajouter
                </button>
              </form>
            </section>

            <DndContext sensors={sensors} onDragEnd={handlePlatDragEnd}>
              <div className="space-y-1">
                {CATEGORIES_ORDER
                  .filter(cat => cat !== 'Autres' || byCategorie['Autres']?.length > 0)
                  .map(cat => (
                    <DroppableCategorie key={cat} categorie={cat} plats={byCategorie[cat] ?? []} selectedPlatId={selectedPlatId} onSelectPlat={handleSelectPlat} />
                  ))
                }
              </div>
            </DndContext>

            {selectedPlat && (
              <div className="md:hidden mt-2">
                {renderEditPanel(selectedPlat, true)}
              </div>
            )}
          </div>

          <div className="hidden md:block sticky top-20">
            {selectedPlat ? renderEditPanel(selectedPlat) : (
              <div className="flex flex-col items-center justify-center py-24 ink-4 glass sheen">
                <ChevronDown size={36} className="mb-3" />
                <p className="text-sm text-center leading-relaxed ink-3">Cliquez sur un plat<br />pour modifier ses ingrédients</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== ONGLET INGRÉDIENTS ===== */}
      {activeTab === 'ingredients' && (() => {
        const seen = new Map()
        for (const plat of plats) {
          for (const ing of plat.ingredients) {
            const key = ing.nom.toLowerCase()
            if (!seen.has(key)) seen.set(key, ing.nom)
          }
        }
        for (const items of Object.values(espacesLibres)) {
          for (const ing of items) {
            if (!ing.platId) {
              const key = ing.nom.toLowerCase()
              if (!seen.has(key)) seen.set(key, ing.nom)
            }
          }
        }
        for (const nom of standaloneIngredients) {
          const key = nom.toLowerCase()
          if (!seen.has(key)) seen.set(key, nom)
        }

        const query = searchIngredients.toLowerCase().trim()
        const filtered = [...seen.entries()]
          .filter(([key]) => query === '' || key.includes(query))
          .sort(([a], [b]) => a.localeCompare(b, 'fr'))

        const byRayon = {}
        const unassigned = []
        for (const [key, nom] of filtered) {
          const rayon = getRayon(nom)
          if (rayon && rayonsActifs.includes(rayon)) {
            if (!byRayon[rayon]) byRayon[rayon] = []
            byRayon[rayon].push({ key, nom })
          } else {
            unassigned.push({ key, nom })
          }
        }

        const sections = rayonsActifs.map(r => ({ nom: r, ings: byRayon[r] ?? [] }))

        const allIngNames = [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr'))
        const suggestionsDoublons = detecterDoublons(allIngNames)

        return (
          <div className="max-w-2xl">
            {/* Modale de fusion */}
            {showMergeModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 anim-pop">
                <div className="glass-strong sheen w-full max-w-sm p-6 flex flex-col gap-4">
                  <h2 className="text-base font-bold ink flex items-center gap-2">
                    <GitMerge size={18} className="accent-text" />
                    Fusionner des ingrédients
                  </h2>
                  {suggestionsDoublons.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-xs font-semibold ink-3 uppercase tracking-wide">Suggestions</p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestionsDoublons.map(([a, b]) => (
                          <button
                            key={`${a}|${b}`}
                            type="button"
                            onClick={() => { setMergeKeep(a); setMergeRemove(b) }}
                            className="text-xs px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50/70 text-amber-700 hover:bg-amber-100 transition-colors"
                          >
                            {a} ↔ {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-semibold ink-3 uppercase tracking-wide">
                      Ingrédient à conserver (A)
                    </label>
                    <select
                      value={mergeKeep}
                      onChange={e => setMergeKeep(e.target.value)}
                      className={inputBase}
                    >
                      <option value="">— choisir A —</option>
                      {allIngNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <label className="text-xs font-semibold ink-3 uppercase tracking-wide">
                      Doublon à supprimer (B)
                    </label>
                    <select
                      value={mergeRemove}
                      onChange={e => setMergeRemove(e.target.value)}
                      className={inputBase}
                    >
                      <option value="">— choisir B —</option>
                      {allIngNames.filter(n => n !== mergeKeep).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  {mergeKeep && mergeRemove && (
                    <p className="text-xs text-amber-700 bg-amber-50/70 border border-amber-200 rounded-lg px-3 py-2">
                      Toutes les occurrences de <strong>«&nbsp;{mergeRemove}&nbsp;»</strong> dans les recettes seront remplacées par <strong>«&nbsp;{mergeKeep}&nbsp;»</strong>, puis supprimées du catalogue.
                    </p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowMergeModal(false); setMergeKeep(''); setMergeRemove('') }}
                      className="px-4 py-2 rounded-xl text-sm ink-2 hover:bg-white/60 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleFusion}
                      disabled={!mergeKeep || !mergeRemove || mergeKeep === mergeRemove}
                      className="px-4 py-2 rounded-xl accent-bg text-sm font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Valider la fusion
                    </button>
                  </div>
                </div>
              </div>
            )}

            <FastScroll />

            {/* Ajout rapide d'ingrédient */}
            <form onSubmit={handleAjouterIngredientStandalone} className="flex flex-wrap gap-2 mb-4">
              <input
                type="text"
                value={nomNouvelIng}
                onChange={e => setNomNouvelIng(e.target.value)}
                placeholder="Nouvel ingrédient…"
                className={`flex-1 min-w-36 ${inputBase}`}
                required
              />
              <select
                value={rayonNouvelIng}
                onChange={e => setRayonNouvelIng(e.target.value)}
                className={inputBase}
              >
                <option value="">— rayon —</option>
                {rayonsActifs.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs ink-3">Tricount</span>
                <SplitMini value={splitNouvelIng} onChange={setSplitNouvelIng} />
              </div>
              <button
                type="submit"
                className={`${btnPrimary} shrink-0`}
              >
                <Plus size={15} />
                Ajouter
              </button>
            </form>

            {/* Recherche + bouton fusion */}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 ink-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchIngredients}
                  onChange={e => setSearchIngredients(e.target.value)}
                  placeholder="Rechercher un ingrédient…"
                  className={`w-full pl-9 pr-3 ${inputBase}`}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowMergeModal(true)}
                className="flex items-center gap-1.5 rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm ink-2 hover:border-[color:var(--accent)]/40 hover:accent-text transition-colors shrink-0"
                title="Fusionner des doublons"
              >
                <GitMerge size={15} />
                <span className="hidden sm:inline">Fusionner</span>
              </button>
            </div>

            {seen.size === 0 ? (
              <p className="text-sm ink-3 text-center py-8">
                Aucun ingrédient connu. Ajoutez des plats, des ingrédients libres dans le Planning, ou utilisez le formulaire ci-dessus.
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-sm ink-3 text-center py-8">Aucun résultat pour cette recherche.</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                onDragStart={handleIngredientDragStart}
                onDragEnd={handleIngredientDragEnd}
                onDragCancel={() => setActiveIngId(null)}
              >
                <div className="space-y-1">
                  {(unassigned.length > 0 || ingDragging) && (
                    <DroppableSection
                      sectionId="section:__unassigned__"
                      title="Non classés"
                      ings={unassigned}
                      isUnassigned={true}
                      onRenameIngredient={handleRenameIngredient}
                      onDeleteIngredient={handleDeleteIngredient}
                      condensed={ingDragging}
                    />
                  )}
                  {sections.map(({ nom: rayonNom, ings }) => (
                    <DroppableSection
                      key={rayonNom}
                      sectionId={`section:${rayonNom}`}
                      title={rayonNom}
                      ings={ings}
                      isUnassigned={false}
                      onRenameIngredient={handleRenameIngredient}
                      onDeleteIngredient={handleDeleteIngredient}
                      condensed={ingDragging}
                    />
                  ))}
                </div>

                <DragOverlay dropAnimation={null}>
                  {activeIngId && (
                    <div
                      style={{
                        transform: 'scale(1.06) rotate(2deg)',
                        boxShadow: '0 12px 32px -4px rgba(0,0,0,0.25), 0 4px 10px -2px rgba(0,0,0,0.15)',
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border bg-white/90 backdrop-blur border-[color:var(--accent)]/50 ink-2 opacity-95 select-none pointer-events-none"
                    >
                      <span className="truncate max-w-28">{activeIngId}</span>
                      <span className="accent-text shrink-0 ml-0.5"><Pencil size={9} /></span>
                      <span className="text-red-400 shrink-0"><X size={10} /></span>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}

            <p className="text-xs ink-3 mt-4 text-center">
              {seen.size} ingrédient{seen.size > 1 ? 's' : ''} connu{seen.size > 1 ? 's' : ''} · Magasin actif : {magasinActif}
            </p>
          </div>
        )
      })()}

      {/* ===== ONGLET RAYONS ===== */}
      {activeTab === 'rayons' && (
        <div className="md:grid md:grid-cols-[200px_1fr] md:gap-8 md:items-start">
          <section>
            <h2 className="text-xs font-bold ink-3 uppercase tracking-widest mb-3">Magasin</h2>
            <div className="flex gap-2 flex-wrap md:flex-col">
              {magasins.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMagasinActif(m.nom)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm border transition-all ${
                    magasinActif === m.nom
                      ? 'accent-bg border-[color:var(--accent)] shadow-md font-bold'
                      : 'bg-white/60 ink-2 border-white/70 hover:border-[color:var(--accent)]/40 hover:accent-text'
                  }`}
                >
                  <Store size={15} />{m.nom}
                </button>
              ))}
            </div>
          </section>

          {magasinCourant && (
            <section>
              <h2 className="text-xs font-bold ink-3 uppercase tracking-widest mb-3">
                Rayons — <span className="ink normal-case font-bold">{magasinCourant.nom}</span>
              </h2>

              <DndContext sensors={sensors} onDragEnd={handleRayonDragEnd}>
                <div className="glass sheen divide-y divide-white/40 overflow-hidden">
                  {magasinCourant.rayons.map(rayon => (
                    <DraggableRayonRow
                      key={rayon.id} rayon={rayon} magasinCourant={magasinCourant}
                      total={magasinCourant.rayons.length} renommerRayon={renommerRayon} supprimerRayon={supprimerRayon}
                    />
                  ))}
                </div>
              </DndContext>

              <form onSubmit={handleAjouterRayon} className="flex gap-2 mt-4">
                <input
                  type="text" value={nouveauRayon} onChange={e => setNouveauRayon(e.target.value)}
                  placeholder="Nom du nouveau rayon"
                  className={`flex-1 ${inputBase}`}
                  required
                />
                <button type="submit" className={btnPrimary}>
                  <Plus size={16} />Ajouter
                </button>
              </form>
            </section>
          )}
        </div>
      )}

    </main>
  )
}

export default Parametres
