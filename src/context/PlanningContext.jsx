import { createContext, useContext, useReducer, useEffect } from 'react'

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
              id: crypto.randomUUID(),
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
            id: crypto.randomUUID(),
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  function setMidi(jourIdx, platId) {
    dispatch({ type: 'SET_MIDI', jourIdx, platId: platId || null })
  }
  function setSoir(jourIdx, platId) {
    dispatch({ type: 'SET_SOIR', jourIdx, platId: platId || null })
  }
  function ajouterIngredientLibre(bloc, { nom, quantite, unite, platId }) {
    if (!nom.trim()) return
    dispatch({ type: 'AJOUTER_INGREDIENT_LIBRE', bloc, nom, quantite, unite, platId: platId ?? null })
  }
  function supprimerIngredientLibre(bloc, id) {
    dispatch({ type: 'SUPPRIMER_INGREDIENT_LIBRE', bloc, id })
  }
  function updateIngredientLibre(bloc, id, quantite, unite) {
    dispatch({ type: 'UPDATE_INGREDIENT_LIBRE', bloc, id, quantite, unite })
  }
  function toggleExclu(jourIdx, repas, ingId) {
    dispatch({ type: 'TOGGLE_EXCLU', jourIdx, repas, ingId })
  }
  function setOverride(jourIdx, repas, ingId, quantite, unite) {
    dispatch({ type: 'SET_OVERRIDE', jourIdx, repas, ingId, quantite, unite })
  }
  function addExtra(jourIdx, repas, { nom, quantite, unite }) {
    if (!nom.trim()) return
    dispatch({ type: 'ADD_EXTRA', jourIdx, repas, nom, quantite, unite })
  }
  function removeExtra(jourIdx, repas, extraId) {
    dispatch({ type: 'REMOVE_EXTRA', jourIdx, repas, extraId })
  }
  function resetPlanning() {
    dispatch({ type: 'RESET' })
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
