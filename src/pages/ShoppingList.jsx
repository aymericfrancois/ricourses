import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ShoppingCart, Package, GripVertical, Check, Share2,
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
      className={`flex items-center gap-2 px-3 py-2.5 select-none transition-all hover:bg-white/40 ${isChecked ? 'opacity-50' : ''} ${isDragging ? 'opacity-20' : ''}`}
    >
      <span
        {...listeners}
        {...attributes}
        className="touch-none cursor-grab active:cursor-grabbing ink-4 hover:ink-3 shrink-0"
      >
        <GripVertical size={14} />
      </span>
      <span
        onClick={onToggle}
        className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors cursor-pointer ${isChecked ? 'border-[color:var(--accent)] accent-bg' : borderColor}`}
      >
        {isChecked && <Check size={10} className="text-white" />}
      </span>
      <span
        onClick={onToggle}
        className={`flex-1 text-sm font-semibold transition-colors cursor-pointer ${isChecked ? 'line-through ink-4' : 'ink'}`}
      >
        {item.nom}
      </span>
      <span className={`text-sm tabular-nums mono transition-colors ${isChecked ? 'ink-4' : 'ink-3'}`}>
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

  return (
    <section ref={setNodeRef} className={`rounded-2xl transition-all ${isOver ? 'ring-2 ring-[color:var(--accent)]/50 ring-offset-1' : ''}`}>
      <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2 ${isOver ? 'accent-text' : isEmpty ? 'ink-4' : 'ink-3'}`}>
        {isOrphan && <Package size={13} />}
        {label}
        <span className="font-normal normal-case opacity-60">({items.length})</span>
        {isOver && <span className="accent-text font-normal normal-case text-[10px]">← déposer ici</span>}
      </h3>
      {isEmpty ? (
        <div className={`rounded-xl border-2 border-dashed px-4 py-3 text-center text-xs italic transition-colors ${isOver ? 'border-[color:var(--accent)]/60 accent-text accent-soft-bg' : 'border-white/70 ink-4'}`}>
          Aucun ingrédient
        </div>
      ) : (
        <ul className={`glass sheen divide-y divide-white/40 transition-colors ${isOver ? 'ring-1 ring-[color:var(--accent)]/40' : ''} ${isOrphan ? 'border border-orange-200/70' : ''}`}>
          {sorted.map(item => (
            <DraggableIngredient
              key={item.nom}
              item={item}
              isChecked={checkedItems.has(item.nom.toLowerCase())}
              onToggle={() => onToggleChecked(item.nom.toLowerCase())}
              borderColor={isOrphan ? 'border-orange-300' : 'border-[color:var(--ink-4)]'}
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

  const { checkedItems, toggleChecked } = useCoursesCoches()
  const [activeItem, setActiveItem] = useState(null)
  const [toast, setToast] = useState('')

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

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

  function buildListeText() {
    const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const lines = [`🛒 Liste de courses - ${date}`, '']

    for (const rayonNom of rayonsOrdonnes) {
      const items = (grouped[rayonNom] ?? []).filter(item => !checkedItems.has(item.nom.toLowerCase()))
      if (items.length === 0) continue
      lines.push(`${emojiPourRayon(rayonNom)} ${rayonNom.toUpperCase()}`)
      const sorted = [...items].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
      for (const item of sorted) {
        lines.push(`- [ ] ${item.nom}${formatQuantite(item)}`)
      }
      lines.push('')
    }

    const orphelinsRestants = orphelins.filter(item => !checkedItems.has(item.nom.toLowerCase()))
    if (orphelinsRestants.length > 0) {
      lines.push('📦 AUTRES')
      const sorted = [...orphelinsRestants].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
      for (const item of sorted) {
        lines.push(`- [ ] ${item.nom}${formatQuantite(item)}`)
      }
    }

    return lines.join('\n').trimEnd()
  }

  async function handleShare() {
    const text = buildListeText()
    if (text.split('\n').length <= 2) {
      setToast('Rien à partager')
      setTimeout(() => setToast(''), 2000)
      return
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Liste de courses', text })
      } catch (e) {
        if (e.name !== 'AbortError') console.error('share:', e)
      }
    } else if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        setToast('Liste copiée !')
        setTimeout(() => setToast(''), 2000)
      } catch (e) {
        console.error('clipboard:', e)
        setToast('Erreur de copie')
        setTimeout(() => setToast(''), 2000)
      }
    }
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

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 anim-in">

      <div className="mb-3">
        <p className="chip mb-1.5">Courses</p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight ink">
            Liste de courses
            {totalIngredients > 0 && <span className="ml-2 ink-4 font-normal text-base">({totalIngredients})</span>}
          </h1>
          {totalIngredients > 0 && (
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl accent-bg text-xs font-semibold hover:brightness-110 active:scale-95 transition-all shrink-0"
            >
              <Share2 size={13} />
              Partager
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[color:var(--ink)] text-white text-sm shadow-lg anim-pop">
          {toast}
        </div>
      )}

      {totalIngredients > 0 && (
        <p className="text-[10px] ink-3 mb-4">Glissez un ingrédient vers un rayon pour le reclasser.</p>
      )}

      {totalIngredients === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 ink-4 glass sheen">
          <ShoppingCart size={40} className="mb-3" />
          <p className="text-sm text-center leading-relaxed ink-3">Sélectionnez des plats<br />ou ajoutez des ingrédients libres.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="space-y-4">
            {orphelins.length > 0 && (
              <DroppableRayon
                rayonId=""
                label="📦 Non classés"
                items={orphelins}
                checkedItems={checkedItems}
                onToggleChecked={toggleChecked}
                isOrphan
              />
            )}

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
              <p className="text-xs ink-3 text-center">
                Glissez un ingrédient « non classé » vers un rayon pour l&apos;assigner à <span className="font-semibold ink-2">{magasinActif}</span>.
              </p>
            )}
          </div>

          <DragOverlay>
            {activeItem && (
              <div className="flex items-center gap-3 px-4 py-2.5 glass-strong sheen text-sm pointer-events-none">
                <GripVertical size={14} className="ink-3 shrink-0" />
                <span className="font-semibold ink flex-1">{activeItem.nom}</span>
                <span className="ink-3 tabular-nums mono">
                  {activeItem.quantite > 0 ? `${activeItem.quantite} ${activeItem.unite}` : activeItem.unite}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </main>
  )
}

export default ShoppingList
