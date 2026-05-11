'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import type { TableRow } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerRow = Pick<
  TableRow<'player_profiles'>,
  'id' | 'display_name' | 'first_name' | 'last_name' | 'gender' | 'nationality' | 'ranking_points' | 'is_active' | 'created_at'
>

type ActionResult<T = void> =
  | { data: T; error?: never }
  | { error: string; data?: never }

// ─── Schéma ───────────────────────────────────────────────────────────────────

export const addPlayerSchema = z.object({
  first_name:   z.string().min(2, 'Minimum 2 caractères').max(50),
  last_name:    z.string().min(2, 'Minimum 2 caractères').max(50),
  display_name: z.string().max(80).optional(),
  gender:       z.enum(['M', 'F']),
  nationality:  z.string().length(2).default('MU'),
})
export type AddPlayerInput = z.infer<typeof addPlayerSchema>

// ─── getOrgId ─────────────────────────────────────────────────────────────────

async function requireOrgAdmin(orgSlug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié', supabase: null, orgId: null }

  const orgRes = await supabase.from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  const org    = orgRes.data as { id: string } | null
  if (!org) return { error: 'Organisation introuvable', supabase: null, orgId: null }

  const mRes = await supabase.from('org_members').select('role').eq('org_id', org.id).eq('user_id', user.id).maybeSingle()
  const m    = mRes.data as { role: string } | null
  if (!m || !['super_admin','federation_admin','club_admin'].includes(m.role)) {
    return { error: 'Droits insuffisants', supabase: null, orgId: null }
  }
  return { error: null, supabase, orgId: org.id }
}

// ─── addPlayer ────────────────────────────────────────────────────────────────

export async function addPlayer(
  orgSlug: string,
  input: AddPlayerInput,
): Promise<ActionResult<{ id: string }>> {
  const { error, orgId } = await requireOrgAdmin(orgSlug)
  if (error || !orgId) return { error: error ?? 'Erreur' }

  const parsed = addPlayerSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Données invalides' }

  const d    = parsed.data
  const name = d.display_name || `${d.first_name} ${d.last_name}`

  // Admin client bypasses FK constraint (player may not have an auth account)
  const admin = createAdminClient()
  const { data, error: insertErr } = await admin
    .from('player_profiles')
    .insert({
      org_id:       orgId,
      display_name: name,
      first_name:   d.first_name,
      last_name:    d.last_name,
      gender:       d.gender,
      nationality:  d.nationality,
      is_managed:   true,
    } as never)
    .select('id')
    .single()

  if (insertErr) return { error: insertErr.message }
  return { data: { id: (data as { id: string }).id } }
}

// ─── getPlayers ───────────────────────────────────────────────────────────────

export async function getPlayers(orgSlug: string): Promise<PlayerRow[]> {
  const supabase = await createClient()

  const orgRes = await supabase.from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  const org    = orgRes.data as { id: string } | null
  if (!org) return []

  const { data } = await supabase
    .from('player_profiles')
    .select('id, display_name, first_name, last_name, gender, nationality, ranking_points, is_active, created_at')
    .eq('org_id', org.id)
    .eq('is_active', true)
    .order('ranking_points', { ascending: false })

  return (data ?? []) as PlayerRow[]
}
