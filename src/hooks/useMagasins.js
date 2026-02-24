import { useState, useEffect } from 'react'
import initialMagasins from '../data/initialMagasins.json'

const STORAGE_KEY = 'ricourses_magasins'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : initialMagasins
  } catch {
    return initialMagasins
  }
}

function save(magasins) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(magasins))
}

export function useMagasins() {
  const [magasins, setMagasins] = useState(load)

  useEffect(() => {
    save(magasins)
  }, [magasins])

  function moveRayonUp(magasinId, rayonIdx) {
    if (rayonIdx === 0) return
    setMagasins(prev =>
      prev.map(m => {
        if (m.id !== magasinId) return m
        const rayons = [...m.rayons]
        ;[rayons[rayonIdx - 1], rayons[rayonIdx]] = [rayons[rayonIdx], rayons[rayonIdx - 1]]
        return { ...m, rayons }
      })
    )
  }

  function moveRayonDown(magasinId, rayonIdx) {
    setMagasins(prev =>
      prev.map(m => {
        if (m.id !== magasinId) return m
        if (rayonIdx >= m.rayons.length - 1) return m
        const rayons = [...m.rayons]
        ;[rayons[rayonIdx], rayons[rayonIdx + 1]] = [rayons[rayonIdx + 1], rayons[rayonIdx]]
        return { ...m, rayons }
      })
    )
  }

  function renommerRayon(magasinId, rayonId, nouveau) {
    const trimmed = nouveau.trim()
    if (!trimmed) return
    setMagasins(prev =>
      prev.map(m =>
        m.id !== magasinId
          ? m
          : {
              ...m,
              rayons: m.rayons.map(r =>
                r.id !== rayonId ? r : { ...r, nom: trimmed }
              ),
            }
      )
    )
  }

  function ajouterRayon(magasinId, nom) {
    const trimmed = nom.trim()
    if (!trimmed) return
    setMagasins(prev =>
      prev.map(m =>
        m.id !== magasinId
          ? m
          : {
              ...m,
              rayons: [
                ...m.rayons,
                { id: crypto.randomUUID(), nom: trimmed },
              ],
            }
      )
    )
  }

  function supprimerRayon(magasinId, rayonId) {
    setMagasins(prev =>
      prev.map(m => {
        if (m.id !== magasinId) return m
        if (m.rayons.length <= 1) return m
        return { ...m, rayons: m.rayons.filter(r => r.id !== rayonId) }
      })
    )
  }

  return { magasins, moveRayonUp, moveRayonDown, renommerRayon, ajouterRayon, supprimerRayon }
}
