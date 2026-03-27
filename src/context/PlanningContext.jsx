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

// ---- Semaine type ----
const DEFAULT_PLATS = [
  { nom: 'Salade Piémontaise',       categorie: 'Dej',      ingredients: [{ nom: 'Salade Piémontaise', quantite: 1, unite: '' }] },
  { nom: 'Tofu Riz Haricots verts',  categorie: 'Dîner',    ingredients: [{ nom: 'Tofu', quantite: 1, unite: '' }, { nom: 'Riz', quantite: 70, unite: 'g' }, { nom: 'Haricots verts', quantite: 1, unite: '' }] },
  { nom: 'Taboulé',                  categorie: 'Dej',      ingredients: [{ nom: 'Taboulé', quantite: 1, unite: '' }, { nom: 'Mayonnaise', quantite: 1, unite: '' }] },
  { nom: 'Colin Blé Epinards',       categorie: 'Dîner',    ingredients: [{ nom: 'Colin pané', quantite: 1, unite: '' }, { nom: 'Blé', quantite: 70, unite: 'g' }, { nom: 'Epinards', quantite: 1, unite: '' }] },
  { nom: 'Salade de pâtes',          categorie: 'Dej',      ingredients: [{ nom: 'Thon', quantite: 1, unite: '' }, { nom: 'Pâtes complètes', quantite: 200, unite: 'g' }, { nom: 'Tomates', quantite: 1, unite: '' }, { nom: 'Mozzarella', quantite: 1, unite: '' }, { nom: 'Maïs', quantite: 1, unite: '' }, { nom: 'Mayonnaise', quantite: 1, unite: '' }] },
  { nom: 'Spaghetti Carbo',          categorie: 'PÂTES',    ingredients: [{ nom: 'Lardons', quantite: 200, unite: 'g' }, { nom: 'Spaghetti', quantite: 250, unite: 'g' }, { nom: 'Crème fraîche', quantite: 20, unite: 'cL' }, { nom: 'Parmesan', quantite: 1, unite: '' }] },
  { nom: 'Salade croquante',         categorie: 'Dej',      ingredients: [{ nom: 'Quinoa', quantite: 1, unite: '' }, { nom: 'Betteraves', quantite: 1, unite: '' }, { nom: 'Carottes', quantite: 1, unite: '' }, { nom: 'Jambon de dinde', quantite: 2, unite: '' }, { nom: 'Yaourt 0%', quantite: 1, unite: '' }] },
  { nom: 'Lentilles riz oeufs',      categorie: 'Dîner',    ingredients: [{ nom: 'Lentilles', quantite: 1, unite: '' }, { nom: 'Riz', quantite: 70, unite: 'g' }, { nom: 'Oeufs', quantite: 2, unite: '' }] },
  { nom: 'Knackis gnocchis légumes', categorie: 'Dîner',    ingredients: [{ nom: 'Knackis', quantite: 6, unite: '' }, { nom: 'Gnocchis', quantite: 1, unite: '' }] },
  { nom: 'Raviolis conserve',        categorie: 'Conserves',ingredients: [{ nom: 'Raviolis', quantite: 1, unite: '' }] },
  { nom: 'Wraps VG',                 categorie: 'Dîner',    ingredients: [{ nom: 'Haricots rouges', quantite: 1, unite: '' }, { nom: 'Wraps', quantite: 3, unite: '' }, { nom: 'Tomates', quantite: 1, unite: '' }, { nom: 'Concombre', quantite: 0.5, unite: '' }, { nom: 'Poivron', quantite: 0.5, unite: '' }, { nom: 'Crème fraîche', quantite: 1, unite: '' }, { nom: 'Gruyère rapé', quantite: 1, unite: '' }] },
  { nom: 'Poêlée',                   categorie: 'Dîner',    ingredients: [{ nom: 'Poêlée', quantite: 1, unite: '' }] },
]

const DEFAULT_WEEK = [
  { midi: 'Salade Piémontaise',        soir: 'Tofu Riz Haricots verts' },
  { midi: 'Taboulé',                   soir: 'Colin Blé Epinards' },
  { midi: 'Salade de pâtes',           soir: 'Spaghetti Carbo' },
  { midi: 'Salade croquante',          soir: 'Lentilles riz oeufs' },
  { midi: 'Knackis gnocchis légumes',  soir: 'Raviolis conserve' },
  { midi: 'Wraps VG',                  soir: null },
  { midi: 'Wraps VG',                  soir: 'Poêlée' },
]

const DEFAULT_ESPACES = {
  petitDejeuner: [
    { nom: 'Oeufs',            quantite: 14,  unite: '' },
    { nom: 'Multifruits',      quantite: 1,   unite: '' },
    { nom: 'Céréales',         quantite: 1,   unite: '' },
    { nom: 'Lait',             quantite: 2,   unite: '' },
    { nom: 'Yaourt grec Acco', quantite: 1,   unite: '' },
    { nom: 'Yaourt Grec',      quantite: 1,   unite: '' },
  ],
  alicya: [
    { nom: 'Fromage 0%',        quantite: 2,   unite: '' },
    { nom: 'Poulet',            quantite: 2,   unite: '' },
    { nom: 'Courgettes',        quantite: 2.2, unite: 'kg' },
    { nom: 'Riz thaï',          quantite: 1,   unite: '' },
    { nom: "Flocons d'avoine",  quantite: 1,   unite: '' },
    { nom: 'Bonbons',           quantite: 1,   unite: '' },
    { nom: 'Cotons',            quantite: 1,   unite: '' },
    { nom: 'Coton',             quantite: 1,   unite: '' },
    { nom: 'Sirop',             quantite: 1,   unite: '' },
  ],
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

  async function syncPlanningToSupabase(newSemaine, newEspacesLibres) {
    if (!planningIdRef.current) return
    await supabase.from('espaces_libres').delete().eq('planning_id', planningIdRef.current)
    for (const jourId of Object.values(jourIdsRef.current)) {
      await supabase.from('repas_delta_excluded').delete().eq('jour_id', jourId)
      await supabase.from('repas_delta_overrides').delete().eq('jour_id', jourId)
      await supabase.from('repas_delta_extras').delete().eq('jour_id', jourId)
    }
    for (let idx = 0; idx < JOURS.length; idx++) {
      const jourId = jourIdsRef.current[JOURS[idx]]
      if (jourId) {
        supabase.from('planning_jours')
          .update({ midi_plat_id: newSemaine[idx].midi, soir_plat_id: newSemaine[idx].soir })
          .eq('id', jourId)
          .then(({ error }) => { if (error) console.error('syncPlanning jour:', error) })
      }
    }
    const libresRows = []
    for (const [bloc, items] of Object.entries(newEspacesLibres)) {
      items.forEach((item, i) => libresRows.push({
        id: item.id,
        planning_id: planningIdRef.current,
        bloc,
        nom: item.nom,
        quantite: item.quantite,
        unite: item.unite,
        plat_id: item.platId ?? null,
        position: i,
      }))
    }
    if (libresRows.length > 0) {
      supabase.from('espaces_libres').insert(libresRows)
        .then(({ error }) => { if (error) console.error('syncPlanning espaces:', error) })
    }
  }

  async function saveCurrentWeekAsDefault() {
    const template = {
      semaine: state.semaine.map(j => ({ jour: j.jour, midi: j.midi ?? null, soir: j.soir ?? null })),
      espacesLibres: {
        petitDejeuner: state.espacesLibres.petitDejeuner.map(({ nom, quantite, unite, platId }) => ({ nom, quantite, unite, platId: platId ?? null })),
        achatsPonctuels: state.espacesLibres.achatsPonctuels.map(({ nom, quantite, unite, platId }) => ({ nom, quantite, unite, platId: platId ?? null })),
        alicya: state.espacesLibres.alicya.map(({ nom, quantite, unite, platId }) => ({ nom, quantite, unite, platId: platId ?? null })),
      },
    }
    const { error } = await supabase
      .from('parametres')
      .upsert({ cle: 'semaine_type', valeur: template, updated_at: new Date().toISOString() }, { onConflict: 'cle' })
    if (error) console.error('saveCurrentWeekAsDefault:', error)
    return !error
  }

  async function injectDefaultWeek(platsList, ajouterPlatFn, ajouterIngredientFn) {
    let newSemaine, newEspacesLibres

    // 1. Chercher le modèle personnalisé dans Supabase
    const { data } = await supabase
      .from('parametres')
      .select('valeur')
      .eq('cle', 'semaine_type')
      .maybeSingle()

    if (data) {
      // Modèle personnalisé trouvé — les IDs sont déjà des UUIDs valides
      const t = data.valeur
      newSemaine = t.semaine.map(j => ({
        jour: j.jour,
        midi: j.midi ?? null,
        midiDelta: emptyDelta(),
        soir: j.soir ?? null,
        soirDelta: emptyDelta(),
      }))
      newEspacesLibres = {
        petitDejeuner: (t.espacesLibres?.petitDejeuner ?? []).map(item => ({ ...item, id: crypto.randomUUID() })),
        achatsPonctuels: (t.espacesLibres?.achatsPonctuels ?? []).map(item => ({ ...item, id: crypto.randomUUID() })),
        alicya: (t.espacesLibres?.alicya ?? []).map(item => ({ ...item, id: crypto.randomUUID() })),
      }
    } else {
      // Fallback sur le modèle codé en dur
      const platIdByNom = {}
      for (const defaultPlat of DEFAULT_PLATS) {
        const existing = platsList.find(p => p.nom.toLowerCase() === defaultPlat.nom.toLowerCase())
        if (existing) {
          platIdByNom[defaultPlat.nom] = existing.id
        } else {
          const newId = ajouterPlatFn(defaultPlat.nom, defaultPlat.categorie)
          platIdByNom[defaultPlat.nom] = newId
          for (const ing of defaultPlat.ingredients) ajouterIngredientFn(newId, ing)
        }
      }
      newSemaine = JOURS.map((jour, idx) => {
        const { midi, soir } = DEFAULT_WEEK[idx]
        return {
          jour,
          midi: midi ? (platIdByNom[midi] ?? null) : null,
          midiDelta: emptyDelta(),
          soir: soir ? (platIdByNom[soir] ?? null) : null,
          soirDelta: emptyDelta(),
        }
      })
      newEspacesLibres = {
        petitDejeuner: DEFAULT_ESPACES.petitDejeuner.map(item => ({ ...item, id: crypto.randomUUID() })),
        achatsPonctuels: [],
        alicya: DEFAULT_ESPACES.alicya.map(item => ({ ...item, id: crypto.randomUUID() })),
      }
    }

    // 2. Appliquer + sync
    dispatch({ type: 'HYDRATE', semaine: newSemaine, espacesLibres: newEspacesLibres })
    await syncPlanningToSupabase(newSemaine, newEspacesLibres)
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
      resetPlanning, injectDefaultWeek, saveCurrentWeekAsDefault,
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
