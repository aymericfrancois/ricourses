import { createContext, useContext, useState, useEffect } from 'react'
import { useMagasins } from '../hooks/useMagasins'
import mappingRayons from '../data/mappingRayons.json'
import { supabase } from '../supabaseClient'

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  const [ocrAliases, setOcrAliasesState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_OCR_ALIASES)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })

  // ---- Persist localStorage ----
  useEffect(() => { localStorage.setItem(STORAGE_KEY_ACTIF, magasinActif) }, [magasinActif])
  useEffect(() => { localStorage.setItem(STORAGE_KEY_RAYONS, JSON.stringify(rayonsParMagasin)) }, [rayonsParMagasin])
  useEffect(() => { localStorage.setItem(STORAGE_KEY_STANDALONE, JSON.stringify(standaloneIngredients)) }, [standaloneIngredients])
  useEffect(() => { localStorage.setItem(STORAGE_KEY_SPLITS, JSON.stringify(splits)) }, [splits])
  useEffect(() => { localStorage.setItem(STORAGE_KEY_OCR_ALIASES, JSON.stringify(ocrAliases)) }, [ocrAliases])

  // ---- Fetch Supabase : ingredient_rayons ----
  useEffect(() => {
    async function fetchRayons() {
      const { data, error } = await supabase
        .from('ingredient_rayons')
        .select('ingredient_nom, rayon_nom, magasins!magasin_id(nom)')

      if (error) { console.error('fetchRayons:', error); return }
      if (data.length === 0) return

      const mapped = {}
      for (const row of data) {
        const magasinNom = row.magasins?.nom
        if (!magasinNom) continue
        if (!mapped[magasinNom]) mapped[magasinNom] = {}
        mapped[magasinNom][row.ingredient_nom] = row.rayon_nom
      }
      setRayonsParMagasin(mapped)
    }
    fetchRayons()
  }, [])

  // ---- Fetch Supabase : ingredient_splits ----
  useEffect(() => {
    async function fetchSplits() {
      const { data, error } = await supabase
        .from('ingredient_splits')
        .select('ingredient_nom, split')

      if (error) { console.error('fetchSplits:', error); return }
      if (data.length === 0) return

      setSplitsState(Object.fromEntries(data.map(r => [r.ingredient_nom, r.split])))
    }
    fetchSplits()
  }, [])

  // ---- Fetch Supabase : ocr_aliases ----
  useEffect(() => {
    async function fetchOcrAliases() {
      const { data, error } = await supabase
        .from('ocr_aliases')
        .select('article_nom_normalise, ingredient_nom')

      if (error) { console.error('fetchOcrAliases:', error); return }
      if (data.length === 0) return

      setOcrAliasesState(Object.fromEntries(data.map(r => [r.article_nom_normalise, r.ingredient_nom])))
    }
    fetchOcrAliases()
  }, [])

  // ---- Fetch Supabase : ingredients_standalone ----
  useEffect(() => {
    async function fetchStandalone() {
      const { data, error } = await supabase
        .from('ingredients_standalone')
        .select('nom')

      if (error) { console.error('fetchStandalone:', error); return }
      if (data.length === 0) return

      setStandaloneIngredients(data.map(r => r.nom))
    }
    fetchStandalone()
  }, [])

  // ---- Accesseurs OCR ----
  function normaliserArticle(nomArticle) {
    return nomArticle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function getOcrAlias(nomArticle) {
    if (!nomArticle) return null
    return ocrAliases[normaliserArticle(nomArticle)] ?? null
  }

  function setOcrAlias(nomArticle, nomIngredient) {
    if (!nomArticle || !nomIngredient) return
    const key = normaliserArticle(nomArticle)
    setOcrAliasesState(prev => ({ ...prev, [key]: nomIngredient }))
    supabase.from('ocr_aliases')
      .upsert({ article_nom_normalise: key, ingredient_nom: nomIngredient }, { onConflict: 'article_nom_normalise' })
      .then(({ error }) => { if (error) console.error('setOcrAlias:', error) })
  }

  // ---- Splits Tricount ----
  function getSplit(nomIngredient) {
    if (!nomIngredient) return 'both'
    return splits[nomIngredient.toLowerCase()] ?? 'both'
  }

  function setSplit(nomIngredient, valeur) {
    if (!nomIngredient) return
    const key = nomIngredient.toLowerCase()
    setSplitsState(prev => ({ ...prev, [key]: valeur }))
    supabase.from('ingredient_splits')
      .upsert({ ingredient_nom: key, split: valeur }, { onConflict: 'ingredient_nom' })
      .then(({ error }) => { if (error) console.error('setSplit:', error) })
  }

  // ---- Magasin actif ----
  function setMagasinActif(nom) {
    setMagasinActifState(nom)
  }

  // ---- Rayons par ingrédient ----
  function getRayon(nomIngredient) {
    if (!nomIngredient || !magasinActif) return ''
    return rayonsParMagasin[magasinActif]?.[nomIngredient.toLowerCase()] ?? ''
  }

  function setRayon(nomIngredient, rayonNom) {
    if (!nomIngredient || !magasinActif) return
    const key = nomIngredient.toLowerCase()
    setRayonsParMagasin(prev => ({
      ...prev,
      [magasinActif]: { ...prev[magasinActif], [key]: rayonNom },
    }))
    const magasin = magasins.find(m => m.nom === magasinActif)
    if (magasin && UUID_REGEX.test(magasin.id)) {
      supabase.from('ingredient_rayons')
        .upsert({ magasin_id: magasin.id, ingredient_nom: key, rayon_nom: rayonNom }, { onConflict: 'magasin_id,ingredient_nom' })
        .then(({ error }) => { if (error) console.error('setRayon:', error) })
    }
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
    supabase.from('ingredient_rayons')
      .update({ ingredient_nom: nouveauKey })
      .eq('ingredient_nom', ancienKey)
      .then(({ error }) => { if (error) console.error('renommerIngredientDansRayons:', error) })
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
    supabase.from('ingredient_rayons').delete().eq('ingredient_nom', key)
      .then(({ error }) => { if (error) console.error('supprimerIngredientDansRayons rayons:', error) })
    supabase.from('ingredients_standalone').delete().ilike('nom', nom)
      .then(({ error }) => { if (error) console.error('supprimerIngredientDansRayons standalone:', error) })
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
    supabase.from('ingredients_standalone')
      .upsert({ nom: trimmed }, { onConflict: 'nom' })
      .then(({ error }) => { if (error) console.error('ajouterIngredientStandalone:', error) })
    if (rayon) {
      const magasin = magasins.find(m => m.nom === magasinActif)
      if (magasin && UUID_REGEX.test(magasin.id)) {
        supabase.from('ingredient_rayons')
          .upsert({ magasin_id: magasin.id, ingredient_nom: key, rayon_nom: rayon }, { onConflict: 'magasin_id,ingredient_nom' })
          .then(({ error }) => { if (error) console.error('ajouterIngredientStandalone rayon:', error) })
      }
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
