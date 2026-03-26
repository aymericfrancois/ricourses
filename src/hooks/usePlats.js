import { useState, useEffect } from 'react'
import initialPlats from '../data/initialPlats.json'
import { supabase } from '../supabaseClient'

const STORAGE_KEY = 'ricourses_plats'

// Catégories initiales par ID — pour migrer les plats déjà en localStorage sans categorie
const CATEGORIES_INITIALES = {
  '1': 'PÂTES', '2': 'PÂTES', '4': 'PÂTES', '5': 'PÂTES',
  '3': 'Dej', '7': 'Dej', '8': 'Dej', '9': 'Dej', '10': 'Dej',
  '11': 'Dej', '12': 'Dej', '13': 'Dej', '14': 'Dej', '15': 'Dej', '16': 'Dej',
  '17': 'Dîner', '18': 'Dîner', '19': 'Dîner', '20': 'Dîner', '21': 'Dîner',
  '22': 'Dîner', '23': 'Dîner', '24': 'Dîner', '25': 'Dîner', '26': 'Dîner',
  '6': 'Élaborés', '27': 'Élaborés', '28': 'Élaborés', '29': 'Élaborés',
  '30': 'Élaborés', '31': 'Élaborés', '32': 'Élaborés',
  '33': 'Conserves', '34': 'Conserves', '35': 'Conserves',
  '36': 'Conserves', '37': 'Conserves', '38': 'Conserves',
}

function normalize(plats) {
  return plats.map(p => ({
    ...p,
    categorie: p.categorie ?? CATEGORIES_INITIALES[p.id] ?? 'Autres',
  }))
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return normalize(raw ? JSON.parse(raw) : initialPlats)
  } catch {
    return normalize(initialPlats)
  }
}

function save(plats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plats))
}

export function usePlats() {
  const [plats, setPlats] = useState(load)

  useEffect(() => {
    save(plats)
  }, [plats])

  useEffect(() => {
    async function fetchInitialData() {
      const { data, error } = await supabase
        .from('plats')
        .select('*, recette_ingredients(*)')
        .order('nom')

      if (error) {
        console.error('Supabase fetch error:', error)
        return
      }

      const platsMapped = data.map(p => ({
        id: p.id,
        nom: p.nom,
        icone: p.icone,
        categorie: p.categorie,
        ingredients: (p.recette_ingredients ?? [])
          .sort((a, b) => a.position - b.position)
          .map(i => ({
            id: i.id,
            nom: i.nom,
            quantite: Number(i.quantite),
            unite: i.unite,
          })),
      }))

      if (platsMapped.length === 0) return // Supabase vide → garder localStorage
      setPlats(normalize(platsMapped))
    }

    fetchInitialData()
  }, [])

  function ajouterPlat(nom, categorie = 'Autres') {
    const trimmed = nom.trim()
    if (!trimmed) return null
    const id = crypto.randomUUID()
    // 1. Mise à jour locale immédiate (UI optimiste)
    setPlats(prev => [
      ...prev,
      { id, nom: trimmed, icone: 'utensils', ingredients: [], categorie },
    ])
    // 2. Sync Supabase (fire-and-forget)
    supabase
      .from('plats')
      .insert({ id, nom: trimmed, icone: 'utensils', categorie })
      .then(({ error }) => { if (error) console.error('ajouterPlat:', error) })
    return id
  }

  function supprimerPlat(platId) {
    setPlats(prev => prev.filter(p => p.id !== platId))
    supabase.from('plats').delete().eq('id', platId)
      .then(({ error }) => { if (error) console.error('supprimerPlat:', error) })
  }

  function updatePlatIcone(platId, icone) {
    setPlats(prev => prev.map(p => p.id !== platId ? p : { ...p, icone }))
    supabase.from('plats').update({ icone }).eq('id', platId)
      .then(({ error }) => { if (error) console.error('updatePlatIcone:', error) })
  }

  function updatePlatCategorie(platId, categorie) {
    setPlats(prev => prev.map(p => p.id !== platId ? p : { ...p, categorie }))
    supabase.from('plats').update({ categorie }).eq('id', platId)
      .then(({ error }) => { if (error) console.error('updatePlatCategorie:', error) })
  }

  function ajouterIngredient(platId, { nom, quantite, unite }) {
    const trimmed = nom.trim()
    if (!trimmed) return
    const id = crypto.randomUUID()
    const plat = plats.find(p => p.id === platId)
    const position = plat ? plat.ingredients.length : 0
    // 1. Mise à jour locale immédiate (UI optimiste)
    setPlats(prev =>
      prev.map(p =>
        p.id !== platId
          ? p
          : {
              ...p,
              ingredients: [
                ...p.ingredients,
                { id, nom: trimmed, quantite: Number(quantite), unite },
              ],
            }
      )
    )
    // 2. Sync Supabase (fire-and-forget)
    supabase
      .from('recette_ingredients')
      .insert({ id, plat_id: platId, nom: trimmed, quantite: Number(quantite), unite, position })
      .then(({ error }) => { if (error) console.error('ajouterIngredient:', error) })
  }

  function supprimerIngredient(platId, ingredientId) {
    setPlats(prev =>
      prev.map(p =>
        p.id !== platId ? p : { ...p, ingredients: p.ingredients.filter(i => i.id !== ingredientId) }
      )
    )
    supabase.from('recette_ingredients').delete().eq('id', ingredientId)
      .then(({ error }) => { if (error) console.error('supprimerIngredient:', error) })
  }

  function renommerIngredient(ancienNom, nouveauNom) {
    const ancienKey = ancienNom.toLowerCase()
    const trimmed = nouveauNom.trim()
    if (!trimmed) return
    setPlats(prev => prev.map(plat => ({
      ...plat,
      ingredients: plat.ingredients.map(ing =>
        ing.nom.toLowerCase() === ancienKey ? { ...ing, nom: trimmed } : ing
      ),
    })))
    supabase.from('recette_ingredients').update({ nom: trimmed }).ilike('nom', ancienNom)
      .then(({ error }) => { if (error) console.error('renommerIngredient:', error) })
  }

  // Fusionne l'ingrédient B dans A : renomme B→A si A absent, supprime B si A déjà présent
  function fusionnerIngredients(nomSupprimer, nomConserver) {
    const keyS = nomSupprimer.toLowerCase()
    const keyC = nomConserver.toLowerCase()
    setPlats(prev => prev.map(plat => {
      const hasC = plat.ingredients.some(i => i.nom.toLowerCase() === keyC)
      const hasS = plat.ingredients.some(i => i.nom.toLowerCase() === keyS)
      if (!hasS) return plat
      if (hasC) {
        return { ...plat, ingredients: plat.ingredients.filter(i => i.nom.toLowerCase() !== keyS) }
      }
      return { ...plat, ingredients: plat.ingredients.map(i => i.nom.toLowerCase() === keyS ? { ...i, nom: nomConserver } : i) }
    }))
    // Sync Supabase : renommer B→A là où A est absent, supprimer B là où A est déjà présent
    // Étape 1 : supprimer les lignes nomSupprimer dans les plats qui ont déjà nomConserver
    supabase.rpc('fusionner_ingredients', { nom_supprimer: keyS, nom_conserver: keyC })
      .then(({ error }) => {
        if (error) {
          // Fallback si la fonction RPC n'existe pas : rename simple (ignore les doublons)
          supabase.from('recette_ingredients').update({ nom: nomConserver }).ilike('nom', nomSupprimer)
            .then(({ error: e2 }) => { if (e2) console.error('fusionnerIngredients fallback:', e2) })
        }
      })
  }

  function supprimerIngredientDePlats(nom) {
    const key = nom.toLowerCase()
    setPlats(prev => prev.map(plat => ({
      ...plat,
      ingredients: plat.ingredients.filter(i => i.nom.toLowerCase() !== key),
    })))
    supabase.from('recette_ingredients').delete().ilike('nom', nom)
      .then(({ error }) => { if (error) console.error('supprimerIngredientDePlats:', error) })
  }

  function renommerPlat(platId, nouveauNom) {
    const trimmed = nouveauNom.trim()
    if (!trimmed) return
    setPlats(prev => prev.map(p => p.id !== platId ? p : { ...p, nom: trimmed }))
    supabase.from('plats').update({ nom: trimmed }).eq('id', platId)
      .then(({ error }) => { if (error) console.error('renommerPlat:', error) })
  }

  function updateIngredient(platId, ingId, { quantite, unite }) {
    setPlats(prev =>
      prev.map(p =>
        p.id !== platId ? p : {
          ...p,
          ingredients: p.ingredients.map(i =>
            i.id !== ingId ? i : { ...i, quantite: Number(quantite), unite }
          ),
        }
      )
    )
    supabase.from('recette_ingredients').update({ quantite: Number(quantite), unite }).eq('id', ingId)
      .then(({ error }) => { if (error) console.error('updateIngredient:', error) })
  }

  return { plats, ajouterPlat, supprimerPlat, updatePlatIcone, updatePlatCategorie, ajouterIngredient, supprimerIngredient, renommerIngredient, renommerPlat, updateIngredient, supprimerIngredientDePlats, fusionnerIngredients }
}
