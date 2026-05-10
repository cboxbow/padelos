'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { OrgType, TableRow, TableInsert } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingParams {
  userId:      string
  firstName:   string
  lastName:    string
  displayName: string
  orgName:     string
  orgType:     OrgType
  orgSlug:     string
}

type ActionResult =
  | { orgSlug: string; error?: never }
  | { error: string; orgSlug?: never }

// ─── completeOnboarding ───────────────────────────────────────────────────────

/**
 * Crée le player_profile + organization + org_member pour un nouveau user.
 * Appelé depuis le callback page.tsx (client) après établissement de la session.
 * Utilise l'admin client pour org + org_member (contourne RLS).
 */
export async function completeOnboarding(
  params: OnboardingParams
): Promise<ActionResult> {
  const supabase = await createClient()
  const admin    = createAdminClient()

  // Vérifier si le profil existe déjà (re-clic sur magic link)
  const profileResult = await supabase
    .from('player_profiles')
    .select('id, org_id')
    .eq('id', params.userId)
    .maybeSingle()

  const existing = profileResult.data as Pick<TableRow<'player_profiles'>, 'id' | 'org_id'> | null

  if (existing) {
    const orgResult = await supabase
      .from('organizations')
      .select('slug')
      .eq('id', existing.org_id)
      .maybeSingle()
    const orgRow = orgResult.data as Pick<TableRow<'organizations'>, 'slug'> | null
    return { orgSlug: orgRow?.slug ?? 'dashboard' }
  }

  // Créer ou récupérer l'organisation (slug unique)
  const existingOrgResult = await admin
    .from('organizations')
    .select('id, slug')
    .eq('slug', params.orgSlug)
    .maybeSingle()

  const existingOrg = existingOrgResult.data as Pick<TableRow<'organizations'>, 'id' | 'slug'> | null

  let orgId: string
  let orgSlug: string

  if (existingOrg) {
    orgId   = existingOrg.id
    orgSlug = existingOrg.slug
  } else {
    const createOrgResult = await admin
      .from('organizations')
      .insert({
        name: params.orgName,
        slug: params.orgSlug,
        type: params.orgType,
      })
      .select('id, slug')
      .single()

    const newOrg = createOrgResult.data as Pick<TableRow<'organizations'>, 'id' | 'slug'> | null
    if (!newOrg) return { error: 'Impossible de créer l\'organisation.' }

    orgId   = newOrg.id
    orgSlug = newOrg.slug
  }

  // Créer le player_profile (policy `id = auth.uid()` satisfaite)
  // Cast explicite : inférence Supabase sur .insert() peut retourner never
  const profileInsert: TableInsert<'player_profiles'> = {
    id:           params.userId,
    org_id:       orgId,
    display_name: params.displayName || params.firstName || 'Joueur',
    first_name:   params.firstName || null,
    last_name:    params.lastName  || null,
    gender:       'M',
  }
  const { error: profileError } = await supabase
    .from('player_profiles')
    .insert(profileInsert as never)

  if (profileError) return { error: profileError.message }

  // Créer le membre org (admin client — contourne RLS is_org_admin)
  await admin.from('org_members').insert({
    org_id:  orgId,
    user_id: params.userId,
    role:    'federation_admin',
  })

  return { orgSlug }
}

// ─── getOrCreateUserOrg ───────────────────────────────────────────────────────

/**
 * Retourne le slug de l'org principale d'un utilisateur existant.
 * Utilisé dans le callback pour les connexions classiques (non-register).
 */
export async function getUserOrgSlug(userId: string): Promise<string | null> {
  const supabase = await createClient()

  const memberResult = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  const member = memberResult.data as { org_id: string } | null
  if (!member) return null

  const orgResult = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', member.org_id)
    .maybeSingle()

  const org = orgResult.data as { slug: string } | null
  return org?.slug ?? null
}
