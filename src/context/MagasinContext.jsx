import { createContext, useContext, useState, useEffect } from 'react'
import { useMagasins } from '../hooks/useMagasins'
import mappingRayons from '../data/mappingRayons.json'

const STORAGE_KEY_ACTIF = 'ricourses_magasin_actif'
const STORAGE_KEY_RAYONS = 'ricourses_rayons_par_magasin'

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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ACTIF, magasinActif)
  }, [magasinActif])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RAYONS, JSON.stringify(rayonsParMagasin))
  }, [rayonsParMagasin])

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
  }

  return (
    <MagasinContext.Provider value={{
      magasins, moveRayonUp, moveRayonDown, renommerRayon, ajouterRayon, supprimerRayon, reorderRayons,
      magasinActif, setMagasinActif,
      rayonsParMagasin, getRayon, setRayon, renommerIngredientDansRayons, supprimerIngredientDansRayons,
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
