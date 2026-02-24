import { useState, useEffect } from 'react'
import initialPlats from '../data/initialPlats.json'

const STORAGE_KEY = 'ricourses_plats'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : initialPlats
  } catch {
    return initialPlats
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

  function ajouterPlat(nom) {
    const trimmed = nom.trim()
    if (!trimmed) return
    setPlats(prev => [
      ...prev,
      { id: crypto.randomUUID(), nom: trimmed, icone: 'utensils', ingredients: [] },
    ])
  }

  function supprimerPlat(platId) {
    setPlats(prev => prev.filter(p => p.id !== platId))
  }

  function updatePlatIcone(platId, icone) {
    setPlats(prev => prev.map(p => p.id !== platId ? p : { ...p, icone }))
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

  function updateIngredientRayon(platId, ingredientId, rayon) {
    setPlats(prev =>
      prev.map(p =>
        p.id !== platId
          ? p
          : {
              ...p,
              ingredients: p.ingredients.map(i =>
                i.id !== ingredientId ? i : { ...i, rayon }
              ),
            }
      )
    )
  }

  return { plats, ajouterPlat, supprimerPlat, updatePlatIcone, ajouterIngredient, supprimerIngredient, updateIngredientRayon }
}
