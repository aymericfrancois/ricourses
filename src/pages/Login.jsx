import { useState } from 'react'
import { LogIn, Mail, KeyRound, Loader2 } from 'lucide-react'
import { supabase } from '../supabaseClient'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
    // En cas de succès, useAuth() détecte automatiquement la session via
    // onAuthStateChange — App.jsx re-render avec les routes normales.
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 anim-in">
      <div className="w-full max-w-sm glass-strong sheen p-7 flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2">
          <div className="accent-bg rounded-2xl w-12 h-12 flex items-center justify-center font-extrabold text-lg shadow-sm">
            R
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight ink">Ricourses</h1>
          <p className="text-xs ink-3">Connexion requise pour accéder à l'app</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 ink-3 pointer-events-none" />
            <input
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@exemple.com"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-white/70 bg-white/60 text-sm ink placeholder:text-[color:var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
            />
          </div>

          <div className="relative">
            <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 ink-3 pointer-events-none" />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-white/70 bg-white/60 text-sm ink placeholder:text-[color:var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50/70 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl accent-bg text-sm font-semibold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LogIn size={16} />
            )}
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default Login
