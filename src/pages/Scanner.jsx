import { useState, useRef, useMemo } from 'react'
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

// Mots-clés : une ligne contenant l'un d'eux est ignorée
// ⚠️ Tous les mots-clés sont normalisés (sans accents, minuscules)
// La comparaison utilise normaliser() sur chaque ligne — les accents ne posent plus de problème.
const MOTS_CLES_IGNORER = [
  'total', 'cb', 'carte', 'visa', 'tva', 'merci', 'paye', 'especes',
  'rendu', 'dont', 'remise', 'reduction', 'mastercard', 'cheque',
  'siret', 'siren', 'fidelite', 'bienvenue', 'caisse', 'monnaie',
  'ticket', 'reglement', 'solde', 'promo', 'avoir', 'rabais',
  'nb article', 'subtotal',
  // Lignes bas de ticket Lidl / Carrefour / Leclerc
  'bancaire', 'restaurant', 'identification', 'sans valeur',
  'economise', 'economie', 'vous avez', 'promotion',
  'nombre de lignes', 'a payer', 'eligible',
]

/**
 * Parsing « tout-terrain » — Leclerc / Lidl / Carrefour.
 *
 * Architecture stricte et linéaire : chaque ligne est indépendante.
 * Aucune fusion entre lignes consécutives, sauf si la ligne courante
 * commence par un multiplicateur (2 X, 2 À…).
 *
 * Nettoyage nucléaire du nom : /^[^a-zA-ZÀ-ÿ0-9]+/ supprime tout préfixe
 * qui n'est pas une lettre ou un chiffre (>>, ., espaces, caractères invisibles…).
 */
function parserTicket(texte) {
  const lines = texte.split('\n')
  const articles = []
  let currentCategory = null

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    // ── Lignes trop courtes
    if (trimmed.length < 3) continue

    // ── Détection des prix négatifs EN PREMIER (avant tout filtrage)
    // "Réduction Lidl Plus -0,10" serait éliminée par les mots-clés avant d'atteindre le check.
    // On extrait ici tous les prix de la ligne, et si l'un est négatif on l'applique immédiatement.
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

    // ── Filtrage des mots-clés — comparaison normalisée (accents supprimés)
    const normLigne = normaliser(trimmed)
    if (MOTS_CLES_IGNORER.some(kw => normLigne.includes(kw))) continue

    // ── Détection de prix sur cette ligne
    const allPrices = [...trimmed.matchAll(/(-?\d{1,4}[,.]\d{2})/g)]
    const hasPrice = allPrices.length > 0

    // ── Lignes ">>" sans prix → catégorie de rayon
    if (!hasPrice && /^>>+/.test(trimmed)) {
      const catMatch = trimmed.match(/^>>+\s*(.+)/)
      if (catMatch) {
        currentCategory = catMatch[1].replace(/^[^a-zA-ZÀ-ÿ0-9]+/, '').trim().toUpperCase()
      }
      continue
    }

    // ── Pas de prix → on passe sans stocker de contexte
    if (!hasPrice) continue

    // ── Détection de ligne-multiplicateur (ex: "2 X 1.35 2.70")
    const isMultiplierLine = /^\s*\d+\s*[xXàÀ*]/.test(trimmed)

    // ── Multi-article : si ≥ 2 prix et pas une ligne-multiplicateur,
    //    on tente de découper en articles distincts (OCR a fusionné 2 lignes)
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

    // ── Prix total = dernier nombre à 2 décimales
    const lastPriceMatch = allPrices[allPrices.length - 1]
    const prix = parseFloat(lastPriceMatch[1].replace(',', '.'))

    if (prix <= 0 || prix > 500) continue

    // ── Extraction du nom
    let cleanedName

    if (isMultiplierLine) {
      // Le vrai nom est dans la ligne brute précédente, on supprime le prix résiduel
      const prevLine = i > 0 ? lines[i - 1].trim() : ''
      cleanedName = prevLine
        .replace(/^[^a-zA-ZÀ-ÿ0-9]+/, '')
        .replace(/(-?\d{1,4}[,.]\d{2})\s*[A-Za-z]?\s*$/, '')
        .replace(/\d+\s*[xX×]\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    } else {
      // Texte avant le PREMIER prix = nom (chaque ligne est indépendante)
      const firstPriceIndex = allPrices[0].index
      const rawName = trimmed.slice(0, firstPriceIndex)
      cleanedName = rawName
        .replace(/^[^a-zA-ZÀ-ÿ0-9]+/, '')
        .replace(/^\d{5,}\s*/, '')       // codes-barres numériques
        .replace(/\d+\s*[xX×]\s*/g, '') // quantités "2x"
        .replace(/\s+/g, ' ')
        .trim()
    }

    console.log('LIGNE LUE :', raw, '--> ACTION :', hasPrice ? 'AJOUTÉ' : 'IGNORÉ', '--> RESULTAT NOM :', cleanedName)

    // ── Nom substantiel : au moins 3 lettres consécutives ET au moins une voyelle
    // Élimine : "A 5,5%", "B 20%", "GKR", "3921 322529/03/17/01"
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

/**
 * Matching intelligent : alias d'abord, puis fuzzy.
 *
 * Les alias (ocrAliases) sont des paires exactes apprises manuellement :
 *   { "coeur laitue": "Salade", "daddy poudre sachet": "Sucre" }
 *
 * Le fuzzy match ne matche que des mots ENTIERS (pas de "Lait" dans "Laitue")
 * en utilisant des frontières de mots.
 */
function trouverCorrespondance(nomArticle, ingredientNames, getOcrAlias) {
  // 1. Vérifier les alias appris
  const alias = getOcrAlias(nomArticle)
  if (alias) return alias

  const normArticle = normaliser(nomArticle)

  // 2. Inclusion par mots entiers (word-boundary safe)
  for (const ing of ingredientNames) {
    const normIng = normaliser(ing)
    if (normIng.length < 3) continue
    const escaped = normIng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?:^|\\s|\\b)${escaped}s?(?:\\s|$|\\b)`)
    if (re.test(normArticle)) return ing
  }

  // 3. Intersection de mots significatifs (≥ 5 chars pour éviter les faux positifs)
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

const SPLIT_OPTS = [
  { val: 'me',   label: 'Moi',   emoji: '👦', active: 'bg-blue-500 text-white',  dot: 'bg-blue-400' },
  { val: 'both', label: '50/50', emoji: '👥', active: 'bg-green-500 text-white', dot: 'bg-green-400' },
  { val: 'ali',  label: 'Ali',   emoji: '👩', active: 'bg-pink-500 text-white',  dot: 'bg-pink-400' },
]

const BORDER_COLORS = { me: 'border-l-blue-400', both: 'border-l-green-300', ali: 'border-l-pink-400' }

function SplitToggle({ value, onChange }) {
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium shrink-0">
      {SPLIT_OPTS.map((opt, i) => (
        <button
          key={opt.val}
          onClick={() => onChange(opt.val)}
          className={`px-2.5 py-1.5 flex items-center gap-1 transition-colors ${i > 0 ? 'border-l border-gray-200' : ''} ${
            value === opt.val ? opt.active : 'bg-white text-gray-500 hover:bg-gray-50'
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

  // Fermer au clic extérieur
  useState(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  })

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setQuery('') }}
        className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-0.5 hover:text-green-600 transition-colors group"
      >
        {currentMatch ? (
          <span>→ <span className="font-medium text-gray-500 group-hover:text-green-600">{currentMatch}</span></span>
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
        className="w-full rounded border border-green-400 bg-white px-2 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500"
      />
      <ul className="absolute z-40 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
        {currentMatch && (
          <li
            onMouseDown={e => { e.preventDefault(); onSelect(null); setOpen(false) }}
            className="px-2 py-1.5 text-xs text-red-400 hover:bg-red-50 cursor-pointer border-b border-gray-100"
          >
            ✕ Dissocier
          </li>
        )}
        {filtered.map(nom => (
          <li
            key={nom}
            onMouseDown={e => { e.preventDefault(); onSelect(nom); setOpen(false) }}
            className={`px-2 py-1.5 text-xs cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors ${nom === currentMatch ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'}`}
          >
            {nom}
          </li>
        ))}
        {/* Option création à la volée */}
        {query.trim().length >= 2 && !suggestions.some(n => n.toLowerCase() === query.trim().toLowerCase()) && (
          <li
            onMouseDown={e => {
              e.preventDefault()
              const newNom = query.trim()
              onCreateIngredient(newNom)
              onSelect(newNom)
              setOpen(false)
            }}
            className="px-2 py-1.5 text-xs text-green-600 hover:bg-green-50 cursor-pointer border-t border-gray-100 font-medium"
          >
            ➕ Créer « {query.trim()} »
          </li>
        )}
        {filtered.length === 0 && query.trim().length < 2 && (
          <li className="px-2 py-2 text-xs text-gray-400 italic">Aucun résultat</li>
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

  // Noms d'ingrédients triés pour les dropdowns
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

  // Soft delete : bascule ignored au lieu de supprimer
  function toggleIgnored(id) {
    setArticles(prev => prev.map(a =>
      a.id === id ? { ...a, ignored: !a.ignored } : a
    ))
  }

  // Correction manuelle du matching + apprentissage alias
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

  // Création d'un ingrédient à la volée depuis le scanner
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

  // Calcul Tricount (articles ignorés exclus)
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
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-lg mx-auto px-4 py-8">

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <ScanLine size={20} className="text-green-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">Scanner un ticket</h1>
              <p className="text-xs text-gray-400">Extrait les articles et calcule la répartition</p>
            </div>
          </div>

          {/* Zone de dépôt */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => !imagePreview && step !== 'loading' && fileInputRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
              imagePreview ? 'border-green-300 bg-green-50'
              : dragOver ? 'border-green-400 bg-green-50'
              : step === 'loading' ? 'border-gray-200 bg-white'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
            }`}
          >
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Ticket" className="w-full max-h-72 object-contain" />
                {step !== 'loading' && (
                  <button
                    onClick={e => { e.stopPropagation(); setImagePreview(null); setImageFile(null) }}
                    className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-md text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-14 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-300">
                  <Upload size={26} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Déposez une photo ici</p>
                  <p className="text-xs text-gray-400 mt-0.5">ou utilisez les boutons ci-dessous</p>
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
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <Camera size={16} />Caméra
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <Upload size={16} />Galerie
              </button>
            </div>
          )}

          <button
            onClick={handleAnalyser}
            disabled={!imageFile || step === 'loading'}
            className={`mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all ${
              imageFile && step !== 'loading'
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-100 active:scale-[0.98]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {step === 'loading' ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-green-500 border-t-transparent animate-spin shrink-0" />
                <span className="truncate">{STATUS_LABELS[ocrStatus] ?? 'Démarrage…'}</span>
              </>
            ) : (
              <><ScanLine size={16} />Analyser le ticket</>
            )}
          </button>

          {step === 'loading' && (
            <div className="mt-3 space-y-1.5">
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                {ocrStatus === 'recognizing text' ? (
                  <div className="bg-green-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${ocrProgress}%` }} />
                ) : (
                  <div className="h-full w-2/5 bg-green-300 rounded-full animate-pulse" />
                )}
              </div>
              {ocrStatus === 'recognizing text' && (
                <p className="text-center text-xs text-gray-400">{ocrProgress}%</p>
              )}
              {ocrStatus === 'loading language traineddata' && (
                <p className="text-center text-[10px] text-gray-400">
                  Première utilisation : téléchargement du dictionnaire (~10 Mo)
                </p>
              )}
            </div>
          )}

        </main>
      </div>
    )
  }

  // ---- ERREUR ----
  if (step === 'erreur') {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-lg mx-auto px-4 py-8">
          <div className="flex flex-col items-center gap-5 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
              <AlertCircle size={32} className="text-orange-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-700 mb-2">Aucun article reconnu</h2>
              <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
                Le texte extrait ne contient pas d'articles avec prix identifiables.
                Essayez avec une photo plus nette, bien cadrée et éclairée.
              </p>
            </div>
            <button onClick={handleReset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
              <RotateCcw size={15} />Réessayer
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ---- ÉTAPE 2 : Résultats + Tricount ----
  const nbMoi  = articlesActifs.filter(a => articleSplits[a.id] === 'me').length
  const nbAli  = articlesActifs.filter(a => articleSplits[a.id] === 'ali').length
  const nbBoth = articlesActifs.filter(a => (articleSplits[a.id] ?? 'both') === 'both').length
  const nbIgnored = articles.filter(a => a.ignored).length

  return (
    <div className="min-h-screen bg-gray-50 pb-36">
      <main className="max-w-3xl mx-auto px-4 py-6">

        {/* En-tête */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-500" />
            <div>
              <p className="text-sm font-bold text-gray-800">{articlesActifs.length} articles reconnus{nbIgnored > 0 && <span className="text-gray-400 font-normal"> · {nbIgnored} ignoré{nbIgnored > 1 ? 's' : ''}</span>}</p>
              <p className="text-xs text-gray-400">👦 {nbMoi} · 👥 {nbBoth} · 👩 {nbAli}</p>
            </div>
          </div>
          <button onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors">
            <RotateCcw size={12} />Nouveau ticket
          </button>
        </div>

        {/* Légende */}
        <div className="flex gap-4 mb-4">
          {SPLIT_OPTS.map(opt => (
            <span key={opt.val} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-2.5 h-2.5 rounded-full inline-block ${opt.dot}`} />
              {opt.emoji} {opt.label}
            </span>
          ))}
        </div>

        {/* Liste des articles */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
          {articles.map(article => {
            const split = articleSplits[article.id] ?? 'both'
            const defaultSplit = article.matchedNom ? getSplit(article.matchedNom) : 'both'
            const isModified = article.matchedNom && split !== defaultSplit
            const justSaved = recentlySaved.has(article.id)
            return (
              <div
                key={article.id}
                className={`flex items-start gap-3 px-4 py-3 border-l-4 transition-colors ${
                  article.ignored ? 'border-l-gray-200 opacity-50' : BORDER_COLORS[split]
                }`}
              >
                {/* Nom + catégorie + matching */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${article.ignored ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {article.nom}
                  </p>
                  {article.receiptCategory && (
                    <p className="text-[10px] text-gray-300 mt-0.5">{article.receiptCategory}</p>
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

                {/* Prix */}
                <span className={`text-sm font-bold tabular-nums shrink-0 pt-0.5 ${article.ignored ? 'text-gray-300 line-through' : 'text-gray-700'}`}>
                  {article.prix.toFixed(2)} €
                </span>

                {/* Split toggle */}
                {!article.ignored && (
                  <div className="shrink-0 pt-0.5">
                    <SplitToggle value={split} onChange={val => setArticleSplit(article.id, val)} />
                  </div>
                )}

                {/* Mémoriser / Ignorer */}
                <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                  {!article.ignored && (
                    <>
                      {justSaved ? (
                        <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                          <BookmarkCheck size={13} />
                        </span>
                      ) : isModified ? (
                        <button
                          onClick={() => memoriserDefaut(article)}
                          title={`Mémoriser "${split === 'me' ? 'Moi' : split === 'ali' ? 'Ali' : '50/50'}" pour ${article.matchedNom}`}
                          className="text-gray-300 hover:text-green-600 transition-colors"
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
                    className={`transition-colors ${article.ignored ? 'text-gray-400 hover:text-green-500' : 'text-gray-200 hover:text-red-400'}`}
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
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-xl z-30">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-stretch gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Total ticket</p>
              <p className="text-2xl font-bold text-gray-800 tabular-nums">{totalTicket.toFixed(2)} €</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{articlesActifs.length} articles</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="flex-1 text-center">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-0.5">👦 Moi</p>
              <p className="text-2xl font-bold text-blue-600 tabular-nums">{partMoi.toFixed(2)} €</p>
              <p className="text-[10px] text-blue-400 mt-0.5">{nbMoi} solo + {nbBoth} partagés</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="flex-1 text-center">
              <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest mb-0.5">👩 Ali</p>
              <p className="text-2xl font-bold text-pink-600 tabular-nums">{partAli.toFixed(2)} €</p>
              <p className="text-[10px] text-pink-400 mt-0.5">{nbAli} solo + {nbBoth} partagés</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Scanner
