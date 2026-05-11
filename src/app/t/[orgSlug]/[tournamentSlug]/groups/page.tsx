import type { Metadata }  from 'next'
import { notFound }        from 'next/navigation'
import { createClient }    from '@/lib/supabase/server'
import type { TableRow }   from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type TournRow = Pick<TableRow<'tournaments'>, 'id' | 'name' | 'status'>
type GroupRow = Pick<TableRow<'qual_groups'>, 'id' | 'name' | 'group_index'>
type GERow    = Pick<TableRow<'qual_group_entries'>, 'id' | 'group_id' | 'entry_id' | 'points' | 'matches_played' | 'matches_won' | 'games_won' | 'games_lost'>
type EntryRow = Pick<TableRow<'tournament_entries'>, 'id' | 'player1_name' | 'player2_name'>
type MatchRow = Pick<TableRow<'matches'>, 'id' | 'group_id' | 'status' | 'entry1_id' | 'entry2_id' | 'winner_id' | 'score' | 'notes'>

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentSlug: string }>
}): Promise<Metadata> {
  const { tournamentSlug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('tournaments').select('name').eq('slug', tournamentSlug).maybeSingle()
  const t = data as { name: string } | null
  return { title: t ? `Groupes — ${t.name}` : 'Groupes' }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicGroupsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>
}) {
  const { tournamentSlug } = await params
  const supabase = await createClient()

  const tRes = await supabase.from('tournaments').select('id, name, status').eq('slug', tournamentSlug).maybeSingle()
  const t    = tRes.data as TournRow | null
  if (!t) notFound()

  const [groupsRes, entriesRes] = await Promise.all([
    supabase.from('qual_groups').select('id, name, group_index').eq('tournament_id', t.id).order('group_index'),
    supabase.from('tournament_entries').select('id, player1_name, player2_name').eq('tournament_id', t.id),
  ])
  const groups  = (groupsRes.data  ?? []) as GroupRow[]
  const entries = (entriesRes.data ?? []) as EntryRow[]
  const entryMap = new Map(entries.map(e => [e.id, e]))

  let groupEntries: GERow[] = []
  let groupMatches: MatchRow[] = []

  if (groups.length > 0) {
    const groupIds = groups.map(g => g.id)
    const [geRes, gmRes] = await Promise.all([
      supabase.from('qual_group_entries')
        .select('id, group_id, entry_id, points, matches_played, matches_won, games_won, games_lost')
        .in('group_id', groupIds),
      supabase.from('matches')
        .select('id, group_id, status, entry1_id, entry2_id, winner_id, score, notes')
        .in('group_id', groupIds)
        .order('notes'),
    ])
    groupEntries = (geRes.data ?? []) as GERow[]
    groupMatches = (gmRes.data ?? []) as MatchRow[]
  }

  if (groups.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-body text-muted-foreground">Aucun groupe de qualification disponible.</p>
      </div>
    )
  }

  const GROUP_COLORS = ['text-blue-400', 'text-purple-400', 'text-green-400', 'text-amber-400', 'text-pink-400', 'text-cyan-400', 'text-orange-400', 'text-rose-400']

  return (
    <div className="space-y-6">
      <h2 className="font-display text-lg tracking-widest uppercase text-foreground">
        Groupes de qualification
      </h2>

      <div className="grid sm:grid-cols-2 gap-6">
        {groups.map((g, gi) => {
          const gEntries = groupEntries
            .filter(ge => ge.group_id === g.id)
            .sort((a, b) =>
              b.points - a.points ||
              (b.games_won - b.games_lost) - (a.games_won - a.games_lost) ||
              b.games_won - a.games_won
            )

          const gMatches = groupMatches.filter(m => m.group_id === g.id)
          const colorClass = GROUP_COLORS[gi % GROUP_COLORS.length]

          return (
            <div key={g.id} className="rounded-xl border border-border overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-border bg-court-panel flex items-center gap-2">
                <span className={`font-display text-lg tracking-wider ${colorClass}`}>
                  Groupe {g.name}
                </span>
                <span className="font-body text-xs text-muted-foreground">
                  {gEntries.length} équipes · {gMatches.filter(m => m.status === 'completed').length}/{gMatches.length} matchs
                </span>
              </div>

              {/* Standings table */}
              <table className="w-full">
                <thead>
                  <tr className="bg-court-card border-b border-border">
                    <th className="px-3 py-2 text-left text-[10px] font-body text-muted-foreground uppercase tracking-wider">#</th>
                    <th className="px-3 py-2 text-left text-[10px] font-body text-muted-foreground uppercase tracking-wider">Équipe</th>
                    <th className="px-2 py-2 text-center text-[10px] font-body text-muted-foreground uppercase tracking-wider w-8">J</th>
                    <th className="px-2 py-2 text-center text-[10px] font-body text-muted-foreground uppercase tracking-wider w-8">V</th>
                    <th className="px-2 py-2 text-center text-[10px] font-body text-muted-foreground uppercase tracking-wider w-10">+/-</th>
                    <th className="px-2 py-2 text-center text-[10px] font-body text-muted-foreground uppercase tracking-wider w-10">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {gEntries.map((ge, idx) => {
                    const e = entryMap.get(ge.entry_id)
                    const diff = ge.games_won - ge.games_lost
                    const isLeader = idx === 0 && ge.matches_played > 0
                    return (
                      <tr key={ge.id} className={isLeader ? 'bg-gold/5' : ''}>
                        <td className="px-3 py-2">
                          <span className="font-mono text-xs text-muted-foreground">{idx + 1}</span>
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-body text-xs font-medium text-foreground leading-tight">{e?.player1_name ?? '—'}</p>
                          <p className="font-body text-[10px] text-muted-foreground">{e?.player2_name ?? '—'}</p>
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{ge.matches_played}</td>
                        <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{ge.matches_won}</td>
                        <td className="px-2 py-2 text-center font-mono text-xs">
                          <span className={diff >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className={`font-mono text-sm font-bold ${isLeader ? 'text-gold' : 'text-foreground'}`}>
                            {ge.points}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Match schedule for this group */}
              {gMatches.length > 0 && (
                <div className="border-t border-border">
                  {gMatches.map(m => {
                    const e1 = entryMap.get(m.entry1_id ?? '')
                    const e2 = entryMap.get(m.entry2_id ?? '')
                    const score = m.score
                      ? (() => {
                          const s = m.score as { sets?: Array<{e1:number;e2:number}> } | null
                          return s?.sets?.map(set => `${set.e1}-${set.e2}`).join(' ') ?? ''
                        })()
                      : ''
                    return (
                      <div key={m.id} className={`flex items-center gap-3 px-3 py-2 border-b border-border/50 last:border-0 ${m.status === 'live' ? 'bg-gold/5' : ''}`}>
                        <span className="font-mono text-[9px] text-muted-foreground/50 w-6 shrink-0">{m.notes ?? ''}</span>
                        <div className="flex-1 flex items-center gap-1.5 min-w-0 text-xs font-body">
                          <span className={`truncate ${m.winner_id === m.entry1_id ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                            {e1?.player1_name ?? '?'}
                          </span>
                          <span className="text-muted-foreground/40 shrink-0">vs</span>
                          <span className={`truncate ${m.winner_id === m.entry2_id ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                            {e2?.player1_name ?? '?'}
                          </span>
                        </div>
                        {m.status === 'live' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse shrink-0" />
                        )}
                        {score && (
                          <span className="font-mono text-[10px] text-gold shrink-0">{score}</span>
                        )}
                        {m.status === 'completed' && !score && (
                          <span className="font-mono text-[10px] text-green-400 shrink-0">✓</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
