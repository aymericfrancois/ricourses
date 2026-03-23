import { createContext, useContext, useState, useEffect } from 'react'
import { useMagasins } from '../hooks/useMagasins'
import mappingRayons from '../data/mappingRayons.json'

const STORAGE_KEY_ACTIF = 'ricourses_magasin_actif'
const STORAGE_KEY_RAYONS = 'ricourses_rayons_par_magasin'
const STORAGE_KEY_STANDALONE = 'ricourses_ingredients_standalone'
const STORAGE_KEY_SPLITS = 'ricourses_splits'
const STORAGE_KEY_OCR_ALIASES = 'ricourses_ocr_aliases'

function buildInitialRayons(magasins) {
  const initial = {}
  for (const m of magasins) {
    initial[m.nom] = {}
    for (const [nom, rayon] of Object.entries(mappingRayons)) {
      initial[m.nom][nom.toLowerCase()] = rayon
    }
  }
  return initial
}

function loadRayons(magasins) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RAYONS)
    if (raw) {
      const parsed = JSON.parse(raw)
      const initial = buildInitialRayons(magasins)
      const result = { ...parsed }
      for (const m of magasins) {
        if (!result[m.nom]) result[m.nom] = initial[m.nom]
      }
      return result
    }
  } catch {}
  return buildInitialRayons(magasins)
}

function loadMagasinActif(magasins) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIF)
    if (raw && magasins.some(m => m.nom === raw)) return raw
  } catch {}
  return magasins[0]?.nom ?? ''
}

const MagasinContext = createContext(null)

export function MagasinProvider({ children }) {
  const { magasins, moveRayonUp, moveRayonDown, renommerRayon, ajouterRayon, supprimerRayon, reorderRayons } = useMagasins()

  const [magasinActif, setMagasinActifState] = useState(() => loadMagasinActif(magasins))
  const [rayonsParMagasin, setRayonsParMagasin] = useState(() => loadRayons(magasins))
  const [standaloneIngredients, setStandaloneIngredients] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STANDALONE)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  const [splits, setSplitsState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SPLITS)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })

  // ocrAliases: { normalizedArticleName: ingredientName }
  // Ex: { "daddy poudre sachet": "Sucre", "coeur laitue": "Salade" }
  const [ocrAliases, setOcrAliasesState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_OCR_ALIASES)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ACTIF, magasinActif)
  }, [magasinActif])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RAYONS, JSON.stringify(rayonsParMagasin))
  }, [rayonsParMagasin])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_STANDALONE, JSON.stringify(standaloneIngredients))
  }, [standaloneIngredients])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SPLITS, JSON.stringify(splits))
  }, [splits])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_OCR_ALIASES, JSON.stringify(ocrAliases))
  }, [ocrAliases])

  function getOcrAlias(nomArticle) {
    if (!nomArticle) return null
    const key = nomArticle.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
    return ocrAliases[key] ?? null
  }

  function setOcrAlias(nomArticle, nomIngredient) {
    if (!nomArticle || !nomIngredient) return
    const key = nomArticle.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
    setOcrAliasesState(prev => ({ ...prev, [key]: nomIngredient }))
  }

  function getSplit(nomIngredient) {
    if (!nomIngredient) return 'both'
    return splits[nomIngredient.toLowerCase()] ?? 'both'
  }

  function setSplit(nomIngredient, valeur) {
    if (!nomIngredient) return
    setSplitsState(prev => ({ ...prev, [nomIngredient.toLowerCase()]: valeur }))
  }

  function setMagasinActif(nom) {
    setMagasinActifState(nom)
  }

  function getRayon(nomIngredient) {
    if (!nomIngredient || !magasinActif) return ''
    return rayonsParMagasin[magasinActif]?.[nomIngredient.toLowerCase()] ?? ''
  }

  function setRayon(nomIngredient, rayonNom) {
    if (!nomIngredient || !magasinActif) return
    const key = nomIngredient.toLowerCase()
    setRayonsParMagasin(prev => ({
      ...prev,
      [magasinActif]: {
        ...prev[magasinActif],
        [key]: rayonNom,
      },
    }))
  }

  function renommerIngredientDansRayons(ancienNom, nouveauNom) {
    const ancienKey = ancienNom.toLowerCase()
    const nouveauKey = nouveauNom.toLowerCase()
    if (ancienKey === nouveauKey) return
    setRayonsParMagasin(prev => {
      const result = {}
      for (const [magasin, mapping] of Object.entries(prev)) {
        if (mapping[ancienKey] !== undefined) {
          const { [ancienKey]: rayon, ...rest } = mapping
          result[magasin] = { ...rest, [nouveauKey]: rayon }
        } else {
          result[magasin] = mapping
        }
      }
      return result
    })
  }

  function supprimerIngredientDansRayons(nom) {
    const key = nom.toLowerCase()
    setRayonsParMagasin(prev => {
      const result = {}
      for (const [magasin, mapping] of Object.entries(prev)) {
        const { [key]: _, ...rest } = mapping
        result[magasin] = rest
      }
      return result
    })
    setStandaloneIngredients(prev => prev.filter(n => n.toLowerCase() !== key))
  }

  function ajouterIngredientStandalone(nom, rayon) {
    const trimmed = nom.trim()
    if (!trimmed) return
    const key = trimmed.toLowerCase()
    setStandaloneIngredients(prev =>
      prev.some(n => n.toLowerCase() === key) ? prev : [...prev, trimmed]
    )
    if (rayon) {
      setRayonsParMagasin(prev => ({
        ...prev,
        [magasinActif]: { ...prev[magasinActif], [key]: rayon },
      }))
    }
  }

  return (
    <MagasinContext.Provider value={{
      magasins, moveRayonUp, moveRayonDown, renommerRayon, ajouterRayon, supprimerRayon, reorderRayons,
      magasinActif, setMagasinActif,
      rayonsParMagasin, getRayon, setRayon, renommerIngredientDansRayons, supprimerIngredientDansRayons,
      standaloneIngredients, ajouterIngredientStandalone,
      getSplit, setSplit,
      ocrAliases, getOcrAlias, setOcrAlias,
    }}>
      {children}
    </MagasinContext.Provider>
  )
}

export function useMagasinContext() {
  const ctx = useContext(MagasinContext)
  if (!ctx) throw new Error('useMagasinContext must be used within MagasinProvider')
  return ctx
}
