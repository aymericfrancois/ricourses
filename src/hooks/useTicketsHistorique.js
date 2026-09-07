import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

// Historique des tickets scannés (liste + détail à la demande), pour /historique.
// Indépendant de MagasinContext : lecture pure, pas de state global partagé —
// l'écriture se fait via MagasinContext.enregistrerTicket() au moment du scan.
export function useTicketsHistorique() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [articlesParTicket, setArticlesParTicket] = useState({})

  useEffect(() => {
    async function fetchTickets() {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, magasin_nom, date_ticket, total_officiel, total_calcule, nb_articles, image_path, created_at')
        .order('date_ticket', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) { console.error('fetchTickets:', error); setLoading(false); return }
      setTickets(data ?? [])
      setLoading(false)
    }
    fetchTickets()
  }, [])

  const chargerArticles = useCallback(async (ticketId) => {
    if (articlesParTicket[ticketId]) return articlesParTicket[ticketId]

    const { data, error } = await supabase
      .from('ticket_articles')
      .select('id, nom_article, ingredient_nom, prix, nombre, quantite, unite, prix_normalise, famille, split_choisi')
      .eq('ticket_id', ticketId)
      .order('nom_article')

    if (error) { console.error('chargerArticles:', error); return [] }
    setArticlesParTicket(prev => ({ ...prev, [ticketId]: data ?? [] }))
    return data ?? []
  }, [articlesParTicket])

  // Charge (si besoin) les articles de TOUS les tickets — utilisé pour l'export global.
  const chargerTousLesArticles = useCallback(async () => {
    const manquants = tickets.filter(t => !articlesParTicket[t.id])
    if (manquants.length === 0) return articlesParTicket

    const { data, error } = await supabase
      .from('ticket_articles')
      .select('id, ticket_id, nom_article, ingredient_nom, prix, nombre, quantite, unite, prix_normalise, famille, split_choisi')
      .in('ticket_id', manquants.map(t => t.id))

    if (error) { console.error('chargerTousLesArticles:', error); return articlesParTicket }

    const complet = { ...articlesParTicket }
    for (const t of manquants) complet[t.id] = []
    for (const row of data ?? []) {
      if (!complet[row.ticket_id]) complet[row.ticket_id] = []
      complet[row.ticket_id].push(row)
    }
    setArticlesParTicket(complet)
    return complet
  }, [tickets, articlesParTicket])

  function getImageUrl(imagePath) {
    if (!imagePath) return null
    return supabase.storage.from('tickets-images').getPublicUrl(imagePath).data.publicUrl
  }

  return { tickets, loading, articlesParTicket, chargerArticles, chargerTousLesArticles, getImageUrl }
}
