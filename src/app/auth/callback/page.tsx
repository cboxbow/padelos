'use client'

/**
 * Page de callback Supabase Auth.
 *
 * Pourquoi client et non route.ts ?
 * Les hash fragments (#error=..., #access_token=...) sont TOUJOURS
 * traités côté client — ils ne parviennent jamais au serveur.
 * Un `route.ts` ne peut lire que les query params (?code=).
 *
 * Cette page gère les deux cas :
 *  - PKCE flow   : ?code=xxx   → exchangeCodeForSession via browser client
 *  - Hash errors : #error=...  → lecture directe du hash + redirect login
 */

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { completeOnboarding, getUserOrgSlug } from '@/app/actions/auth'
import { GoldDivider } from '@/components/mpl'
import type { OrgType } from '@/types'

// ─── Messages d'erreur FIP ────────────────────────────────────────────────────

const AUTH_ERRORS: Record<string, string> = {
  otp_expired:    'lien_expire',
  access_denied:  'acces_refuse',
  missing_code:   'session_introuvable',
  auth_failed:    'erreur_auth',
  no_session:     'session_introuvable',
}

export default function AuthCallbackPage() {
  const router  = useRouter()
  const handled = useRef(false)   // évite double-exécution en Strict Mode

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    void handleCallback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCallback() {
    const params     = new URLSearchParams(window.location.search)
    const hash       = window.location.hash         // "#error=..." ou "#access_token=..."
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : '')
    const flow       = params.get('flow')            // 'register' si vient du register form
    const next       = params.get('next')

    // ── 1. Erreur dans le hash (OTP expiré, accès refusé…) ───────────────────
    if (hashParams.get('error')) {
      const errCode = hashParams.get('error_code') ?? 'auth_failed'
      const errKey  = AUTH_ERRORS[errCode] ?? 'erreur_auth'
      router.replace(`/login?error=${errKey}`)
      return
    }

    // ── 2. Établir la session ────────────────────────────────────────────────
    //
    // Cette page client est désormais uniquement appelée dans deux cas :
    //
    // A) flow=register : le serveur /callback a déjà échangé le code et
    //    établi la session. getSession() la trouve directement dans les cookies.
    //    Pas besoin de réexchanger.
    //
    // B) Hash flow (#access_token) : liens anciens / OAuth implicite.
    //    getSession() détecte et traite le hash automatiquement.
    //
    // Note : le login magic link passe désormais par /callback (server route)
    // et ne devrait plus arriver ici avec ?code=. Mais on garde le fallback
    // pour compatibilité.
    const supabase = createClient()
    const code     = params.get('code')

    if (code) {
      // Fallback : si un code arrive quand même, tenter l'échange
      // (ne devrait arriver qu'en développement ou test direct d'URL)
      const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code)
      if (exchErr) {
        console.error('[auth/callback] exchangeCodeForSession failed:', exchErr.message)
        // Ne pas router.replace ici — getSession() peut avoir la session via cookies
      }
    }

    // getSession() lit les cookies de session (établis par /callback ou par l'échange ci-dessus)
    // et traite également les hash tokens (#access_token=...) si présents.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user) {
      router.replace('/login?error=lien_expire')
      return
    }

    const user = session.user
    const meta = user.user_metadata ?? {}

    // ── 3. Onboarding (nouveau user via register flow) ────────────────────────
    if (flow === 'register' && meta.org_slug && meta.org_name && meta.org_type) {
      const result = await completeOnboarding({
        userId:      user.id,
        firstName:   (meta.first_name as string)  ?? '',
        lastName:    (meta.last_name as string)   ?? '',
        displayName: (meta.display_name as string) ?? user.email ?? 'Joueur',
        orgName:     meta.org_name as string,
        orgType:     meta.org_type as OrgType,
        orgSlug:     meta.org_slug as string,
      })

      if (result.error) {
        router.replace(`/login?error=onboarding_failed`)
        return
      }

      router.replace(`/${result.orgSlug}`)
      return
    }

    // ── 4. Utilisateur existant — retrouver son org ───────────────────────────
    if (next) {
      router.replace(next)
      return
    }

    const orgSlug = await getUserOrgSlug(user.id)

    if (orgSlug) {
      router.replace(`/${orgSlug}`)
      return
    }

    // Utilisateur authentifié mais sans organisation → rediriger vers l'inscription
    // pour qu'il crée son org (cas : magic link login sans avoir fait le register)
    router.replace('/register?info=no_org')
  }

  return (
    <div className="min-h-screen bg-court-deep flex flex-col items-center justify-center gap-6">
      <h1 className="font-display text-5xl text-gold-gradient uppercase tracking-widest">
        PadelOS
      </h1>
      <GoldDivider withDiamond className="max-w-[180px] w-full" />
      <div className="flex items-center gap-3 text-muted-foreground">
        <Spinner />
        <span className="font-body text-sm tracking-wider uppercase">
          Connexion en cours…
        </span>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-gold"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
