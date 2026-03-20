import { useState, useRef } from 'react'
import { ScanLine, Upload, Camera, RotateCcw, CheckCircle2 } from 'lucide-react'
import { useMagasinContext } from '../context/MagasinContext'

// Données simulées — représentatives d'un vrai ticket
const MOCK_ARTICLES = [
  { id: 1, nom: 'LARDONS FUMÉS 200G', prix: 2.15, matchedNom: 'Lardons' },
  { id: 2, nom: 'SPAGHETTIS 500G', prix: 1.05, matchedNom: 'Spaghetti' },
  { id: 3, nom: 'TOMATES GRAPPE 500G', prix: 2.90, matchedNom: 'Tomates' },
  { id: 4, nom: 'CRÈME FRAÎCHE 20CL', prix: 1.40, matchedNom: 'Crème fraiche' },
  { id: 5, nom: 'THON AU NATUREL', prix: 3.20, matchedNom: 'Thon' },
  { id: 6, nom: 'YAOURT NATURE X8', prix: 2.40, matchedNom: null },
  { id: 7, nom: 'BEURRE DEMI SEL 250G', prix: 2.30, matchedNom: null },
  { id: 8, nom: 'POULET FERMIER 1KG', prix: 8.50, matchedNom: 'Poulet' },
  { id: 9, nom: 'SAUMON ATLANTIQUE', prix: 6.80, matchedNom: 'Saumon' },
  { id: 10, nom: 'MAÏS DOUX 285G', prix: 1.20, matchedNom: 'Maïs' },
]

const SPLIT_OPTS = [
  { val: 'me', label: 'Moi', emoji: '👦', active: 'bg-blue-500 text-white', dot: 'bg-blue-400' },
  { val: 'both', label: '50/50', emoji: '👥', active: 'bg-green-500 text-white', dot: 'bg-green-400' },
  { val: 'ali', label: 'Ali', emoji: '👩', active: 'bg-pink-500 text-white', dot: 'bg-pink-400' },
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

function Scanner() {
  const { getSplit } = useMagasinContext()

  const [step, setStep] = useState('capture') // 'capture' | 'loading' | 'resultat'
  const [imagePreview, setImagePreview] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [articleSplits, setArticleSplits] = useState({})

  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  function handleFileSelected(file) {
    if (!file || !file.type.startsWith('image/')) return
    setImagePreview(URL.createObjectURL(file))
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFileSelected(e.dataTransfer.files?.[0])
  }

  function handleAnalyser() {
    setStep('loading')
    setTimeout(() => {
      const initial = {}
      MOCK_ARTICLES.forEach(a => {
        initial[a.id] = a.matchedNom ? getSplit(a.matchedNom) : 'both'
      })
      setArticleSplits(initial)
      setStep('resultat')
    }, 2000)
  }

  function handleReset() {
    setStep('capture')
    setImagePreview(null)
    setArticleSplits({})
  }

  function setArticleSplit(id, val) {
    setArticleSplits(prev => ({ ...prev, [id]: val }))
  }

  // ---- Calcul Tricount ----
  const totalTicket = MOCK_ARTICLES.reduce((sum, a) => sum + a.prix, 0)
  const partMoi = MOCK_ARTICLES.reduce((sum, a) => {
    const split = articleSplits[a.id] ?? 'both'
    if (split === 'me') return sum + a.prix
    if (split === 'both') return sum + a.prix / 2
    return sum
  }, 0)
  const partAli = totalTicket - partMoi

  // ---- ÉTAPE 1 : Capture ----
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
              imagePreview
                ? 'border-green-300 bg-green-50'
                : dragOver
                  ? 'border-green-400 bg-green-50'
                  : step === 'loading'
                    ? 'border-gray-200 bg-white'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
            }`}
          >
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Ticket" className="w-full max-h-72 object-contain" />
                {step !== 'loading' && (
                  <button
                    onClick={e => { e.stopPropagation(); setImagePreview(null) }}
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

          {/* Boutons sélection image */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => handleFileSelected(e.target.files?.[0])} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => handleFileSelected(e.target.files?.[0])} />

          {!imagePreview && step !== 'loading' && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Camera size={16} />Caméra
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Upload size={16} />Galerie
              </button>
            </div>
          )}

          {/* Bouton Analyser */}
          <button
            onClick={handleAnalyser}
            disabled={!imagePreview || step === 'loading'}
            className={`mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all ${
              imagePreview && step !== 'loading'
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-100 active:scale-[0.98]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {step === 'loading' ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
                Lecture du ticket en cours...
              </>
            ) : (
              <>
                <ScanLine size={16} />
                Analyser le ticket
              </>
            )}
          </button>

          {step === 'loading' && (
            <p className="text-center text-xs text-gray-400 mt-3 animate-pulse">
              Extraction des articles et des prix…
            </p>
          )}

        </main>
      </div>
    )
  }

  // ---- ÉTAPE 2 : Résultats ----
  const nbMoi = MOCK_ARTICLES.filter(a => articleSplits[a.id] === 'me').length
  const nbAli = MOCK_ARTICLES.filter(a => articleSplits[a.id] === 'ali').length
  const nbBoth = MOCK_ARTICLES.filter(a => (articleSplits[a.id] ?? 'both') === 'both').length

  return (
    <div className="min-h-screen bg-gray-50 pb-36">
      <main className="max-w-lg mx-auto px-4 py-6">

        {/* En-tête résultats */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-500" />
            <div>
              <p className="text-sm font-bold text-gray-800">{MOCK_ARTICLES.length} articles reconnus</p>
              <p className="text-xs text-gray-400">
                👦 {nbMoi} · 👥 {nbBoth} · 👩 {nbAli}
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors"
          >
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
          {MOCK_ARTICLES.map(article => {
            const split = articleSplits[article.id] ?? 'both'
            return (
              <div
                key={article.id}
                className={`flex items-center gap-3 px-4 py-3 border-l-4 transition-colors ${BORDER_COLORS[split]}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{article.nom}</p>
                  {article.matchedNom && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      → reconnu : <span className="font-medium text-gray-500">{article.matchedNom}</span>
                    </p>
                  )}
                </div>
                <span className="text-sm font-bold text-gray-700 tabular-nums shrink-0">
                  {article.prix.toFixed(2)} €
                </span>
                <SplitToggle value={split} onChange={val => setArticleSplit(article.id, val)} />
              </div>
            )
          })}
        </div>

      </main>

      {/* ---- Panneau Tricount fixe en bas ---- */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-xl z-30">
        <div className="max-w-lg mx-auto px-4 py-4">

          <div className="flex items-stretch gap-4">

            {/* Total */}
            <div className="flex-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Total ticket</p>
              <p className="text-2xl font-bold text-gray-800 tabular-nums">{totalTicket.toFixed(2)} €</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{MOCK_ARTICLES.length} articles</p>
            </div>

            <div className="w-px bg-gray-100" />

            {/* Part Moi */}
            <div className="flex-1 text-center">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-0.5">👦 Moi</p>
              <p className="text-2xl font-bold text-blue-600 tabular-nums">{partMoi.toFixed(2)} €</p>
              <p className="text-[10px] text-blue-400 mt-0.5">
                {nbMoi} solo + {nbBoth} partagés
              </p>
            </div>

            <div className="w-px bg-gray-100" />

            {/* Part Ali */}
            <div className="flex-1 text-center">
              <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest mb-0.5">👩 Ali</p>
              <p className="text-2xl font-bold text-pink-600 tabular-nums">{partAli.toFixed(2)} €</p>
              <p className="text-[10px] text-pink-400 mt-0.5">
                {nbAli} solo + {nbBoth} partagés
              </p>
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}

export default Scanner
