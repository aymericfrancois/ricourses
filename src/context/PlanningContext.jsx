import { createContext, useContext, useReducer, useEffect } from 'react'

const STORAGE_KEY = 'ricourses_planning'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

function buildInitialState() {
  return {
    semaine: JOURS.map(jour => ({ jour, midi: null, soir: null })),
    espacesLibres: {
      petitDejeuner: [],
      achatsPonctuels: [],
      alicya: [],
    },
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return buildInitialState()
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_MIDI': {
      const semaine = state.semaine.map((j, i) =>
        i === action.jourIdx ? { ...j, midi: action.platId } : j
      )
      return { ...state, semaine }
    }
    case 'SET_SOIR': {
      const semaine = state.semaine.map((j, i) =>
        i === action.jourIdx ? { ...j, soir: action.platId } : j
      )
      return { ...state, semaine }
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

  function ajouterIngredientLibre(bloc, { nom, quantite, unite }) {
    if (!nom.trim()) return
    dispatch({ type: 'AJOUTER_INGREDIENT_LIBRE', bloc, nom, quantite, unite })
  }

  function supprimerIngredientLibre(bloc, id) {
    dispatch({ type: 'SUPPRIMER_INGREDIENT_LIBRE', bloc, id })
  }

  function resetPlanning() {
    dispatch({ type: 'RESET' })
  }

  return (
    <PlanningContext.Provider value={{
      semaine: state.semaine,
      espacesLibres: state.espacesLibres,
      setMidi,
      setSoir,
      ajouterIngredientLibre,
      supprimerIngredientLibre,
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
