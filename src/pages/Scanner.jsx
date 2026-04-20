import { useState, useRef, useEffect, useMemo } from 'react'
import {
  ScanLine, Upload, Camera, RotateCcw, CheckCircle2,
  BookmarkPlus, BookmarkCheck, AlertCircle, Trash2, ChevronDown, Undo2,
} from 'lucide-react'
import Tesseract from 'tesseract.js'
import { useMagasinContext } from '../context/MagasinContext'
import { usePlats } from '../hooks/usePlats'

// ---- Helpers OCR ----

function normaliser(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MOTS_CLES_IGNORER = [
  'total', 'cb', 'carte', 'visa', 'tva', 'merci', 'paye', 'especes',
  'rendu', 'dont', 'remise', 'reduction', 'mastercard', 'cheque',
  'siret', 'siren', 'fidelite', 'bienvenue', 'caisse', 'monnaie',
  'ticket', 'reglement', 'solde', 'promo', 'avoir', 'rabais',
  'nb article', 'subtotal',
  'bancaire', 'restaurant', 'identification', 'sans valeur',
  'economise', 'economie', 'vous avez', 'promotion',
  'nombre de lignes', 'a payer', 'eligible',
]

function parserTicket(texte) {
  const lines = texte.split('\n')
  const articles = []
  let currentCategory = null

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (trimmed.length < 3) continue

    const allPricesEarly = [...trimmed.matchAll(/(-?\d{1,4}[,.]\d{2})/g)]
    const firstNegative = allPricesEarly.find(m => parseFloat(m[1].replace(',', '.')) < 0)
    if (firstNegative) {
      const remise = parseFloat(firstNegative[1].replace(',', '.'))
      if (articles.length > 0) {
        const lastArticle = articles[articles.length - 1]
        lastArticle.prix = Number((lastArticle.prix + remise).toFixed(2))
        console.log('RÉDUCTION :', remise, 'APPLIQUÉE SUR :', lastArticle.nom, '-> NOUVEAU PRIX :', lastArticle.prix)
      }
      continue
    }

    const normLigne = normaliser(trimmed)
    if (MOTS_CLES_IGNORER.some(kw => normLigne.includes(kw))) continue

    const allPrices = [...trimmed.matchAll(/(-?\d{1,4}[,.]\d{2})/g)]
    const hasPrice = allPrices.length > 0

    if (!hasPrice && /^>>+/.test(trimmed)) {
      const catMatch = trimmed.match(/^>>+\s*(.+)/)
      if (catMatch) {
        currentCategory = catMatch[1].replace(/^[^a-zA-ZÀ-ÿ0-9]+/, '').trim().toUpperCase()
      }
      continue
    }

    if (!hasPrice) continue

    const isMultiplierLine = /^\s*\d+\s*[xXàÀ*]/.test(trimmed)

    if (allPrices.length >= 2 && !isMultiplierLine) {
      const segments = []
      for (let p = 0; p < allPrices.length; p++) {
        const nameStart = p === 0 ? 0 : allPrices[p - 1].index + allPrices[p - 1][0].length
        const rawSegName = trimmed.slice(nameStart, allPrices[p].index)
        const segName = rawSegName
          .replace(/^[^a-zA-ZÀ-ÿ0-9]+/, '')
          .replace(/^\d{5,}\s*/, '')
          .replace(/\d+\s*[xX×]\s*/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        const segPrix = parseFloat(allPrices[p][0].replace(',', '.'))
        if (segName.length >= 2 && /[a-zA-ZÀ-ÿ]/.test(segName) && segPrix > 0 && segPrix <= 500) {
          segments.push({ name: segName, price: segPrix })
        }
      }
      if (segments.length >= 2) {
        for (const seg of segments) {
          console.log('LIGNE LUE (MULTI) :', raw, '--> SEGMENT AJOUTÉ :', seg.name, seg.price)
          articles.push({
            id: crypto.randomUUID(),
            nom: seg.name.toUpperCase(),
            prix: seg.price,
            matchedNom: null,
            receiptCategory: currentCategory,
            ignored: false,
          })
        }
        continue
      }
    }

    const lastPriceMatch = allPrices[allPrices.length - 1]
    const prix = parseFloat(lastPriceMatch[1].replace(',', '.'))

    if (prix <= 0 || prix > 500) continue

    let cleanedName

    if (isMultiplierLine) {
      const prevLine = i > 0 ? lines[i - 1].trim() : ''
      cleanedName = prevLine
        .replace(/^[^a-zA-ZÀ-ÿ0-9]+/, '')
        .replace(/(-?\d{1,4}[,.]\d{2})\s*[A-Za-z]?\s*$/, '')
        .replace(/\d+\s*[xX×]\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    } else {
      const firstPriceIndex = allPrices[0].index
      const rawName = trimmed.slice(0, firstPriceIndex)
      cleanedName = rawName
        .replace(/^[^a-zA-ZÀ-ÿ0-9]+/, '')
        .replace(/^\d{5,}\s*/, '')
        .replace(/\d+\s*[xX×]\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }

    console.log('LIGNE LUE :', raw, '--> ACTION :', hasPrice ? 'AJOUTÉ' : 'IGNORÉ', '--> RESULTAT NOM :', cleanedName)

    if (!cleanedName || cleanedName.length < 2) continue
    if (!/[a-zA-ZÀ-ÿ]{3}/.test(cleanedName)) continue
    if (!/[aeiouAEIOUàâäéèêëîïôöùûüÀÂÄÉÈÊËÎÏÔÖÙÛÜ]/.test(cleanedName)) continue

    articles.push({
      id: crypto.randomUUID(),
      nom: cleanedName.toUpperCase(),
      prix,
      matchedNom: null,
      receiptCategory: currentCategory,
      ignored: false,
    })
  }

  return articles
}

function trouverCorrespondance(nomArticle, ingredientNames, getOcrAlias) {
  const alias = getOcrAlias(nomArticle)
  if (alias) return alias

  const normArticle = normaliser(nomArticle)

  for (const ing of ingredientNames) {
    const normIng = normaliser(ing)
    if (normIng.length < 3) continue
    const escaped = normIng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?:^|\\s|\\b)${escaped}s?(?:\\s|$|\\b)`)
    if (re.test(normArticle)) return ing
  }

  const wordsArticle = normArticle.split(' ').filter(w => w.length >= 5)
  if (wordsArticle.length > 0) {
    for (const ing of ingredientNames) {
      const wordsIng = normaliser(ing).split(' ').filter(w => w.length >= 5)
      if (wordsIng.length > 0 && wordsIng.every(w => wordsArticle.includes(w))) return ing
    }
  }

  return null
}

const STATUS_LABELS = {
  'loading tesseract core': 'Chargement du moteur OCR…',
  'initializing tesseract': 'Initialisation…',
  'loading language traineddata': 'Téléchargement du dictionnaire français…',
  'initializing api': 'Préparation…',
  'recognizing text': 'Lecture du ticket…',
}

// ---- Composants UI ----

// 'me' (bleu) et 'ali' (rose) = code couleur Tricount domaine (gardé)
// 'both' (50/50) = accent de l'app
const SPLIT_OPTS = [
  { val: 'me',   label: 'Moi',   emoji: '👦', active: 'bg-blue-500 text-white',  dot: 'bg-blue-400' },
  { val: 'both', label: '50/50', emoji: '👥', active: 'accent-bg',                dot: 'bg-[color:var(--accent)]' },
  { val: 'ali',  label: 'Ali',   emoji: '👩', active: 'bg-pink-500 text-white',  dot: 'bg-pink-400' },
]

const BORDER_COLORS = {
  me: 'border-l-blue-400',
  both: 'border-l-[color:var(--accent)]/40',
  ali: 'border-l-pink-400',
}

function SplitToggle({ value, onChange }) {
  return (
    <div className="flex rounded-xl border border-white/70 overflow-hidden text-xs font-semibold shrink-0 bg-white/50">
      {SPLIT_OPTS.map((opt, i) => (
        <button
          key={opt.val}
          onClick={() => onChange(opt.val)}
          className={`px-2.5 py-1.5 flex items-center gap-1 transition-colors ${i > 0 ? 'border-l border-white/70' : ''} ${
            value === opt.val ? opt.active : 'ink-3 hover:bg-white/60'
          }`}
        >
          <span>{opt.emoji}</span>
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}

// ---- Sélecteur d'ingrédient (dropdown pour correction manuelle) ----

function IngredientSelector({ currentMatch, suggestions, onSelect, onCreateIngredient }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  const filtered = query.trim()
    ? suggestions.filter(n => n.toLowerCase().includes(query.toLowerCase())).slice(0, 15)
    : suggestions.slice(0, 20)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setQuery('') }}
        className="text-[10px] ink-3 mt-0.5 flex items-center gap-0.5 hover:accent-text transition-colors group"
      >
        {currentMatch ? (
          <span>→ <span className="font-semibold ink-2 group-hover:accent-text">{currentMatch}</span></span>
        ) : (
          <span className="italic">Associer un ingrédient…</span>
        )}
        <ChevronDown size={9} className="shrink-0" />
      </button>
    )
  }

  return (
    <div ref={ref} className="relative mt-1">
      <input
        autoFocus
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Chercher un ingrédient…"
        className="w-full rounded-lg border border-[color:var(--accent)]/40 bg-white/80 px-2 py-1 text-xs ink placeholder:text-[color:var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
      />
      <ul className="absolute z-40 top-full left-0 right-0 mt-1 glass-strong sheen max-h-40 overflow-y-auto p-1 anim-pop">
        {currentMatch && (
          <li
            onMouseDown={e => { e.preventDefault(); onSelect(null); setOpen(false) }}
            className="px-2 py-1.5 text-xs text-red-500 hover:bg-red-50/60 cursor-pointer rounded-lg"
          >
            ✕ Dissocier
          </li>
        )}
        {filtered.map(nom => (
          <li
            key={nom}
            onMouseDown={e => { e.preventDefault(); onSelect(nom); setOpen(false) }}
            className={`px-2 py-1.5 text-xs cursor-pointer rounded-lg transition-colors ${nom === currentMatch ? 'accent-soft-bg accent-text font-semibold' : 'ink-2 hover:bg-white/60'}`}
          >
            {nom}
          </li>
        ))}
        {query.trim().length >= 2 && !suggestions.some(n => n.toLowerCase() === query.trim().toLowerCase()) && (
          <li
            onMouseDown={e => {
              e.preventDefault()
              const newNom = query.trim()
              onCreateIngredient(newNom)
              onSelect(newNom)
              setOpen(false)
            }}
            className="px-2 py-1.5 text-xs accent-text hover:accent-soft-bg cursor-pointer rounded-lg font-semibold"
          >
            ➕ Créer « {query.trim()} »
          </li>
        )}
        {filtered.length === 0 && query.trim().length < 2 && (
          <li className="px-2 py-2 text-xs ink-3 italic">Aucun résultat</li>
        )}
      </ul>
    </div>
  )
}

// ---- Page Scanner ----

function Scanner() {
  const { getSplit, setSplit, standaloneIngredients, ajouterIngredientStandalone, getOcrAlias, setOcrAlias } = useMagasinContext()
  const { plats } = usePlats()

  const [step, setStep] = useState('capture')
  const [imagePreview, setImagePreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [articles, setArticles] = useState([])
  const [articleSplits, setArticleSplits] = useState({})
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrStatus, setOcrStatus] = useState('')
  const [recentlySaved, setRecentlySaved] = useState(new Set())

  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const ingredientNames = useMemo(() => {
    const seen = new Set()
    plats.forEach(p => p.ingredients.forEach(i => seen.add(i.nom)))
    standaloneIngredients.forEach(nom => seen.add(nom))
    return [...seen].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [plats, standaloneIngredients])

  function handleFileSelected(file) {
    if (!file || !file.type.startsWith('image/')) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFileSelected(e.dataTransfer.files?.[0])
  }

  async function handleAnalyser() {
    if (!imageFile) return
    setStep('loading')
    setOcrProgress(0)
    setOcrStatus('')

    try {
      const result = await Tesseract.recognize(imageFile, 'fra', {
        logger: m => {
          setOcrStatus(m.status)
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100))
          }
        },
      })

      const extracted = parserTicket(result.data.text).map(a => ({
        ...a,
        matchedNom: trouverCorrespondance(a.nom, ingredientNames, getOcrAlias),
      }))

      const initial = {}
      extracted.forEach(a => {
        initial[a.id] = a.matchedNom ? getSplit(a.matchedNom) : 'both'
      })

      setArticles(extracted)
      setArticleSplits(initial)
      setStep(extracted.length > 0 ? 'resultat' : 'erreur')
    } catch (err) {
      console.error('Erreur OCR :', err)
      setStep('erreur')
    }
  }

  function handleReset() {
    setStep('capture')
    setImagePreview(null)
    setImageFile(null)
    setArticles([])
    setArticleSplits({})
    setOcrProgress(0)
    setOcrStatus('')
  }

  function setArticleSplit(id, val) {
    setArticleSplits(prev => ({ ...prev, [id]: val }))
  }

  function toggleIgnored(id) {
    setArticles(prev => prev.map(a =>
      a.id === id ? { ...a, ignored: !a.ignored } : a
    ))
  }

  function corrigerMatch(articleId, nouvelIngredient) {
    setArticles(prev => prev.map(a => {
      if (a.id !== articleId) return a
      if (nouvelIngredient) setOcrAlias(a.nom, nouvelIngredient)
      return { ...a, matchedNom: nouvelIngredient }
    }))
    if (nouvelIngredient) {
      setArticleSplits(prev => ({ ...prev, [articleId]: getSplit(nouvelIngredient) }))
    }
  }

  function creerIngredient(nom) {
    ajouterIngredientStandalone(nom, null)
  }

  function memoriserDefaut(article) {
    const val = articleSplits[article.id] ?? 'both'
    setSplit(article.matchedNom, val)
    setRecentlySaved(prev => new Set([...prev, article.id]))
    setTimeout(() => setRecentlySaved(prev => {
      const next = new Set(prev); next.delete(article.id); return next
    }), 1500)
  }

  const articlesActifs = articles.filter(a => !a.ignored)
  const totalTicket = articlesActifs.reduce((sum, a) => sum + a.prix, 0)
  const partMoi = articlesActifs.reduce((sum, a) => {
    const split = articleSplits[a.id] ?? 'both'
    if (split === 'me') return sum + a.prix
    if (split === 'both') return sum + a.prix / 2
    return sum
  }, 0)
  const partAli = totalTicket - partMoi

  // ---- ÉTAPE 1 : Capture + Loading ----
  if (step === 'capture' || step === 'loading') {
    return (
      <main className="max-w-lg mx-auto px-4 py-8 anim-in">

        <div className="mb-6">
          <p className="chip mb-1.5">Scanner</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl accent-soft-bg flex items-center justify-center">
              <ScanLine size={20} className="accent-text" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight ink">Scanner un ticket</h1>
              <p className="text-xs ink-3">Extrait les articles et calcule la répartition</p>
            </div>
          </div>
        </div>

        {/* Zone de dépôt */}
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => !imagePreview && step !== 'loading' && fileInputRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
            imagePreview ? 'border-[color:var(--accent)]/40 accent-soft-bg'
            : dragOver ? 'border-[color:var(--accent)]/60 accent-soft-bg'
            : step === 'loading' ? 'border-white/70 bg-white/40'
            : 'border-white/70 bg-white/40 hover:border-white/90 hover:bg-white/60 cursor-pointer'
          }`}
        >
          {imagePreview ? (
            <div className="relative">
              <img src={imagePreview} alt="Ticket" className="w-full max-h-72 object-contain" />
              {step !== 'loading' && (
                <button
                  onClick={e => { e.stopPropagation(); setImagePreview(null); setImageFile(null) }}
                  className="absolute top-2 right-2 glass-sm p-1.5 ink-2 hover:text-red-500 transition-colors"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-14 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/60 flex items-center justify-center ink-4">
                <Upload size={26} />
              </div>
              <div>
                <p className="text-sm font-semibold ink-2">Déposez une photo ici</p>
                <p className="text-xs ink-3 mt-0.5">ou utilisez les boutons ci-dessous</p>
              </div>
            </div>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFileSelected(e.target.files?.[0])} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => handleFileSelected(e.target.files?.[0])} />

        {!imagePreview && step !== 'loading' && (
          <div className="flex gap-3 mt-4">
            <button onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/70 bg-white/50 text-sm font-semibold ink-2 hover:bg-white/80 transition-colors">
              <Camera size={16} />Caméra
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/70 bg-white/50 text-sm font-semibold ink-2 hover:bg-white/80 transition-colors">
              <Upload size={16} />Galerie
            </button>
          </div>
        )}

        <button
          onClick={handleAnalyser}
          disabled={!imageFile || step === 'loading'}
          className={`mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all ${
            imageFile && step !== 'loading'
              ? 'accent-bg hover:brightness-110 shadow-md active:scale-[0.98]'
              : 'bg-white/40 ink-4 cursor-not-allowed border border-white/60'
          }`}
        >
          {step === 'loading' ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-[color:var(--accent)] border-t-transparent animate-spin shrink-0" />
              <span className="truncate ink-2">{STATUS_LABELS[ocrStatus] ?? 'Démarrage…'}</span>
            </>
          ) : (
            <><ScanLine size={16} />Analyser le ticket</>
          )}
        </button>

        {step === 'loading' && (
          <div className="mt-3 space-y-1.5">
            <div className="w-full bg-white/50 border border-white/70 rounded-full h-1.5 overflow-hidden">
              {ocrStatus === 'recognizing text' ? (
                <div className="accent-bg h-full rounded-full transition-all duration-300"
                  style={{ width: `${ocrProgress}%` }} />
              ) : (
                <div className="h-full w-2/5 bg-[color:var(--accent)]/50 rounded-full animate-pulse" />
              )}
            </div>
            {ocrStatus === 'recognizing text' && (
              <p className="text-center text-xs ink-3 mono">{ocrProgress}%</p>
            )}
            {ocrStatus === 'loading language traineddata' && (
              <p className="text-center text-[10px] ink-3">
                Première utilisation : téléchargement du dictionnaire (~10 Mo)
              </p>
            )}
          </div>
        )}

      </main>
    )
  }

  // ---- ERREUR ----
  if (step === 'erreur') {
    return (
      <main className="max-w-lg mx-auto px-4 py-8 anim-in">
        <div className="flex flex-col items-center gap-5 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50/70 border border-white/60 flex items-center justify-center">
            <AlertCircle size={32} className="text-orange-400" />
          </div>
          <div>
            <h2 className="text-base font-bold ink mb-2">Aucun article reconnu</h2>
            <p className="text-sm ink-3 max-w-xs leading-relaxed">
              Le texte extrait ne contient pas d'articles avec prix identifiables.
              Essayez avec une photo plus nette, bien cadrée et éclairée.
            </p>
          </div>
          <button onClick={handleReset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl accent-bg text-sm font-semibold hover:brightness-110 transition-colors">
            <RotateCcw size={15} />Réessayer
          </button>
        </div>
      </main>
    )
  }

  // ---- ÉTAPE 2 : Résultats + Tricount ----
  const nbMoi  = articlesActifs.filter(a => articleSplits[a.id] === 'me').length
  const nbAli  = articlesActifs.filter(a => articleSplits[a.id] === 'ali').length
  const nbBoth = articlesActifs.filter(a => (articleSplits[a.id] ?? 'both') === 'both').length
  const nbIgnored = articles.filter(a => a.ignored).length

  return (
    <div className="pb-36">
      <main className="max-w-3xl mx-auto px-4 py-6 anim-in">

        {/* En-tête */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="accent-text" />
            <div>
              <p className="text-sm font-bold ink">{articlesActifs.length} articles reconnus{nbIgnored > 0 && <span className="ink-3 font-normal"> · {nbIgnored} ignoré{nbIgnored > 1 ? 's' : ''}</span>}</p>
              <p className="text-xs ink-3">👦 {nbMoi} · 👥 {nbBoth} · 👩 {nbAli}</p>
            </div>
          </div>
          <button onClick={handleReset}
            className="flex items-center gap-1.5 text-xs ink-2 hover:ink border border-white/70 rounded-xl px-3 py-1.5 bg-white/50 hover:bg-white/80 transition-colors">
            <RotateCcw size={12} />Nouveau ticket
          </button>
        </div>

        {/* Légende */}
        <div className="flex gap-4 mb-4">
          {SPLIT_OPTS.map(opt => (
            <span key={opt.val} className="flex items-center gap-1.5 text-xs ink-3">
              <span className={`w-2.5 h-2.5 rounded-full inline-block ${opt.dot}`} />
              {opt.emoji} {opt.label}
            </span>
          ))}
        </div>

        {/* Liste des articles */}
        <div className="glass sheen divide-y divide-white/40 overflow-hidden">
          {articles.map(article => {
            const split = articleSplits[article.id] ?? 'both'
            const defaultSplit = article.matchedNom ? getSplit(article.matchedNom) : 'both'
            const isModified = article.matchedNom && split !== defaultSplit
            const justSaved = recentlySaved.has(article.id)
            return (
              <div
                key={article.id}
                className={`flex items-start gap-3 px-4 py-3 border-l-4 transition-colors ${
                  article.ignored ? 'border-l-[color:var(--ink-4)] opacity-50' : BORDER_COLORS[split]
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${article.ignored ? 'line-through ink-4' : 'ink'}`}>
                    {article.nom}
                  </p>
                  {article.receiptCategory && (
                    <p className="text-[10px] ink-4 mt-0.5">{article.receiptCategory}</p>
                  )}
                  {!article.ignored && (
                    <IngredientSelector
                      currentMatch={article.matchedNom}
                      suggestions={ingredientNames}
                      onSelect={nom => corrigerMatch(article.id, nom)}
                      onCreateIngredient={nom => {
                        creerIngredient(nom)
                        setOcrAlias(article.nom, nom)
                      }}
                    />
                  )}
                </div>

                <span className={`text-sm font-bold tabular-nums mono shrink-0 pt-0.5 ${article.ignored ? 'ink-4 line-through' : 'ink-2'}`}>
                  {article.prix.toFixed(2)} €
                </span>

                {!article.ignored && (
                  <div className="shrink-0 pt-0.5">
                    <SplitToggle value={split} onChange={val => setArticleSplit(article.id, val)} />
                  </div>
                )}

                <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                  {!article.ignored && (
                    <>
                      {justSaved ? (
                        <span className="flex items-center gap-1 text-[10px] accent-text font-semibold">
                          <BookmarkCheck size={13} />
                        </span>
                      ) : isModified ? (
                        <button
                          onClick={() => memoriserDefaut(article)}
                          title={`Mémoriser "${split === 'me' ? 'Moi' : split === 'ali' ? 'Ali' : '50/50'}" pour ${article.matchedNom}`}
                          className="ink-4 hover:accent-text transition-colors"
                        >
                          <BookmarkPlus size={14} />
                        </button>
                      ) : (
                        <span className="w-3.5" />
                      )}
                    </>
                  )}
                  <button
                    onClick={() => toggleIgnored(article.id)}
                    title={article.ignored ? 'Restaurer cet article' : 'Ignorer cet article'}
                    className={`transition-colors ${article.ignored ? 'ink-3 hover:accent-text' : 'ink-4 hover:text-red-400'}`}
                  >
                    {article.ignored ? <Undo2 size={13} /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

      </main>

      {/* Panneau Tricount fixe */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4">
        <div className="max-w-3xl mx-auto glass-strong sheen px-4 py-4">
          <div className="flex items-stretch gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-bold ink-3 uppercase tracking-widest mb-0.5">Total ticket</p>
              <p className="text-2xl font-extrabold ink tabular-nums mono">{totalTicket.toFixed(2)} €</p>
              <p className="text-[10px] ink-3 mt-0.5">{articlesActifs.length} articles</p>
            </div>
            <div className="w-px bg-white/50" />
            <div className="flex-1 text-center">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-0.5">👦 Moi</p>
              <p className="text-2xl font-extrabold text-blue-600 tabular-nums mono">{partMoi.toFixed(2)} €</p>
              <p className="text-[10px] text-blue-400 mt-0.5">{nbMoi} solo + {nbBoth} partagés</p>
            </div>
            <div className="w-px bg-white/50" />
            <div className="flex-1 text-center">
              <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest mb-0.5">👩 Ali</p>
              <p className="text-2xl font-extrabold text-pink-600 tabular-nums mono">{partAli.toFixed(2)} €</p>
              <p className="text-[10px] text-pink-400 mt-0.5">{nbAli} solo + {nbBoth} partagés</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Scanner
