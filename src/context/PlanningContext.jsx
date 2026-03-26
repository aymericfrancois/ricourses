import { createContext, useContext, useReducer, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

const STORAGE_KEY = 'ricourses_planning'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const emptyDelta = () => ({ excluded: [], overrides: {}, extras: [] })

function buildInitialState() {
  return {
    semaine: JOURS.map(jour => ({
      jour,
      midi: null, midiDelta: emptyDelta(),
      soir: null, soirDelta: emptyDelta(),
    })),
    espacesLibres: {
      petitDejeuner: [],
      achatsPonctuels: [],
      alicya: [],
    },
  }
}

function normalizeSemaine(semaine) {
  return semaine.map(j => ({
    ...j,
    midiDelta: j.midiDelta ?? emptyDelta(),
    soirDelta: j.soirDelta ?? emptyDelta(),
  }))
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      parsed.semaine = normalizeSemaine(parsed.semaine)
      return parsed
    }
  } catch {}
  return buildInitialState()
}

function updateDelta(state, jourIdx, repas, updater) {
  const deltaKey = `${repas}Delta`
  return {
    ...state,
    semaine: state.semaine.map((j, i) => {
      if (i !== jourIdx) return j
      return { ...j, [deltaKey]: updater(j[deltaKey] ?? emptyDelta()) }
    }),
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { semaine: action.semaine, espacesLibres: action.espacesLibres }
    case 'SET_MIDI': {
      return {
        ...state,
        semaine: state.semaine.map((j, i) =>
          i === action.jourIdx
            ? { ...j, midi: action.platId, midiDelta: emptyDelta() }
            : j
        ),
      }
    }
    case 'SET_SOIR': {
      return {
        ...state,
        semaine: state.semaine.map((j, i) =>
          i === action.jourIdx
            ? { ...j, soir: action.platId, soirDelta: emptyDelta() }
            : j
        ),
      }
    }
    case 'AJOUTER_INGREDIENT_LIBRE': {
      const bloc = action.bloc
      return {
        ...state,
        espacesLibres: {
          ...state.espacesLibres,
          [bloc]: [
            ...state.espacesLibres[bloc],
            {
              id: action.id, // généré dans le wrapper
              nom: action.nom.trim(),
              quantite: Number(action.quantite),
              unite: action.unite,
              ...(action.platId ? { platId: action.platId } : {}),
            },
          ],
        },
      }
    }
    case 'SUPPRIMER_INGREDIENT_LIBRE': {
      const bloc = action.bloc
      return {
        ...state,
        espacesLibres: {
          ...state.espacesLibres,
          [bloc]: state.espacesLibres[bloc].filter(i => i.id !== action.id),
        },
      }
    }
    case 'UPDATE_INGREDIENT_LIBRE': {
      const bloc = action.bloc
      return {
        ...state,
        espacesLibres: {
          ...state.espacesLibres,
          [bloc]: state.espacesLibres[bloc].map(i =>
            i.id === action.id
              ? { ...i, quantite: Number(action.quantite), unite: action.unite }
              : i
          ),
        },
      }
    }
    case 'TOGGLE_EXCLU': {
      return updateDelta(state, action.jourIdx, action.repas, delta => {
        const excluded = delta.excluded.includes(action.ingId)
          ? delta.excluded.filter(id => id !== action.ingId)
          : [...delta.excluded, action.ingId]
        return { ...delta, excluded }
      })
    }
    case 'SET_OVERRIDE': {
      return updateDelta(state, action.jourIdx, action.repas, delta => ({
        ...delta,
        overrides: {
          ...delta.overrides,
          [action.ingId]: { quantite: action.quantite, unite: action.unite },
        },
      }))
    }
    case 'ADD_EXTRA': {
      return updateDelta(state, action.jourIdx, action.repas, delta => ({
        ...delta,
        extras: [
          ...delta.extras,
          {
            id: action.id, // généré dans le wrapper
            nom: action.nom.trim(),
            quantite: Number(action.quantite),
            unite: action.unite,
          },
        ],
      }))
    }
    case 'REMOVE_EXTRA': {
      return updateDelta(state, action.jourIdx, action.repas, delta => ({
        ...delta,
        extras: delta.extras.filter(e => e.id !== action.extraId),
      }))
    }
    case 'RESET':
      return buildInitialState()
    default:
      return state
  }
}

const PlanningContext = createContext(null)

export function PlanningProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, load)

  // Refs pour les IDs Supabase — ne déclenchent pas de re-render
  const planningIdRef = useRef(null)
  const jourIdsRef = useRef({}) // { 'Lundi': uuid, 'Mardi': uuid, ... }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  // ---- Fetch / init planning depuis Supabase ----
  useEffect(() => {
    async function fetchOrInitPlanning() {
      // 1. Récupérer ou créer la ligne planning
      let { data: planningRows, error } = await supabase
        .from('planning')
        .select('id')
        .limit(1)

      if (error) { console.error('fetchPlanning:', error); return }

      let planningId
      if (!planningRows || planningRows.length === 0) {
        const { data: created, error: createError } = await supabase
          .from('planning')
          .insert({})
          .select('id')
          .single()
        if (createError) { console.error('createPlanning:', createError); return }
        planningId = created.id
      } else {
        planningId = planningRows[0].id
      }
      planningIdRef.current = planningId

      // 2. Récupérer les jours avec leurs deltas
      const { data: jours, error: joursError } = await supabase
        .from('planning_jours')
        .select(`
          id, jour, position, midi_plat_id, soir_plat_id,
          repas_delta_excluded ( repas, ingredient_id ),
          repas_delta_overrides ( repas, ingredient_id, quantite, unite ),
          repas_delta_extras ( id, repas, nom, quantite, unite )
        `)
        .eq('planning_id', planningId)
        .order('position')

      if (joursError) { console.error('fetchJours:', joursError); return }

      // 3. Si pas de jours, les créer (première utilisation Supabase)
      if (!jours || jours.length === 0) {
        const jourRows = JOURS.map((jour, i) => ({
          id: crypto.randomUUID(),
          planning_id: planningId,
          jour,
          position: i,
          midi_plat_id: null,
          soir_plat_id: null,
        }))
        const { error: insertError } = await supabase.from('planning_jours').insert(jourRows)
        if (insertError) { console.error('createJours:', insertError); return }
        jourIdsRef.current = Object.fromEntries(JOURS.map((j, i) => [j, jourRows[i].id]))
        return // Garder l'état localStorage, juste enregistrer les IDs
      }

      // 4. Peupler jourIdsRef
      jourIdsRef.current = Object.fromEntries(jours.map(j => [j.jour, j.id]))

      // 5. Construire la semaine depuis Supabase
      const semaine = JOURS.map(jourNom => {
        const j = jours.find(x => x.jour === jourNom)
        if (!j) return state.semaine.find(s => s.jour === jourNom) ?? { jour: jourNom, midi: null, midiDelta: emptyDelta(), soir: null, soirDelta: emptyDelta() }

        return {
          jour: j.jour,
          midi: j.midi_plat_id,
          midiDelta: {
            excluded: j.repas_delta_excluded.filter(e => e.repas === 'midi').map(e => e.ingredient_id),
            overrides: Object.fromEntries(
              j.repas_delta_overrides.filter(o => o.repas === 'midi').map(o => [o.ingredient_id, { quantite: Number(o.quantite), unite: o.unite }])
            ),
            extras: j.repas_delta_extras.filter(e => e.repas === 'midi').map(e => ({ id: e.id, nom: e.nom, quantite: Number(e.quantite), unite: e.unite })),
          },
          soir: j.soir_plat_id,
          soirDelta: {
            excluded: j.repas_delta_excluded.filter(e => e.repas === 'soir').map(e => e.ingredient_id),
            overrides: Object.fromEntries(
              j.repas_delta_overrides.filter(o => o.repas === 'soir').map(o => [o.ingredient_id, { quantite: Number(o.quantite), unite: o.unite }])
            ),
            extras: j.repas_delta_extras.filter(e => e.repas === 'soir').map(e => ({ id: e.id, nom: e.nom, quantite: Number(e.quantite), unite: e.unite })),
          },
        }
      })

      // 6. Récupérer les espaces libres
      const { data: libres, error: libresError } = await supabase
        .from('espaces_libres')
        .select('id, bloc, nom, quantite, unite, plat_id, position')
        .eq('planning_id', planningId)
        .order('position')

      if (libresError) { console.error('fetchLibres:', libresError); return }

      const mapLibre = l => ({
        id: l.id,
        nom: l.nom,
        quantite: Number(l.quantite),
        unite: l.unite,
        platId: l.plat_id ?? null,
      })

      const espacesLibres = {
        petitDejeuner: (libres ?? []).filter(l => l.bloc === 'petitDejeuner').map(mapLibre),
        achatsPonctuels: (libres ?? []).filter(l => l.bloc === 'achatsPonctuels').map(mapLibre),
        alicya: (libres ?? []).filter(l => l.bloc === 'alicya').map(mapLibre),
      }

      dispatch({ type: 'HYDRATE', semaine, espacesLibres })
    }

    fetchOrInitPlanning()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Wrappers avec sync Supabase ----

  function setMidi(jourIdx, platId) {
    dispatch({ type: 'SET_MIDI', jourIdx, platId: platId || null })
    const jourId = jourIdsRef.current[state.semaine[jourIdx].jour]
    if (jourId) {
      supabase.from('planning_jours').update({ midi_plat_id: platId || null }).eq('id', jourId)
        .then(({ error }) => { if (error) console.error('setMidi:', error) })
      supabase.from('repas_delta_excluded').delete().eq('jour_id', jourId).eq('repas', 'midi')
        .then(({ error }) => { if (error) console.error('setMidi clear excluded:', error) })
      supabase.from('repas_delta_overrides').delete().eq('jour_id', jourId).eq('repas', 'midi')
        .then(({ error }) => { if (error) console.error('setMidi clear overrides:', error) })
      supabase.from('repas_delta_extras').delete().eq('jour_id', jourId).eq('repas', 'midi')
        .then(({ error }) => { if (error) console.error('setMidi clear extras:', error) })
    }
  }

  function setSoir(jourIdx, platId) {
    dispatch({ type: 'SET_SOIR', jourIdx, platId: platId || null })
    const jourId = jourIdsRef.current[state.semaine[jourIdx].jour]
    if (jourId) {
      supabase.from('planning_jours').update({ soir_plat_id: platId || null }).eq('id', jourId)
        .then(({ error }) => { if (error) console.error('setSoir:', error) })
      supabase.from('repas_delta_excluded').delete().eq('jour_id', jourId).eq('repas', 'soir')
        .then(({ error }) => { if (error) console.error('setSoir clear excluded:', error) })
      supabase.from('repas_delta_overrides').delete().eq('jour_id', jourId).eq('repas', 'soir')
        .then(({ error }) => { if (error) console.error('setSoir clear overrides:', error) })
      supabase.from('repas_delta_extras').delete().eq('jour_id', jourId).eq('repas', 'soir')
        .then(({ error }) => { if (error) console.error('setSoir clear extras:', error) })
    }
  }

  function ajouterIngredientLibre(bloc, { nom, quantite, unite, platId }) {
    if (!nom.trim()) return
    const id = crypto.randomUUID()
    dispatch({ type: 'AJOUTER_INGREDIENT_LIBRE', bloc, nom, quantite, unite, platId: platId ?? null, id })
    if (planningIdRef.current) {
      supabase.from('espaces_libres').insert({
        id,
        planning_id: planningIdRef.current,
        bloc,
        nom: nom.trim(),
        quantite: Number(quantite) || 0,
        unite,
        plat_id: platId ?? null,
        position: state.espacesLibres[bloc].length,
      }).then(({ error }) => { if (error) console.error('ajouterIngredientLibre:', error) })
    }
  }

  function supprimerIngredientLibre(bloc, id) {
    dispatch({ type: 'SUPPRIMER_INGREDIENT_LIBRE', bloc, id })
    supabase.from('espaces_libres').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('supprimerIngredientLibre:', error) })
  }

  function updateIngredientLibre(bloc, id, quantite, unite) {
    dispatch({ type: 'UPDATE_INGREDIENT_LIBRE', bloc, id, quantite, unite })
    supabase.from('espaces_libres').update({ quantite: Number(quantite) || 0, unite }).eq('id', id)
      .then(({ error }) => { if (error) console.error('updateIngredientLibre:', error) })
  }

  function toggleExclu(jourIdx, repas, ingId) {
    const jour = state.semaine[jourIdx]
    const deltaKey = `${repas}Delta`
    const isCurrentlyExcluded = (jour[deltaKey]?.excluded ?? []).includes(ingId)
    dispatch({ type: 'TOGGLE_EXCLU', jourIdx, repas, ingId })
    const jourId = jourIdsRef.current[jour.jour]
    if (jourId) {
      if (isCurrentlyExcluded) {
        supabase.from('repas_delta_excluded').delete()
          .eq('jour_id', jourId).eq('repas', repas).eq('ingredient_id', ingId)
          .then(({ error }) => { if (error) console.error('toggleExclu delete:', error) })
      } else {
        supabase.from('repas_delta_excluded')
          .insert({ jour_id: jourId, repas, ingredient_id: ingId })
          .then(({ error }) => { if (error) console.error('toggleExclu insert:', error) })
      }
    }
  }

  function setOverride(jourIdx, repas, ingId, quantite, unite) {
    dispatch({ type: 'SET_OVERRIDE', jourIdx, repas, ingId, quantite, unite })
    const jourId = jourIdsRef.current[state.semaine[jourIdx].jour]
    if (jourId) {
      supabase.from('repas_delta_overrides')
        .upsert(
          { jour_id: jourId, repas, ingredient_id: ingId, quantite: Number(quantite), unite },
          { onConflict: 'jour_id,repas,ingredient_id' }
        )
        .then(({ error }) => { if (error) console.error('setOverride:', error) })
    }
  }

  function addExtra(jourIdx, repas, { nom, quantite, unite }) {
    if (!nom.trim()) return
    const id = crypto.randomUUID()
    dispatch({ type: 'ADD_EXTRA', jourIdx, repas, nom, quantite, unite, id })
    const jourId = jourIdsRef.current[state.semaine[jourIdx].jour]
    if (jourId) {
      supabase.from('repas_delta_extras')
        .insert({ id, jour_id: jourId, repas, nom: nom.trim(), quantite: Number(quantite) || 0, unite })
        .then(({ error }) => { if (error) console.error('addExtra:', error) })
    }
  }

  function removeExtra(jourIdx, repas, extraId) {
    dispatch({ type: 'REMOVE_EXTRA', jourIdx, repas, extraId })
    supabase.from('repas_delta_extras').delete().eq('id', extraId)
      .then(({ error }) => { if (error) console.error('removeExtra:', error) })
  }

  function resetPlanning() {
    dispatch({ type: 'RESET' })
    if (planningIdRef.current) {
      supabase.from('espaces_libres').delete().eq('planning_id', planningIdRef.current)
        .then(({ error }) => { if (error) console.error('resetPlanning libres:', error) })
      Object.values(jourIdsRef.current).forEach(jourId => {
        supabase.from('repas_delta_excluded').delete().eq('jour_id', jourId).then()
        supabase.from('repas_delta_overrides').delete().eq('jour_id', jourId).then()
        supabase.from('repas_delta_extras').delete().eq('jour_id', jourId).then()
        supabase.from('planning_jours').update({ midi_plat_id: null, soir_plat_id: null }).eq('id', jourId).then()
      })
    }
  }

  return (
    <PlanningContext.Provider value={{
      semaine: state.semaine,
      espacesLibres: state.espacesLibres,
      setMidi, setSoir,
      ajouterIngredientLibre, supprimerIngredientLibre, updateIngredientLibre,
      toggleExclu, setOverride, addExtra, removeExtra,
      resetPlanning,
    }}>
      {children}
    </PlanningContext.Provider>
  )
}

export function usePlanningContext() {
  const ctx = useContext(PlanningContext)
  if (!ctx) throw new Error('usePlanningContext must be used within PlanningProvider')
  return ctx
}
