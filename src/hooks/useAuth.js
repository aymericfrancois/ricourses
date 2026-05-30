import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// Lit la session Supabase courante et la garde synchronisée via le listener
// onAuthStateChange. Pendant la phase initiale (avant que getSession() ait
// répondu), `loading` est `true` pour éviter le flash Login → app.
export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}
