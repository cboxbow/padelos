import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkMatchComplete } from '@/lib/tournament/scoring'
import type { TableRow, MatchFormat } from '@/types'

type MatchRow = Pick<TableRow<'matches'>, 'id' | 'tournament_id' | 'format' | 'status' | 'entry1_id' | 'entry2_id'>
type TournRow = Pick<TableRow<'tournaments'>, 'id' | 'org_id'>

// ─── Schéma ───────────────────────────────────────────────────────────────────

const setScoreSchema = z.object({
  e1: z.number().int().min(0),
  e2: z.number().int().min(0),
  tb: z.object({ e1: z.number().int().min(0), e2: z.number().int().min(0) }).optional(),
})

const scoreSchema = z.object({
  sets:        z.array(setScoreSchema).min(1).max(3),
  superTb:     z.object({ e1: z.number().int().min(0), e2: z.number().int().min(0) }).optional(),
  serving:     z.enum(['e1','e2']).nullable(),
  goldenPoint: z.boolean().default(false),
})

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; matchId: string }> },
) {
  const { slug, matchId } = await params
  const supabase = await createClient()
  const admin    = createAdminClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Get match + tournament
  const mRes = await supabase.from('matches').select('id, tournament_id, format, status, entry1_id, entry2_id').eq('id', matchId).maybeSingle()
  const match = mRes.data as MatchRow | null
  if (!match) return NextResponse.json({ error: 'Match introuvable' }, { status: 404 })

  const tRes = await supabase.from('tournaments').select('id, org_id').eq('slug', slug).maybeSingle()
  const t    = tRes.data as TournRow | null
  if (!t || t.id !== match.tournament_id) return NextResponse.json({ error: 'Tournoi introuvable' }, { status: 404 })

  // Check admin or referee
  const mbrRes = await supabase.from('org_members').select('role').eq('org_id', t.org_id).eq('user_id', user.id).maybeSingle()
  const mbr    = mbrRes.data as { role: string } | null
  const ALLOWED = ['super_admin','federation_admin','club_admin','referee']
  if (!mbr || !ALLOWED.includes(mbr.role)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  // Parse + validate score
  const body   = await req.json()
  const parsed = scoreSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })

  const score = parsed.data

  // Check completion
  const { complete, winner } = checkMatchComplete(score, match.format as MatchFormat)
  const winnerId = complete
    ? (winner === 'e1' ? match.entry1_id : match.entry2_id)
    : null

  const newStatus = complete ? 'completed' : 'live'

  // Update match score + status
  await admin.from('matches').update({
    score:        score,
    status:       newStatus,
    winner_id:    winnerId,
    started_at:   match.status === 'scheduled' ? new Date().toISOString() : undefined,
    completed_at: complete ? new Date().toISOString() : null,
  } as never).eq('id', matchId)

  // Upsert live_scores for Realtime
  const currentSet = score.superTb ? null : score.sets.at(-1)
  const completedSets = score.superTb
    ? score.sets
    : score.sets.slice(0, -1)

  await admin.from('live_scores').upsert({
    match_id:       matchId,
    tournament_id:  match.tournament_id,
    set_number:     score.superTb ? 99 : score.sets.length,
    score_entry1:   score.superTb ? score.superTb.e1 : (currentSet?.e1 ?? 0),
    score_entry2:   score.superTb ? score.superTb.e2 : (currentSet?.e2 ?? 0),
    tiebreak_entry1: score.superTb?.e1 ?? null,
    tiebreak_entry2: score.superTb?.e2 ?? null,
    game_entry1:    0,
    game_entry2:    0,
    sets_history:   completedSets,
    is_tiebreak:    !!score.superTb,
    serving:        score.serving,
    updated_at:     new Date().toISOString(),
  } as never, { onConflict: 'match_id' })

  return NextResponse.json({ ok: true, complete, winner: winnerId })
}
