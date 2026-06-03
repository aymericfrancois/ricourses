import { createContext, useContext, useState, useEffect } from 'react'
import { useMagasins } from '../hooks/useMagasins'
import mappingRayons from '../data/mappingRayons.json'
import { supabase } from '../supabaseClient'
import { prixNormalise } from '../utils/prix'

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
  const { magasins, moveRayonUp, moveRayonDown, renommerRayon: renommerRayonBase, ajouterRayon, supprimerRayon, reorderRayons } = useMagasins()

  // Wrapper qui cascade le rename vers ingredient_rayons (rayon_nom est stocké en TEXT, pas en FK)
  function renommerRayon(magasinId, rayonId, nouveauNom) {
    const trimmed = nouveauNom.trim()
    if (!trimmed) return
    const magasin = magasins.find(m => m.id === magasinId)
    const ancienNom = magasin?.rayons.find(r => r.id === rayonId)?.nom
    if (!ancienNom || ancienNom === trimmed) {
      renommerRayonBase(magasinId, rayonId, trimmed)
      return
    }

    // 1. Renomme dans la table rayons + state local des magasins
    renommerRayonBase(magasinId, rayonId, trimmed)

    // 2. Met à jour les mappings locaux : tout ingrédient pointant vers ancienNom passe à trimmed
    if (magasin) {
      setRayonsParMagasin(prev => {
        const mapping = prev[magasin.nom]
        if (!mapping) return prev
        const next = {}
        for (const [ingNom, rayonNom] of Object.entries(mapping)) {
          next[ingNom] = rayonNom === ancienNom ? trimmed : rayonNom
        }
        return { ...prev, [magasin.nom]: next }
      })
    }

    // 3. Cascade Supabase : ingredient_rayons.rayon_nom = trimmed pour ce magasin
    if (UUID_REGEX.test(magasinId)) {
      supabase.from('ingredient_rayons')
        .update({ rayon_nom: trimmed })
        .eq('magasin_id', magasinId)
        .eq('rayon_nom', ancienNom)
        .then(({ error }) => { if (error) console.error('renommerRayon cascade:', error) })
    }
  }

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

  // { [ingredient_nom_lowercase]: [{split, created_at}, ...] } trié du + récent au + ancien
  const [scannerHistorique, setScannerHistorique] = useState({})

  // { [magasin_nom]: { [ingredient_nom_lowercase]: [obs, ...] } } trié created_at DESC
  const [prixObservations, setPrixObservations] = useState({})

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

  // ---- Fetch Supabase : scanner_historique ----
  useEffect(() => {
    async function fetchHistorique() {
      const { data, error } = await supabase
        .from('scanner_historique')
        .select('ingredient_nom, split_choisi, created_at')
        .order('created_at', { ascending: false })

      if (error) { console.error('fetchHistorique:', error); return }
      if (data.length === 0) return

      const index = {}
      for (const row of data) {
        const key = row.ingredient_nom
        if (!index[key]) index[key] = []
        index[key].push({ split: row.split_choisi, created_at: row.created_at })
      }
      setScannerHistorique(index)
    }
    fetchHistorique()
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

  // ---- Historique Scanner ----

  function getHistoriqueSplits(nomIngredient) {
    if (!nomIngredient) return null
    const votes = scannerHistorique[nomIngredient.toLowerCase()]
    if (!votes || votes.length < 2) return null
    const counts = { me: 0, both: 0, ali: 0 }
    for (const v of votes) counts[v.split] = (counts[v.split] || 0) + 1
    const max = Math.max(...Object.values(counts))
    const candidats = Object.entries(counts).filter(([, c]) => c === max).map(([s]) => s)
    if (candidats.length === 1) return candidats[0]
    // Départage par le plus récent (votes déjà triés desc)
    for (const v of votes) {
      if (candidats.includes(v.split)) return v.split
    }
    return null
  }

  async function enregistrerHistorique(entries) {
    const valides = entries.filter(e => e.ingredient_nom && e.split_choisi)
    if (valides.length === 0) return

    const now = new Date().toISOString()
    setScannerHistorique(prev => {
      const next = { ...prev }
      for (const { ingredient_nom, split_choisi } of valides) {
        const key = ingredient_nom.toLowerCase()
        next[key] = [{ split: split_choisi, created_at: now }, ...(next[key] || [])]
      }
      return next
    })

    for (const { ingredient_nom, split_choisi } of valides) {
      setSplit(ingredient_nom, split_choisi)
    }

    const rows = valides.map(({ ingredient_nom, split_choisi }) => ({
      ingredient_nom: ingredient_nom.toLowerCase(),
      split_choisi,
    }))
    const { error } = await supabase.from('scanner_historique').insert(rows)
    if (error) console.error('enregistrerHistorique:', error)
  }

  // ---- Fetch Supabase : prix_observations ----
  useEffect(() => {
    async function fetchPrix() {
      const { data, error } = await supabase
        .from('prix_observations')
        .select('magasin_id, ingredient_nom, prix, quantite, unite, prix_normalise, famille, created_at, magasins!magasin_id(nom)')
        .order('created_at', { ascending: false })

      if (error) { console.error('fetchPrix:', error); return }
      if (!data || data.length === 0) return

      const index = {}
      for (const row of data) {
        const magasinNom = row.magasins?.nom
        if (!magasinNom) continue
        const key = row.ingredient_nom.toLowerCase()
        if (!index[magasinNom]) index[magasinNom] = {}
        if (!index[magasinNom][key]) index[magasinNom][key] = []
        index[magasinNom][key].push({
          prix: row.prix,
          quantite: row.quantite,
          unite: row.unite,
          prix_normalise: row.prix_normalise,
          famille: row.famille,
          created_at: row.created_at,
        })
      }
      setPrixObservations(index)
    }
    fetchPrix()
  }, [])

  // ---- Accesseurs prix ----
  function getDernierePrixObs(magasinNom, ingredientNom) {
    if (!magasinNom || !ingredientNom) return null
    const obs = prixObservations[magasinNom]?.[ingredientNom.toLowerCase()]
    return obs?.[0] ?? null
  }

  function getHistoriquePrix(magasinNom, ingredientNom) {
    if (!magasinNom || !ingredientNom) return []
    return prixObservations[magasinNom]?.[ingredientNom.toLowerCase()] ?? []
  }

  async function enregistrerPrix(observations) {
    const magasin = magasins.find(m => m.nom === magasinActif)
    if (!magasin || !UUID_REGEX.test(magasin.id)) return

    const now = new Date().toISOString()
    const rows = observations
      .filter(o => o.ingredient_nom && o.prix != null)
      .map(o => {
        const norm = prixNormalise(o.prixBase ?? o.prix, o.quantite, o.unite)
        return {
          magasin_id: magasin.id,
          ingredient_nom: o.ingredient_nom.toLowerCase(),
          prix: o.prixBase ?? o.prix,
          quantite: o.quantite ?? null,
          unite: o.unite ?? null,
          prix_normalise: norm?.prixNorm ?? null,
          famille: norm?.famille ?? null,
          source: 'scanner',
        }
      })

    if (rows.length === 0) return

    // Mise à jour optimiste
    setPrixObservations(prev => {
      const next = { ...prev }
      if (!next[magasinActif]) next[magasinActif] = {}
      const store = { ...next[magasinActif] }
      for (const row of rows) {
        const key = row.ingredient_nom
        const obs = { prix: row.prix, quantite: row.quantite, unite: row.unite, prix_normalise: row.prix_normalise, famille: row.famille, created_at: now }
        store[key] = [obs, ...(store[key] ?? [])]
      }
      next[magasinActif] = store
      return next
    })

    const { error } = await supabase.from('prix_observations').insert(rows)
    if (error) console.error('enregistrerPrix:', error)
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

    // Capturer les valeurs AVANT la mise à jour locale (pour le sync Supabase)
    const migrations = []
    for (const m of magasins) {
      const rayonNom = rayonsParMagasin[m.nom]?.[ancienKey]
      if (rayonNom !== undefined && UUID_REGEX.test(m.id)) {
        migrations.push({ magasinId: m.id, rayonNom })
      }
    }

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

    // UPSERT du nouveau nom, puis DELETE de l'ancien — évite tout conflit UNIQUE
    for (const { magasinId, rayonNom } of migrations) {
      supabase.from('ingredient_rayons')
        .upsert({ magasin_id: magasinId, ingredient_nom: nouveauKey, rayon_nom: rayonNom }, { onConflict: 'magasin_id,ingredient_nom' })
        .then(({ error }) => {
          if (error) { console.error('renommerIngredientDansRayons upsert:', error); return }
          supabase.from('ingredient_rayons').delete()
            .eq('magasin_id', magasinId).eq('ingredient_nom', ancienKey)
            .then(({ error: e }) => { if (e) console.error('renommerIngredientDansRayons delete:', e) })
        })
    }

    // Renommer dans standaloneIngredients (non couvert par usePlats)
    const nouveauNomTrimmed = nouveauNom.trim()
    setStandaloneIngredients(prev =>
      prev.map(n => n.toLowerCase() === ancienKey ? nouveauNomTrimmed : n)
    )
    supabase.from('ingredients_standalone')
      .update({ nom: nouveauNomTrimmed })
      .ilike('nom', ancienNom)
      .then(({ error }) => { if (error) console.error('renommerIngredientDansRayons standalone:', error) })

    // Migrer la clé dans splits (le défaut Tricount suit le renommage)
    setSplitsState(prev => {
      if (!(ancienKey in prev)) return prev
      const { [ancienKey]: val, ...rest } = prev
      return { ...rest, [nouveauKey]: val }
    })
    if (ancienKey in splits) {
      supabase.from('ingredient_splits')
        .upsert({ ingredient_nom: nouveauKey, split: splits[ancienKey] }, { onConflict: 'ingredient_nom' })
        .then(({ error }) => {
          if (error) { console.error('renommerIngredientDansRayons splits upsert:', error); return }
          supabase.from('ingredient_splits').delete().eq('ingredient_nom', ancienKey)
            .then(({ error: e }) => { if (e) console.error('renommerIngredientDansRayons splits delete:', e) })
        })
    }
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
      getSplit, setSplit, getHistoriqueSplits, enregistrerHistorique,
      ocrAliases, getOcrAlias, setOcrAlias,
      prixObservations, getDernierePrixObs, getHistoriquePrix, enregistrerPrix,
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
