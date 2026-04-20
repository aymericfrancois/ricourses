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

const inputBase =
  'rounded-xl border border-white/70 bg-white/60 px-3 py-1.5 text-sm ink placeholder:text-[color:var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40'
const inputXs =
  'rounded-lg border border-white/70 bg-white/70 px-1.5 py-0.5 text-xs ink placeholder:text-[color:var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40'
const selectXs =
  'rounded-lg border border-white/70 bg-white/70 px-1 py-0.5 text-xs ink focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40'

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
        className={`w-full rounded-lg border bg-white/70 px-2 py-1.5 text-xs ink focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 ${value ? 'border-[color:var(--accent)]/40 pr-6' : 'border-white/70'}`}
      />
      {value && (
        <button
          onMouseDown={e => { e.preventDefault(); onChange(null); setQuery(''); setOpen(false) }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 ink-4 hover:ink-3 transition-colors"
        >
          <X size={12} />
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 top-full left-0 right-0 glass-strong sheen max-h-48 overflow-y-auto mt-1 p-1 anim-pop">
          {filtered.map(p => (
            <li
              key={p.id}
              onMouseDown={e => { e.preventDefault(); onChange(p.id); setQuery(''); setOpen(false) }}
              className={`px-3 py-2 text-xs cursor-pointer rounded-lg transition-colors ${value === p.id ? 'accent-soft-bg accent-text font-semibold' : 'ink-2 hover:bg-white/60'}`}
            >
              {p.nom}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query.trim() && (
        <div className="absolute z-30 top-full left-0 right-0 glass-strong sheen mt-1 p-1 anim-pop">
          <button
            onMouseDown={e => {
              e.preventDefault()
              const id = onCreatePlat(query.trim())
              if (id) { onChange(id); setQuery(''); setOpen(false) }
            }}
            className="w-full px-3 py-2 text-xs text-left accent-text font-semibold rounded-lg hover:accent-soft-bg transition-colors flex items-center gap-1.5"
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
        className={`w-full ${inputBase}`}
        required
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 top-full left-0 right-0 glass-strong sheen max-h-40 overflow-y-auto mt-1 p-1 anim-pop">
          {filtered.map(nom => (
            <li
              key={nom}
              onMouseDown={e => { e.preventDefault(); onChange(nom); setQuery(''); setOpen(false) }}
              className={`px-3 py-2 text-sm cursor-pointer rounded-lg transition-colors ${value === nom ? 'accent-soft-bg accent-text font-semibold' : 'ink-2 hover:bg-white/60'}`}
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
    <div className="mt-2 glass-sm overflow-hidden text-xs">
      <div className="divide-y divide-white/40">
        {plat.ingredients.map(ing => {
          const exclu = delta.excluded.includes(ing.id)
          const qte = delta.overrides[ing.id]?.quantite ?? ing.quantite
          const unite = delta.overrides[ing.id]?.unite ?? ing.unite
          return (
            <div key={ing.id} className={`flex items-center gap-2 px-3 py-1.5 ${exclu ? 'opacity-50' : ''}`}>
              <button
                type="button"
                onClick={() => onToggleExclu(ing.id)}
                className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${exclu ? 'border-[color:var(--ink-4)] bg-white/50' : 'border-[color:var(--accent)]/40 accent-soft-bg hover:border-red-300'}`}
              >
                {!exclu && <Check size={9} className="accent-text" />}
              </button>
              <span className={`flex-1 min-w-0 font-semibold ink-2 truncate ${exclu ? 'line-through ink-4' : ''}`}>
                {ing.nom}
              </span>
              {!exclu && (
                <>
                  <input
                    type="number" min="0" step="any"
                    value={qte}
                    onChange={e => onSetOverride(ing.id, e.target.value, unite)}
                    className={`w-14 ${inputXs} text-right`}
                  />
                  <select
                    value={unite}
                    onChange={e => onSetOverride(ing.id, qte, e.target.value)}
                    className={selectXs}
                  >
                    {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </>
              )}
              <button type="button" onClick={() => onToggleExclu(ing.id)} className={`shrink-0 transition-colors ${exclu ? 'ink-3 hover:accent-text' : 'ink-4 hover:text-red-400'}`}>
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>

      {delta.extras.length > 0 && (
        <div className="border-t border-dashed border-white/50">
          <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-bold ink-3 uppercase tracking-widest">Ajoutés pour ce repas</p>
          {delta.extras.map(extra => (
            <div key={extra.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="flex-1 font-semibold accent-text truncate">{extra.nom}</span>
              <span className="ink-3 tabular-nums mono text-[11px]">{extra.quantite > 0 ? `${extra.quantite} ${extra.unite}` : extra.unite}</span>
              <button type="button" onClick={() => onRemoveExtra(extra.id)} className="ink-4 hover:text-red-400 transition-colors shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAddExtra} className="border-t border-white/40 px-3 py-2 flex flex-wrap gap-1.5 items-center">
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
          className={`w-14 ${inputXs}`}
        />
        <select
          value={formExtra.unite}
          onChange={e => setFormExtra(f => ({ ...f, unite: e.target.value }))}
          className={selectXs}
        >
          {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button type="submit" className="flex items-center gap-1 accent-bg rounded-lg px-2 py-1 text-xs font-semibold hover:brightness-110 transition-all">
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
          className={`mt-1 flex items-center gap-1 text-[10px] font-semibold transition-colors ${isModified ? 'text-orange-500 hover:text-orange-600' : 'ink-3 hover:ink-2'}`}
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
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 anim-in">

      <div>
        <p className="chip mb-1.5">Planification</p>
        <h1 className="text-3xl font-extrabold tracking-tight ink">Planning</h1>
      </div>

      {/* La Semaine */}
      <section>
        <h2 className="text-xs font-bold ink-3 uppercase tracking-widest mb-3">La Semaine</h2>
        <div className="glass sheen divide-y divide-white/40">
          {semaine.map((jour, idx) => (
            <div key={jour.jour} className="flex items-start gap-2 px-4 py-2.5">
              <span className="w-24 text-sm font-bold ink shrink-0 pt-1.5">{jour.jour}</span>
              <div className="flex flex-1 gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold ink-3 uppercase tracking-wide block mb-0.5">Midi</label>
                  <PlatCombobox value={jour.midi} onChange={platId => setMidi(idx, platId)} plats={plats} onCreatePlat={ajouterPlat} />
                  {renderSlotToggle(jour, idx, 'midi')}
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold ink-3 uppercase tracking-wide block mb-0.5">Soir</label>
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
        <h2 className="text-xs font-bold ink-3 uppercase tracking-widest mb-3">Les Espaces Libres</h2>
        <div className="space-y-4">
          {BLOCS_LIBRES.map(({ key, label }) => (
            <div key={key} className="glass sheen">
              <div className="px-4 py-3 border-b border-white/40">
                <h3 className="text-sm font-bold ink">{label}</h3>
              </div>
              <div className="px-4 py-3 space-y-2">
                {espacesLibres[key].length > 0 ? (
                  <ul className="space-y-1.5">
                    {espacesLibres[key].map(ing => (
                      <li key={ing.id} className="flex items-center gap-2 text-sm glass-sm px-3 py-1.5">
                        <span className="flex-1 font-semibold ink truncate min-w-0">{ing.nom}</span>
                        <input
                          type="number" min="0" step="any"
                          value={ing.quantite}
                          onChange={e => updateIngredientLibre(key, ing.id, e.target.value, ing.unite)}
                          className={`w-14 ${inputXs} text-right`}
                        />
                        <select
                          value={ing.unite}
                          onChange={e => updateIngredientLibre(key, ing.id, ing.quantite, e.target.value)}
                          className={selectXs}
                        >
                          {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <button
                          onClick={() => supprimerIngredientLibre(key, ing.id)}
                          className="ink-4 hover:text-red-500 transition-colors shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs ink-3 italic">Aucun ingrédient ajouté.</p>
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
                    className={`w-24 ${inputBase}`}
                  />
                  {formsLibres[key].quantite && (
                    <select
                      value={formsLibres[key].unite}
                      onChange={e => setFormLibre(key, 'unite', e.target.value)}
                      className="rounded-xl border border-white/70 bg-white/60 px-2 py-1.5 text-sm ink focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
                    >
                      {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  )}
                  <button type="submit" className="flex items-center gap-1 accent-bg rounded-xl px-3 py-1.5 text-sm font-semibold hover:brightness-110 active:scale-95 transition-all">
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
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${saved ? 'accent-soft-bg accent-text border border-[color:var(--accent)]/20' : 'border border-white/70 bg-white/50 ink-2 hover:bg-white/80 hover:ink'}`}
        >
          {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          {saved ? 'Modèle sauvegardé !' : 'Sauvegarder comme modèle'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {confirmInject ? (
          <>
            <span className="text-sm ink-2">Attention, cela va écraser la semaine en cours.</span>
            <button
              onClick={() => { injectDefaultWeek(plats, ajouterPlat, ajouterIngredient); setConfirmInject(false); setOpenSlots({}) }}
              className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
            >
              Confirmer
            </button>
            <button onClick={() => setConfirmInject(false)} className="px-3 py-1.5 rounded-xl border border-white/70 bg-white/50 ink-2 text-sm hover:bg-white/80 transition-colors">Annuler</button>
          </>
        ) : (
          <button
            onClick={() => { setConfirmReset(false); setConfirmInject(true) }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
          >
            <RotateCcw size={14} />Semaine type
          </button>
        )}

        {!confirmInject && (
          confirmReset ? (
            <>
              <span className="text-sm ink-2">Tout effacer ?</span>
              <button onClick={handleReset} className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">Confirmer</button>
              <button onClick={() => setConfirmReset(false)} className="px-3 py-1.5 rounded-xl border border-white/70 bg-white/50 ink-2 text-sm hover:bg-white/80 transition-colors">Annuler</button>
            </>
          ) : (
            <button onClick={handleReset} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/70 bg-white/50 ink-2 text-sm hover:bg-white/80 hover:ink transition-colors">
              <RotateCcw size={14} />Réinitialiser le planning
            </button>
          )
        )}
      </div>

    </main>
  )
}

export default Planning
