/**
 * POST /api/tournaments/[slug]/entries/import
 * Insertion en masse de paires depuis CSV/Excel (import côté client déjà parsé).
 */

import { NextResponse }           from 'next/server'
import type { NextRequest }       from 'next/server'
import { z }                      from 'zod'
import { createClient }           from '@/lib/supabase/server'
import type { TableRow }          from '@/types'

type EntryRow = TableRow<'tournament_entries'>
type TournRow = Pick<TableRow<'tournaments'>, 'id' | 'max_pairs' | 'org_id' | 'status'>

// ─── Schéma ───────────────────────────────────────────────────────────────────

const rowSchema = z.object({
  player1_name: z.string().min(2).max(80).trim(),
  player2_name: z.string().min(2).max(80).trim(),
  seed:         z.coerce.number().int().min(1).max(128).optional(),
  direct_entry: z.boolean().default(false),
})

const bodySchema = z.object({
  entries: z.array(rowSchema).min(1).max(256),
})

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase  = await createClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Tournament
  const tRes = await supabase
    .from('tournaments')
    .select('id, max_pairs, org_id, status')
    .eq('slug', slug)
    .maybeSingle()
  const tournament = tRes.data as TournRow | null
  if (!tournament) return NextResponse.json({ error: 'Tournoi introuvable' }, { status: 404 })

  // Admin check
  const mRes = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', tournament.org_id)
    .eq('user_id', user.id)
    .maybeSingle()
  const member = mRes.data as { role: string } | null
  if (!member || !['super_admin','federation_admin','club_admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  if (!['draft','registration'].includes(tournament.status)) {
    return NextResponse.json({ error: 'Inscriptions fermées pour ce tournoi.' }, { status: 400 })
  }

  // Parse body
  const body   = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })
  }

  // Remaining capacity
  const { count: existing } = await supabase
    .from('tournament_entries')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournament.id)
  const remaining = tournament.max_pairs - (existing ?? 0)
  const toInsert  = parsed.data.entries.slice(0, remaining)
  const skipped   = parsed.data.entries.length - toInsert.length

  if (toInsert.length === 0) {
    return NextResponse.json({ error: 'Tableau déjà complet.' }, { status: 400 })
  }

  // Bulk insert
  const rows = toInsert.map(e => ({
    tournament_id: tournament.id,
    player1_name:  e.player1_name,
    player2_name:  e.player2_name,
    seed:          e.seed ?? null,
    status:        e.direct_entry ? 'confirmed' : 'pending',
  }))

  const { data: inserted, error: insertErr } = await supabase
    .from('tournament_entries')
    .insert(rows as never[])
    .select()
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({
    imported: (inserted as EntryRow[]).length,
    skipped,
    entries: inserted as EntryRow[],
  }, { status: 201 })
}
