import { useState, useMemo } from 'react'
import { History, ChevronDown, ChevronUp, Download, Loader2, ImageIcon, Store } from 'lucide-react'
import { useTicketsHistorique } from '../hooks/useTicketsHistorique'
import { formatPrixNorm, UNITE_BASE_NOM } from '../utils/prix'
import { construireCsv, telechargerCsv, formatNombreCsv } from '../utils/csv'

const ENTETES_CSV = ['Date', 'Magasin', 'Article (ticket)', 'Ingrédient associé', 'Prix (€)', 'Nombre', 'Quantité', 'Unité', 'Prix normalisé']

function ligneCsv(ticket, article) {
  return [
    ticket.date_ticket,
    ticket.magasin_nom,
    article.nom_article,
    article.ingredient_nom ?? '',
    formatNombreCsv(article.prix),
    article.nombre,
    article.quantite ?? '',
    article.unite ?? '',
    article.prix_normalise != null ? formatNombreCsv(article.prix_normalise, 4) : '',
  ]
}

function nomFichierSur(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// ---- Une ligne d'article du détail d'un ticket ----
function LigneArticle({ article }) {
  const prixNorm = article.prix_normalise != null
    ? formatPrixNorm(article.prix_normalise, UNITE_BASE_NOM[article.famille] ?? 'u')
    : null
  const qtyLabel = article.quantite != null
    ? `${article.nombre > 1 ? `${article.nombre} × ` : ''}${article.quantite}${article.unite ? ' ' + article.unite : ''}`
    : (article.nombre > 1 ? `× ${article.nombre}` : null)

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm">
      <div className="flex-1 min-w-0">
        <p className="font-semibold ink truncate">{article.nom_article}</p>
        {article.ingredient_nom && (
          <p className="text-[11px] ink-4 truncate">→ {article.ingredient_nom}</p>
        )}
      </div>
      {qtyLabel && <span className="text-xs ink-3 tabular-nums mono shrink-0">{qtyLabel}</span>}
      <div className="text-right shrink-0 w-20">
        <p className="font-bold ink tabular-nums mono">{Number(article.prix).toFixed(2)} €</p>
        {prixNorm && <p className="text-[10px] accent-text font-semibold">{prixNorm}</p>}
      </div>
    </div>
  )
}

// ---- Une carte ticket (repliée / dépliée) ----
function CarteTicket({ ticket, ouvert, onToggle, articles, chargement, onExporter, getImageUrl }) {
  const date = new Date(ticket.date_ticket).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const ecart = ticket.total_officiel != null ? Math.abs(ticket.total_officiel - ticket.total_calcule) : 0
  const imageUrl = getImageUrl(ticket.image_path)

  return (
    <div className="glass sheen overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/40 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl accent-soft-bg flex items-center justify-center shrink-0">
          <Store size={16} className="accent-text" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold ink truncate">{ticket.magasin_nom}</p>
          <p className="text-xs ink-3">{date} · {ticket.nb_articles} article{ticket.nb_articles > 1 ? 's' : ''}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-extrabold ink tabular-nums mono">{ticket.total_calcule.toFixed(2)} €</p>
          {ecart > 0.05 && (
            <p className="text-[10px] text-amber-600">ticket : {ticket.total_officiel.toFixed(2)} €</p>
          )}
        </div>
        {ouvert ? <ChevronUp size={16} className="ink-4 shrink-0" /> : <ChevronDown size={16} className="ink-4 shrink-0" />}
      </button>

      {ouvert && (
        <div className="border-t border-white/40">
          <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-white/40">
            {imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ink-2 border border-white/70 bg-white/50 hover:bg-white/80 transition-colors"
              >
                <ImageIcon size={13} />Voir la photo
              </a>
            )}
            <button
              type="button"
              onClick={onExporter}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ink-2 border border-white/70 bg-white/50 hover:bg-white/80 transition-colors"
            >
              <Download size={13} />Exporter (CSV)
            </button>
          </div>
          {chargement ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin ink-3" />
            </div>
          ) : (
            <div className="divide-y divide-white/40">
              {(articles ?? []).map(a => <LigneArticle key={a.id} article={a} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Historique() {
  const { tickets, loading, articlesParTicket, chargerArticles, chargerTousLesArticles, getImageUrl } = useTicketsHistorique()
  const [ouverts, setOuverts] = useState(() => new Set())
  const [chargementParTicket, setChargementParTicket] = useState({})
  const [filtreMagasin, setFiltreMagasin] = useState('')
  const [exportEnCours, setExportEnCours] = useState(false)

  const ticketsFiltres = useMemo(
    () => filtreMagasin ? tickets.filter(t => t.magasin_nom === filtreMagasin) : tickets,
    [tickets, filtreMagasin]
  )

  async function toggleTicket(ticket) {
    const dejaOuvert = ouverts.has(ticket.id)
    setOuverts(prev => {
      const next = new Set(prev)
      if (dejaOuvert) next.delete(ticket.id); else next.add(ticket.id)
      return next
    })
    if (!dejaOuvert && !articlesParTicket[ticket.id]) {
      setChargementParTicket(prev => ({ ...prev, [ticket.id]: true }))
      await chargerArticles(ticket.id)
      setChargementParTicket(prev => ({ ...prev, [ticket.id]: false }))
    }
  }

  async function exporterTicket(ticket) {
    const articles = articlesParTicket[ticket.id] ?? await chargerArticles(ticket.id)
    const lignes = [ENTETES_CSV, ...articles.map(a => ligneCsv(ticket, a))]
    telechargerCsv(`ticket_${nomFichierSur(ticket.magasin_nom)}_${ticket.date_ticket}.csv`, construireCsv(lignes))
  }

  async function exporterTout() {
    setExportEnCours(true)
    const parTicket = await chargerTousLesArticles()
    const lignes = [ENTETES_CSV]
    for (const t of ticketsFiltres) {
      for (const a of parTicket[t.id] ?? []) lignes.push(ligneCsv(t, a))
    }
    telechargerCsv(`historique-courses_${new Date().toISOString().slice(0, 10)}.csv`, construireCsv(lignes))
    setExportEnCours(false)
  }

  const magasinsAvecTickets = useMemo(
    () => [...new Set(tickets.map(t => t.magasin_nom))].sort((a, b) => a.localeCompare(b, 'fr')),
    [tickets]
  )

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 anim-in">
      <div>
        <p className="chip mb-1.5">Scanner</p>
        <h1 className="text-3xl font-extrabold tracking-tight ink">Historique des tickets</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin ink-3" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 ink-4 glass sheen">
          <History size={40} className="mb-3" />
          <p className="text-sm text-center leading-relaxed ink-3">
            Aucun ticket scanné pour l&apos;instant.<br />Ils apparaîtront ici après validation dans le Scanner.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtreMagasin}
              onChange={e => setFiltreMagasin(e.target.value)}
              className="rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm ink focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
            >
              <option value="">Tous les magasins</option>
              {magasinsAvecTickets.map(nom => <option key={nom} value={nom}>{nom}</option>)}
            </select>
            <span className="text-xs ink-3">
              {ticketsFiltres.length} ticket{ticketsFiltres.length > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={exporterTout}
              disabled={exportEnCours}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl accent-bg text-sm font-semibold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {exportEnCours ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Exporter tout
            </button>
          </div>

          <div className="space-y-3">
            {ticketsFiltres.map(ticket => (
              <CarteTicket
                key={ticket.id}
                ticket={ticket}
                ouvert={ouverts.has(ticket.id)}
                onToggle={() => toggleTicket(ticket)}
                articles={articlesParTicket[ticket.id]}
                chargement={!!chargementParTicket[ticket.id]}
                onExporter={() => exporterTicket(ticket)}
                getImageUrl={getImageUrl}
              />
            ))}
          </div>
        </>
      )}
    </main>
  )
}

export default Historique
