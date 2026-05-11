import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ScoringBoard } from './_components/ScoringBoard'
import type { TableRow } from '@/types'

type MatchRow = Pick<
  TableRow<'matches'>,
  'id' | 'tournament_id' | 'format' | 'status' | 'entry1_id' | 'entry2_id' | 'score'
>
type EntryRow = Pick<TableRow<'tournament_entries'>, 'id' | 'player1_name' | 'player2_name'>
type TournRow = Pick<TableRow<'tournaments'>, 'id' | 'slug' | 'org_id'>

export default async function RefereePage({
  params,
}: {
  params: Promise<{ orgSlug: string; matchId: string }>
}) {
  const { orgSlug, matchId } = await params
  const supabase = await createClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch match
  const mRes = await supabase
    .from('matches')
    .select('id, tournament_id, format, status, entry1_id, entry2_id, score')
    .eq('id', matchId)
    .maybeSingle()
  const match = mRes.data as MatchRow | null
  if (!match) notFound()

  // Fetch tournament (for slug + org check)
  const tRes = await supabase
    .from('tournaments')
    .select('id, slug, org_id')
    .eq('id', match.tournament_id)
    .maybeSingle()
  const tournament = tRes.data as TournRow | null
  if (!tournament) notFound()

  // Check permission: must be member of the org
  const mbrRes = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', tournament.org_id)
    .eq('user_id', user.id)
    .maybeSingle()
  const mbr = mbrRes.data as { role: string } | null
  const ALLOWED = ['super_admin','federation_admin','club_admin','referee']
  if (!mbr || !ALLOWED.includes(mbr.role)) redirect('/login?error=acces_refuse')

  // Fetch entry names
  const entryIds = [match.entry1_id, match.entry2_id].filter(Boolean) as string[]
  let entries: EntryRow[] = []
  if (entryIds.length > 0) {
    const { data } = await supabase
      .from('tournament_entries')
      .select('id, player1_name, player2_name')
      .in('id', entryIds)
    entries = (data ?? []) as EntryRow[]
  }

  function entryLabel(id: string | null): string {
    const e = entries.find(e => e.id === id)
    if (!e) return 'Équipe inconnue'
    return `${e.player1_name ?? '?'} / ${e.player2_name ?? '?'}`
  }

  return (
    <ScoringBoard
      match={match}
      orgSlug={orgSlug}
      tournSlug={tournament.slug}
      team1Label={entryLabel(match.entry1_id)}
      team2Label={entryLabel(match.entry2_id)}
    />
  )
}
