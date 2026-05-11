/**
 * GET /callback
 *
 * Point d'entrée server-side pour tous les retours Supabase Auth :
 *   - Magic link login     (signInWithOtp → emailRedirectTo: /callback)
 *   - OAuth Google         (signInWithOAuth → redirectTo: /callback)
 *
 * Le flow register utilise /auth/callback (client page) car il a besoin
 * d'appeler completeOnboarding() après l'échange.
 *
 * Pourquoi server route plutôt que client page pour le login ?
 * ─────────────────────────────────────────────────────────────
 * @supabase/ssr stocke le code verifier PKCE dans un cookie.
 * Le handler serveur reçoit tous les cookies du navigateur dès la requête
 * initiale, avant toute hydratation React, donc l'échange réussit de façon
 * fiable même si le lien est ouvert dans un nouvel onglet ou après
 * un rechargement.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies }                                 from 'next/headers'
import { NextResponse }                            from 'next/server'
import type { NextRequest }                        from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl  = new URL(request.url)
  const code        = requestUrl.searchParams.get('code')
  const errorParam  = requestUrl.searchParams.get('error')
  const errorDesc   = requestUrl.searchParams.get('error_description')

  // ── Erreur explicite retournée par Supabase ────────────────────────────────
  if (errorParam) {
    console.error('[callback] Supabase auth error:', errorParam, errorDesc)
    const errKey = errorParam === 'access_denied' ? 'acces_refuse' : 'lien_expire'
    return NextResponse.redirect(new URL(`/login?error=${errKey}`, request.url))
  }

  // ── Pas de code → pas de flow PKCE actif ──────────────────────────────────
  if (!code) {
    // Le lien peut être un hash flow (#access_token) géré côté client :
    // rediriger vers la client page qui sait lire le hash.
    return NextResponse.redirect(new URL('/auth/callback', request.url))
  }

  // ── Échange du code PKCE ───────────────────────────────────────────────────
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    },
  )

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('[callback] exchangeCodeForSession failed:', exchangeError.message)
    return NextResponse.redirect(new URL('/login?error=lien_expire', request.url))
  }

  // ── Session établie — récupérer l'utilisateur ─────────────────────────────
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('[callback] getUser failed after exchange:', userError?.message)
    return NextResponse.redirect(new URL('/login?error=session_introuvable', request.url))
  }

  // ── Détecter le flow register (métadonnées org présentes) ─────────────────
  // Si l'utilisateur a des métadonnées d'org, les traiter via la client page
  // de register qui appelle completeOnboarding().
  const meta = user.user_metadata ?? {}
  if (meta.org_slug && meta.org_name && meta.org_type) {
    // La session est déjà établie dans les cookies.
    // La client page n'aura qu'à appeler getSession() + completeOnboarding().
    return NextResponse.redirect(new URL('/auth/callback?flow=register', request.url))
  }

  // ── Trouver l'organisation de l'utilisateur ───────────────────────────────
  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (member?.org_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('slug')
      .eq('id', member.org_id)
      .maybeSingle()

    if (org?.slug) {
      return NextResponse.redirect(new URL(`/${org.slug}`, request.url))
    }
  }

  // ── Utilisateur sans organisation ─────────────────────────────────────────
  // Cas : magic link valide mais aucune org associée (compte incomplet).
  return NextResponse.redirect(new URL('/register?info=no_org', request.url))
}
