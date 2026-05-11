'use server'

import { createClient } from '@/lib/supabase/server'
import {
  createTournamentSchema,
  toTournamentSlug,
  type CreateTournamentInput,
} from '@/lib/validations/tournament'
import type { TableRow } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { data: T; error?: never }
  | { error: string; data?: never }

type TournamentListRow = Pick<
  TableRow<'tournaments'>,
  'id' | 'name' | 'slug' | 'category' | 'status' | 'start_date' | 'end_date' | 'max_pairs' | 'created_at'
>

// ─── Helpers privés ───────────────────────────────────────────────────────────

/** Résout l'org_id + vérifie que l'utilisateur est admin */
async function requireOrgAdmin(orgSlug: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null, orgId: null }

  const orgResult = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .maybeSingle()
  const org = orgResult.data as { id: string } | null
  if (!org) return { error: 'Organisation introuvable' as const, supabase: null, orgId: null }

  const memberResult = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()
  const member = memberResult.data as { role: string } | null

  const ADMIN_ROLES = ['super_admin', 'federation_admin', 'club_admin']
  if (!member || !ADMIN_ROLES.includes(member.role)) {
    return { error: 'Droits insuffisants' as const, supabase: null, orgId: null }
  }

  return { error: null, supabase, orgId: org.id }
}

// ─── createTournament ─────────────────────────────────────────────────────────

export async function createTournament(
  orgSlug: string,
  input: CreateTournamentInput,
): Promise<ActionResult<{ slug: string }>> {
  const { error: authError, supabase, orgId } = await requireOrgAdmin(orgSlug)
  if (authError || !supabase || !orgId) return { error: authError ?? 'Erreur inattendue' }

  const parsed = createTournamentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Données invalides' }

  const d = parsed.data
  const slug = toTournamentSlug(d.name)

  // Cast needed: Supabase generics infer insert payload as never[] for partial selects
  const insertPayload = {
    org_id:           orgId,
    name:             d.name,
    slug,
    category:         d.category,
    format:           d.format,
    start_date:       d.start_date,
    end_date:         d.end_date,
    registration_end: d.registration_end ?? null,
    max_pairs:        d.max_pairs,
    venue:            d.venue ?? null,
    city:             d.city ?? null,
    description:      d.description ?? null,
    prize_money:      d.prize_money ?? null,
    status:           'draft' as const,
  }

  const { data, error } = await supabase
    .from('tournaments')
    .insert(insertPayload as never)
    .select('slug')
    .single()

  if (error) {
    // Slug collision → append timestamp
    if (error.code === '23505') {
      const slugAlt = `${slug}-${Date.now().toString(36)}`
      const { data: data2, error: err2 } = await supabase
        .from('tournaments')
        .insert({ ...insertPayload, slug: slugAlt } as never)
        .select('slug')
        .single()
      if (err2) return { error: err2.message }
      return { data: { slug: (data2 as { slug: string }).slug } }
    }
    return { error: error.message }
  }

  return { data: { slug: (data as { slug: string }).slug } }
}

// ─── getTournaments ───────────────────────────────────────────────────────────

export async function getTournaments(orgSlug: string): Promise<TournamentListRow[]> {
  const supabase = await createClient()

  const orgResult = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .maybeSingle()
  const org = orgResult.data as { id: string } | null
  if (!org) return []

  const { data } = await supabase
    .from('tournaments')
    .select('id, name, slug, category, status, start_date, end_date, max_pairs, created_at')
    .eq('org_id', org.id)
    .order('start_date', { ascending: false })

  return (data ?? []) as TournamentListRow[]
}

// ─── getDashboardStats ────────────────────────────────────────────────────────

interface DashboardStats {
  totalTournaments:  number
  activeTournaments: number
  totalPlayers:      number
  openRegistrations: number
}

export async function getDashboardStats(orgSlug: string): Promise<DashboardStats> {
  const supabase = await createClient()

  const orgResult = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .maybeSingle()
  const org = orgResult.data as { id: string } | null
  if (!org) return { totalTournaments: 0, activeTournaments: 0, totalPlayers: 0, openRegistrations: 0 }

  const [tAll, tActive, tReg, players] = await Promise.all([
    supabase.from('tournaments').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
    supabase.from('tournaments').select('id', { count: 'exact', head: true }).eq('org_id', org.id).eq('status', 'active'),
    supabase.from('tournaments').select('id', { count: 'exact', head: true }).eq('org_id', org.id).eq('status', 'registration'),
    supabase.from('player_profiles').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
  ])

  return {
    totalTournaments:  tAll.count    ?? 0,
    activeTournaments: tActive.count ?? 0,
    totalPlayers:      players.count ?? 0,
    openRegistrations: tReg.count    ?? 0,
  }
}
