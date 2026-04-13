import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ShoppingCart, Package, GripVertical, Check,
} from 'lucide-react'
import {
  DndContext, DragOverlay, useDroppable, useDraggable,
  useSensor, useSensors, MouseSensor, TouchSensor,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { usePlats } from '../hooks/usePlats'
import { useMagasinContext } from '../context/MagasinContext'
import { usePlanningContext } from '../context/PlanningContext'
import { supabase } from '../supabaseClient'

// ---- Hook état coché (Supabase + Realtime) ----
function useCoursesCoches() {
  const [checkedItems, setCheckedItems] = useState(() => new Set())

  useEffect(() => {
    supabase.from('courses_cochees').select('ingredient_nom')
      .then(({ data, error }) => {
        if (error) { console.error('fetchCoursesCoches:', error); return }
        setCheckedItems(new Set(data.map(r => r.ingredient_nom)))
      })

    const channel = supabase
      .channel('courses_cochees_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses_cochees' }, payload => {
        if (payload.eventType === 'INSERT') {
          setCheckedItems(prev => new Set([...prev, payload.new.ingredient_nom]))
        } else if (payload.eventType === 'DELETE') {
          setCheckedItems(prev => { const s = new Set(prev); s.delete(payload.old.ingredient_nom); return s })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const toggleChecked = useCallback((key) => {
    setCheckedItems(prev => {
      const s = new Set(prev)
      if (s.has(key)) {
        s.delete(key)
        supabase.from('courses_cochees').delete().eq('ingredient_nom', key)
          .then(({ error }) => { if (error) console.error('uncheck:', error) })
      } else {
        s.add(key)
        supabase.from('courses_cochees').insert({ ingredient_nom: key })
          .then(({ error }) => { if (error) console.error('check:', error) })
      }
      return s
    })
  }, [])

  const uncheckAll = useCallback(() => {
    setCheckedItems(new Set())
    supabase.from('courses_cochees').delete().neq('ingredient_nom', '')
      .then(({ error }) => { if (error) console.error('uncheckAll:', error) })
  }, [])

  return { checkedItems, toggleChecked, uncheckAll }
}

const BLOCS_LIBRES = [
  { key: 'petitDejeuner' },
  { key: 'achatsPonctuels' },
  { key: 'alicya' },
]

// ---- Emoji par rayon (basé sur le nom) ----
function emojiPourRayon(nom) {
  const n = nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (n.includes('fruit') || n.includes('legume')) return '🥦'
  if (n.includes('boulang') || n.includes('pain')) return '🥖'
  if (n.includes('viande') || n.includes('boucher') || n.includes('charcut')) return '🥩'
  if (n.includes('poisson') || n.includes('mer')) return '🐟'
  if (n.includes('frais') || n.includes('laitier') || n.includes('fromage') || n.includes('yaourt')) return '🧀'
  if (n.includes('surgel')) return '❄️'
  if (n.includes('boisson') || n.includes('alcool')) return '🥤'
  if (n.includes('conserv')) return '🥫'
  if (n.includes('pat') || n.includes('riz') || n.includes('feculent')) return '🍝'
  if (n.includes('petit') || n.includes('dej') || n.includes('cerea')) return '🥣'
  if (n.includes('aperitif') || n.includes('biscuit') || n.includes('sucr') || n.includes('confiserie')) return '🍪'
  if (n.includes('hygiene') || n.includes('entretien') || n.includes('menag')) return '🧴'
  if (n.includes('epic') || n.includes('condim') || n.includes('sauce')) return '🧂'
  return '📦'
}

function formatQuantite(item) {
  if (item.quantite > 0) {
    return ` (${item.quantite}${item.unite ? ' ' + item.unite : ''})`
  }
  return item.unite ? ` (${item.unite})` : ''
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

// ---- Page Liste de courses ----
function ShoppingList() {
  const { plats } = usePlats()
  const { magasins, magasinActif, getRayon, setRayon } = useMagasinContext()
  const { semaine, espacesLibres } = usePlanningContext()

  const { checkedItems, toggleChecked, uncheckAll } = useCoursesCoches()
  const [activeItem, setActiveItem] = useState(null)
  const [toast, setToast] = useState('')

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  function toggleChecked(key) {
    setCheckedItems(prev => {
      const s = new Set(prev)
      s.has(key) ? s.delete(key) : s.add(key)
      return s
    })
  }

  function handleDragStart({ active }) {
    setActiveItem(active.data.current)
  }

  function handleDragEnd({ active, over }) {
    setActiveItem(null)
    if (!over) return
    const ingNom = active.id.replace(/^ing:/, '')
    if (over.id.startsWith('rayon:')) {
      const newRayon = over.id.slice(6)
      setRayon(ingNom, newRayon)
    }
  }

  // ---- Calcul liste de courses ----
  const magasinCourant = magasins.find(m => m.nom === magasinActif)
  const rayonsOrdonnes = magasinCourant?.rayons.map(r => r.nom) ?? []

  const { grouped, orphelins, totalIngredients } = useMemo(() => {
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

    return { grouped, orphelins, totalIngredients: Object.values(ingredientsMap).length }
  }, [semaine, espacesLibres, plats, getRayon, rayonsOrdonnes])

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Liste de courses
            {totalIngredients > 0 && <span className="ml-2 text-gray-300 font-normal normal-case">({totalIngredients} ingr.)</span>}
          </h2>
        </div>
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm shadow-lg animate-in fade-in">
            {toast}
          </div>
        )}
        {totalIngredients > 0 && (
          <p className="text-[10px] text-gray-400 mb-4">Glissez un ingrédient vers un rayon pour le reclasser.</p>
        )}

        {rayonsOrdonnes.length === 0 || totalIngredients === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-300 bg-white rounded-xl shadow-sm border border-gray-100">
            <ShoppingCart size={40} className="mb-3" />
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
      </main>
    </div>
  )
}

export default ShoppingList
