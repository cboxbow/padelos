import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { TableRow } from '@/types'

type EntryRow = TableRow<'tournament_entries'>
type TournRow = Pick<TableRow<'tournaments'>, 'id' | 'max_pairs' | 'org_id' | 'status'>

// ─── Schéma POST ──────────────────────────────────────────────────────────────

const addEntrySchema = z.object({
  player1_name:  z.string().min(2, 'Minimum 2 caractères').max(80),
  player2_name:  z.string().min(2, 'Minimum 2 caractères').max(80),
  seed:          z.coerce.number().int().min(1).optional(),
  direct_entry:  z.boolean().default(false),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getTournamentAndCheckAdmin(slug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié', supabase: null, tournament: null }

  const tResult = await supabase
    .from('tournaments')
    .select('id, max_pairs, org_id, status')
    .eq('slug', slug)
    .maybeSingle()
  const tournament = tResult.data as TournRow | null
  if (!tournament) return { error: 'Tournoi introuvable', supabase: null, tournament: null }

  const mResult = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', tournament.org_id)
    .eq('user_id', user.id)
    .maybeSingle()
  const member = mResult.data as { role: string } | null
  const ADMIN_ROLES = ['super_admin','federation_admin','club_admin']
  if (!member || !ADMIN_ROLES.includes(member.role)) {
    return { error: 'Droits insuffisants', supabase: null, tournament: null }
  }

  return { error: null, supabase, tournament }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = await createClient()

  const tResult = await supabase
    .from('tournaments')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  const tournament = tResult.data as { id: string } | null
  if (!tournament) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const { data } = await supabase
    .from('tournament_entries')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('seed', { ascending: true, nullsFirst: false })
    .order('registered_at', { ascending: true })

  return NextResponse.json({ entries: (data ?? []) as EntryRow[] })
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const { error, supabase, tournament } = await getTournamentAndCheckAdmin(slug)
  if (error || !supabase || !tournament) {
    return NextResponse.json({ error: error ?? 'Erreur' }, { status: 401 })
  }

  // Vérifier que le tournoi accepte encore des inscriptions
  if (!['draft', 'registration'].includes(tournament.status)) {
    return NextResponse.json(
      { error: 'Les inscriptions sont fermées pour ce tournoi.' },
      { status: 400 },
    )
  }

  // Vérifier la capacité
  const { count } = await supabase
    .from('tournament_entries')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournament.id)
  if ((count ?? 0) >= tournament.max_pairs) {
    return NextResponse.json({ error: 'Le tableau est complet.' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = addEntrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })
  }

  const d = parsed.data
  const { data: entry, error: insertError } = await supabase
    .from('tournament_entries')
    .insert({
      tournament_id: tournament.id,
      player1_name:  d.player1_name,
      player2_name:  d.player2_name,
      seed:          d.seed ?? null,
      status:        d.direct_entry ? 'confirmed' : 'pending',
    } as never)
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  return NextResponse.json({ entry }, { status: 201 })
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const { error, supabase, tournament } = await getTournamentAndCheckAdmin(slug)
  if (error || !supabase || !tournament) {
    return NextResponse.json({ error: error ?? 'Erreur' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const entryId = searchParams.get('entryId')
  if (!entryId) return NextResponse.json({ error: 'entryId requis' }, { status: 400 })

  const { error: delError } = await supabase
    .from('tournament_entries')
    .delete()
    .eq('id', entryId)
    .eq('tournament_id', tournament.id) // sécurité : vérifier appartenance

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
