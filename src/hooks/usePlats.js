import { useState, useEffect } from 'react'
import initialPlats from '../data/initialPlats.json'

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

  function ajouterPlat(nom, categorie = 'Autres') {
    const trimmed = nom.trim()
    if (!trimmed) return
    setPlats(prev => [
      ...prev,
      { id: crypto.randomUUID(), nom: trimmed, icone: 'utensils', ingredients: [], categorie },
    ])
  }

  function supprimerPlat(platId) {
    setPlats(prev => prev.filter(p => p.id !== platId))
  }

  function updatePlatIcone(platId, icone) {
    setPlats(prev => prev.map(p => p.id !== platId ? p : { ...p, icone }))
  }

  function updatePlatCategorie(platId, categorie) {
    setPlats(prev => prev.map(p => p.id !== platId ? p : { ...p, categorie }))
  }

  function ajouterIngredient(platId, { nom, quantite, unite }) {
    const trimmed = nom.trim()
    if (!trimmed) return
    setPlats(prev =>
      prev.map(p =>
        p.id !== platId
          ? p
          : {
              ...p,
              ingredients: [
                ...p.ingredients,
                {
                  id: crypto.randomUUID(),
                  nom: trimmed,
                  quantite: Number(quantite),
                  unite,
                },
              ],
            }
      )
    )
  }

  function supprimerIngredient(platId, ingredientId) {
    setPlats(prev =>
      prev.map(p =>
        p.id !== platId
          ? p
          : {
              ...p,
              ingredients: p.ingredients.filter(i => i.id !== ingredientId),
            }
      )
    )
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
  }

  function renommerPlat(platId, nouveauNom) {
    const trimmed = nouveauNom.trim()
    if (!trimmed) return
    setPlats(prev => prev.map(p => p.id !== platId ? p : { ...p, nom: trimmed }))
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
  }

  return { plats, ajouterPlat, supprimerPlat, updatePlatIcone, updatePlatCategorie, ajouterIngredient, supprimerIngredient, renommerIngredient, renommerPlat, updateIngredient }
}
