import { NextResponse }       from 'next/server'
import type { NextRequest }    from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { createAdminClient }   from '@/lib/supabase/admin'
import { getPointsForRound, calcFIPTotal } from '@/lib/rankings/fip-calculator'
import type { TableRow, TournamentCategory, MatchPhase, RankingRound } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type TournRow  = Pick<TableRow<'tournaments'>,         'id' | 'org_id' | 'category' | 'status' | 'start_date'>
type MatchRow  = Pick<TableRow<'matches'>,              'id' | 'phase' | 'entry1_id' | 'entry2_id' | 'winner_id' | 'status'>
type EntryRow  = Pick<TableRow<'tournament_entries'>,   'id' | 'player1_id' | 'player2_id'>
type QGERow    = Pick<TableRow<'qual_group_entries'>,   'entry_id'>
type RankPtRow = Pick<TableRow<'ranking_points'>,       'id' | 'points' | 'round' | 'tournament_date' | 'tournament_id'>

// ─── Points round for the LOSER of each main-draw phase ──────────────────────
// In FIP: the loser of the Final gets SF points (reached the final = best result SF)
//         the loser of a Semi-final gets QF points, etc.

const PHASE_LOSER_ROUND: Partial<Record<MatchPhase, RankingRound>> = {
  final:          'SF',
  semi_final:     'QF',
  quarter_final:  'R16',
  round_of_16:    'R32',
  round_of_32:    'R64',
  qualification:  'QG',
}

// ─── POST /api/tournaments/[slug]/finalize ────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase  = await createClient()
  const admin     = createAdminClient()

  // ── Auth ────────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // ── Tournament lookup ────────────────────────────────────────────────────────
  const tRes = await supabase
    .from('tournaments')
    .select('id, org_id, category, status, start_date')
    .eq('slug', slug)
    .maybeSingle()
  const t = tRes.data as TournRow | null
  if (!t) return NextResponse.json({ error: 'Tournoi introuvable' }, { status: 404 })

  if (t.status === 'completed') {
    return NextResponse.json({ error: 'Tournoi déjà finalisé' }, { status: 409 })
  }

  // ── Admin guard ──────────────────────────────────────────────────────────────
  const mbrRes = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', t.org_id)
    .eq('user_id', user.id)
    .maybeSingle()
  const mbr = mbrRes.data as { role: string } | null
  if (!mbr || !['super_admin', 'federation_admin', 'club_admin'].includes(mbr.role)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  // ── 1. Load all completed matches ────────────────────────────────────────────
  const { data: matchData } = await admin
    .from('matches')
    .select('id, phase, entry1_id, entry2_id, winner_id, status')
    .eq('tournament_id', t.id)
    .eq('status', 'completed')
  const matches = (matchData ?? []) as MatchRow[]

  // ── 2. Collect all entry IDs ────────────────────────────────────────────────
  const entryIdSet = new Set<string>()
  for (const m of matches) {
    if (m.entry1_id) entryIdSet.add(m.entry1_id)
    if (m.entry2_id) entryIdSet.add(m.entry2_id)
  }
  const entryIds = [...entryIdSet]

  if (entryIds.length === 0) {
    // No matches completed yet — still mark as completed
    await admin.from('tournaments').update({ status: 'completed' } as never).eq('id', t.id)
    return NextResponse.json({ ok: true, pointsInserted: 0 })
  }

  // ── 3. Load entries → player IDs ────────────────────────────────────────────
  const { data: entryData } = await admin
    .from('tournament_entries')
    .select('id, player1_id, player2_id')
    .in('id', entryIds)
  const entries = (entryData ?? []) as EntryRow[]

  const entryPlayers = new Map<string, string[]>()
  for (const e of entries) {
    entryPlayers.set(
      e.id,
      [e.player1_id, e.player2_id].filter((x): x is string => Boolean(x)),
    )
  }

  // ── 4. Build ranking_points inserts ─────────────────────────────────────────
  // expires_at = tournament_date + 1 year (52-week window)
  const tournDate   = t.start_date.slice(0, 10)
  const expiresDate = new Date(t.start_date)
  expiresDate.setFullYear(expiresDate.getFullYear() + 1)
  const expiresAt = expiresDate.toISOString().slice(0, 10)

  type RankInsert = {
    player_id:       string
    tournament_id:   string
    match_id:        string
    category:        TournamentCategory
    round:           RankingRound
    points:          number
    tournament_date: string
    expires_at:      string
  }

  const inserts: RankInsert[] = []
  const mainDrawEntryIds = new Set<string>()  // track who played main draw

  for (const m of matches) {
    const isQual     = m.phase === 'qualification'
    const loserRound = PHASE_LOSER_ROUND[m.phase as MatchPhase]
    if (!loserRound) continue  // consolation / third_place → skip for now

    // Determine loser entry
    const loserId = m.winner_id
      ? (m.entry1_id === m.winner_id ? m.entry2_id : m.entry1_id)
      : null

    if (!isQual) {
      mainDrawEntryIds.add(m.entry1_id ?? '')
      mainDrawEntryIds.add(m.entry2_id ?? '')
    }

    // Loser gets points for their exit round
    if (loserId && loserRound) {
      const pts = getPointsForRound(t.category as TournamentCategory, loserRound)
      if (pts > 0) {
        for (const playerId of entryPlayers.get(loserId) ?? []) {
          inserts.push({
            player_id: playerId, tournament_id: t.id, match_id: m.id,
            category: t.category as TournamentCategory, round: loserRound,
            points: pts, tournament_date: tournDate, expires_at: expiresAt,
          })
        }
      }
    }

    // Final winner gets W points
    if (m.phase === 'final' && m.winner_id) {
      const pts = getPointsForRound(t.category as TournamentCategory, 'W')
      if (pts > 0) {
        for (const playerId of entryPlayers.get(m.winner_id) ?? []) {
          inserts.push({
            player_id: playerId, tournament_id: t.id, match_id: m.id,
            category: t.category as TournamentCategory, round: 'W',
            points: pts, tournament_date: tournDate, expires_at: expiresAt,
          })
        }
      }
    }
  }

  // ── 5. Qual group QG points — participants who did NOT qualify ───────────────
  const { data: qgeData } = await admin
    .from('qual_group_entries')
    .select('entry_id')
    .in(
      'group_id',
      (await admin.from('qual_groups').select('id').eq('tournament_id', t.id)).data?.map(g => (g as { id: string }).id) ?? [],
    )
  const qualEntryIds = ((qgeData ?? []) as QGERow[]).map(q => q.entry_id)

  for (const entryId of qualEntryIds) {
    if (mainDrawEntryIds.has(entryId)) continue  // qualified → got higher points already
    const pts = getPointsForRound(t.category as TournamentCategory, 'QG')
    if (pts > 0) {
      for (const playerId of entryPlayers.get(entryId) ?? []) {
        inserts.push({
          player_id: playerId, tournament_id: t.id, match_id: '',
          category: t.category as TournamentCategory, round: 'QG',
          points: pts, tournament_date: tournDate, expires_at: expiresAt,
        })
      }
    }
  }

  // ── 6. Clear old ranking_points for this tournament, then re-insert ──────────
  await admin.from('ranking_points').delete().eq('tournament_id', t.id)

  const validInserts = inserts.filter(r => r.player_id && r.match_id !== undefined)
  if (validInserts.length > 0) {
    const { error: insertErr } = await admin
      .from('ranking_points')
      .insert(validInserts.map(r => ({
        ...r,
        match_id: r.match_id || null,
      })) as never)
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }
  }

  // ── 7. Recompute player_profiles.ranking_points for all affected players ────
  const allPlayerIds = [...new Set(validInserts.map(r => r.player_id))]

  await Promise.all(
    allPlayerIds.map(async (playerId) => {
      const { data: ptData } = await admin
        .from('ranking_points')
        .select('id, points, round, tournament_date, tournament_id')
        .eq('player_id', playerId)
      const { total } = calcFIPTotal((ptData ?? []) as RankPtRow[])
      await admin
        .from('player_profiles')
        .update({ ranking_points: total } as never)
        .eq('id', playerId)
    }),
  )

  // ── 8. Mark tournament as completed ─────────────────────────────────────────
  await admin.from('tournaments').update({ status: 'completed' } as never).eq('id', t.id)

  return NextResponse.json({
    ok:             true,
    pointsInserted: validInserts.length,
    playersUpdated: allPlayerIds.length,
  })
}
