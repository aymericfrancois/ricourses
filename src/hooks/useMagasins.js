import { useState, useEffect } from 'react'
import initialMagasins from '../data/initialMagasins.json'
import { supabase } from '../supabaseClient'

const STORAGE_KEY = 'ricourses_magasins'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  useEffect(() => {
    async function fetchMagasins() {
      const { data, error } = await supabase
        .from('magasins')
        .select('id, nom, rayons(id, nom, position)')
        .order('nom')

      if (error) { console.error('fetchMagasins:', error); return }
      if (data.length === 0) return // Supabase vide → garder localStorage

      const mapped = data.map(m => ({
        id: m.id,
        nom: m.nom,
        rayons: (m.rayons ?? [])
          .sort((a, b) => a.position - b.position)
          .map(r => ({ id: r.id, nom: r.nom })),
      }))
      setMagasins(mapped)
    }
    fetchMagasins()
  }, [])

  function moveRayonUp(magasinId, rayonIdx) {
    if (rayonIdx === 0) return
    const magasin = magasins.find(m => m.id === magasinId)
    if (magasin) {
      const a = magasin.rayons[rayonIdx - 1]
      const b = magasin.rayons[rayonIdx]
      if (UUID_REGEX.test(a.id)) supabase.from('rayons').update({ position: rayonIdx }).eq('id', a.id)
        .then(({ error }) => { if (error) console.error('moveRayonUp a:', error) })
      if (UUID_REGEX.test(b.id)) supabase.from('rayons').update({ position: rayonIdx - 1 }).eq('id', b.id)
        .then(({ error }) => { if (error) console.error('moveRayonUp b:', error) })
    }
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
    const magasin = magasins.find(m => m.id === magasinId)
    if (magasin && rayonIdx < magasin.rayons.length - 1) {
      const a = magasin.rayons[rayonIdx]
      const b = magasin.rayons[rayonIdx + 1]
      if (UUID_REGEX.test(a.id)) supabase.from('rayons').update({ position: rayonIdx + 1 }).eq('id', a.id)
        .then(({ error }) => { if (error) console.error('moveRayonDown a:', error) })
      if (UUID_REGEX.test(b.id)) supabase.from('rayons').update({ position: rayonIdx }).eq('id', b.id)
        .then(({ error }) => { if (error) console.error('moveRayonDown b:', error) })
    }
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
        m.id !== magasinId ? m : {
          ...m,
          rayons: m.rayons.map(r => r.id !== rayonId ? r : { ...r, nom: trimmed }),
        }
      )
    )
    if (UUID_REGEX.test(rayonId)) supabase.from('rayons').update({ nom: trimmed }).eq('id', rayonId)
      .then(({ error }) => { if (error) console.error('renommerRayon:', error) })
  }

  function ajouterRayon(magasinId, nom) {
    const trimmed = nom.trim()
    if (!trimmed) return
    const id = crypto.randomUUID()
    const magasin = magasins.find(m => m.id === magasinId)
    const position = magasin ? magasin.rayons.length : 0
    setMagasins(prev =>
      prev.map(m =>
        m.id !== magasinId ? m : { ...m, rayons: [...m.rayons, { id, nom: trimmed }] }
      )
    )
    if (UUID_REGEX.test(magasinId)) supabase.from('rayons').insert({ id, magasin_id: magasinId, nom: trimmed, position })
      .then(({ error }) => { if (error) console.error('ajouterRayon:', error) })
  }

  function supprimerRayon(magasinId, rayonId) {
    setMagasins(prev =>
      prev.map(m => {
        if (m.id !== magasinId) return m
        if (m.rayons.length <= 1) return m
        return { ...m, rayons: m.rayons.filter(r => r.id !== rayonId) }
      })
    )
    if (UUID_REGEX.test(rayonId)) supabase.from('rayons').delete().eq('id', rayonId)
      .then(({ error }) => { if (error) console.error('supprimerRayon:', error) })
  }

  function reorderRayons(magasinId, newRayons) {
    setMagasins(prev => prev.map(m => m.id !== magasinId ? m : { ...m, rayons: newRayons }))
    newRayons.forEach((r, i) => {
      if (UUID_REGEX.test(r.id)) supabase.from('rayons').update({ position: i }).eq('id', r.id)
        .then(({ error }) => { if (error) console.error('reorderRayons:', error) })
    })
  }

  return { magasins, moveRayonUp, moveRayonDown, renommerRayon, ajouterRayon, supprimerRayon, reorderRayons }
}
