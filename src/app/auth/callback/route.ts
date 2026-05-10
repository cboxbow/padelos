import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { OrgType } from '@/types'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const flow = searchParams.get('flow') // 'register' | undefined
  const next = searchParams.get('next') // URL de redirection post-login

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  // ── Exchange code → session ─────────────────────────────────────────────────
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
  if (sessionError) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  // ── Vérifier si le joueur a déjà un profil ──────────────────────────────────
  const { data: existingProfile } = await supabase
    .from('player_profiles')
    .select('id, org_id')
    .eq('id', user.id)
    .maybeSingle()

  // ── Retour utilisateur existant ─────────────────────────────────────────────
  if (existingProfile) {
    if (next) return NextResponse.redirect(`${origin}${next}`)

    // Trouver l'org de l'utilisateur
    const { data: org } = await supabase
      .from('organizations')
      .select('slug')
      .eq('id', existingProfile.org_id)
      .single()

    const orgSlug = org?.slug ?? 'dashboard'
    return NextResponse.redirect(`${origin}/${orgSlug}`)
  }

  // ── Nouveau utilisateur — onboarding ────────────────────────────────────────
  const meta = user.user_metadata ?? {}
  const admin = createAdminClient()

  // Créer l'organisation si les métadonnées sont présentes (flow register)
  if (flow === 'register' && meta.org_slug && meta.org_name && meta.org_type) {
    // Vérifier si le slug est déjà pris
    const { data: existingOrg } = await admin
      .from('organizations')
      .select('id, slug')
      .eq('slug', meta.org_slug as string)
      .maybeSingle()

    const org = existingOrg ?? await (async () => {
      const { data } = await admin
        .from('organizations')
        .insert({
          name: meta.org_name as string,
          slug: meta.org_slug as string,
          type: meta.org_type as OrgType,
        })
        .select('id, slug')
        .single()
      return data
    })()

    if (org) {
      // Créer le player_profile (satisfait la policy `id = auth.uid()`)
      await supabase.from('player_profiles').insert({
        id:           user.id,
        org_id:       org.id,
        display_name: (meta.display_name as string) || (user.email ?? 'Joueur'),
        first_name:   (meta.first_name as string) || null,
        last_name:    (meta.last_name as string)  || null,
        gender:       'M',  // défaut — modifiable dans les paramètres
      })

      // Créer le membre org comme admin (premier membre = fédération admin)
      await admin.from('org_members').insert({
        org_id:  org.id,
        user_id: user.id,
        role:    'federation_admin',
      })

      return NextResponse.redirect(`${origin}/${org.slug}`)
    }
  }

  // Fallback : profil sans org (connexion magic link sans flow register)
  // Créer un profil minimal sans org — l'utilisateur rejoindra via invitation
  return NextResponse.redirect(`${origin}/login?error=no_org&email=${encodeURIComponent(user.email ?? '')}`)
}
