import type { Metadata }  from 'next'
import { notFound }        from 'next/navigation'
import { Clock, CheckCircle, Play } from 'lucide-react'
import { createClient }    from '@/lib/supabase/server'
import type { TableRow }   from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type TournRow = Pick<TableRow<'tournaments'>, 'id' | 'name'>
type MatchRow = Pick<TableRow<'matches'>,
  'id' | 'phase' | 'status' | 'entry1_id' | 'entry2_id' | 'winner_id' |
  'court' | 'scheduled_at' | 'completed_at' | 'score' | 'notes'>
type EntryRow = Pick<TableRow<'tournament_entries'>, 'id' | 'player1_name' | 'player2_name'>

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
  return { title: t ? `Planning — ${t.name}` : 'Planning' }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicSchedulePage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>
}) {
  const { tournamentSlug } = await params
  const supabase = await createClient()

  const tRes = await supabase.from('tournaments').select('id, name').eq('slug', tournamentSlug).maybeSingle()
  const t    = tRes.data as TournRow | null
  if (!t) notFound()

  // All matches with scheduling info
  const { data: matchData } = await supabase
    .from('matches')
    .select('id, phase, status, entry1_id, entry2_id, winner_id, court, scheduled_at, completed_at, score, notes')
    .eq('tournament_id', t.id)
    .neq('status', 'bye')
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('notes',         { ascending: true })
  const matches = (matchData ?? []) as MatchRow[]

  // Entry names
  const entryIds = [...new Set([
    ...matches.map(m => m.entry1_id),
    ...matches.map(m => m.entry2_id),
  ].filter(Boolean))] as string[]

  const { data: entryData } = await supabase
    .from('tournament_entries')
    .select('id, player1_name, player2_name')
    .in('id', entryIds)
  const entries  = (entryData ?? []) as EntryRow[]
  const entryMap = new Map(entries.map(e => [e.id, e]))

  if (matches.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-body text-muted-foreground">Aucun match planifié pour le moment.</p>
      </div>
    )
  }

  // Group by court, then by date
  const byCourt = new Map<string, MatchRow[]>()
  for (const m of matches) {
    const key = m.court ?? 'Court non assigné'
    if (!byCourt.has(key)) byCourt.set(key, [])
    byCourt.get(key)!.push(m)
  }

  const phaseLabel: Record<string, string> = {
    qualification: 'Qual.', round_of_32: 'R32', round_of_16: 'R16',
    quarter_final: 'QF', semi_final: 'SF', final: 'Finale',
    consolation: 'Cons.', third_place: '3ème place',
  }

  const fmt = (d: string | null) =>
    d
      ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '—'

  const fmtDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      : null

  const scoreStr = (m: MatchRow) => {
    if (!m.score) return ''
    const s = m.score as { sets?: Array<{e1:number;e2:number}> } | null
    return s?.sets?.map(set => `${set.e1}-${set.e2}`).join(' ') ?? ''
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'live':      return <Play      className="h-3 w-3 text-gold animate-pulse" />
      case 'completed': return <CheckCircle className="h-3 w-3 text-green-400" />
      default:          return <Clock     className="h-3 w-3 text-muted-foreground/50" />
    }
  }

  return (
    <div className="space-y-8">
      <h2 className="font-display text-lg tracking-widest uppercase text-foreground">
        Planning des matchs
      </h2>

      {/* By court */}
      {[...byCourt.entries()].map(([court, courtMatches]) => {
        // Group by date
        const byDate = new Map<string, MatchRow[]>()
        for (const m of courtMatches) {
          const dateKey = m.scheduled_at
            ? new Date(m.scheduled_at).toISOString().slice(0, 10)
            : 'non-planifié'
          if (!byDate.has(dateKey)) byDate.set(dateKey, [])
          byDate.get(dateKey)!.push(m)
        }

        const liveCount = courtMatches.filter(m => m.status === 'live').length

        return (
          <div key={court} className="space-y-3">
            {/* Court header */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-6 bg-gold rounded-full" />
                <h3 className="font-display text-base tracking-wider uppercase text-foreground">{court}</h3>
                {liveCount > 0 && (
                  <span className="flex items-center gap-1 font-mono text-[10px] text-gold">
                    <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
                    {liveCount} en cours
                  </span>
                )}
              </div>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Date groups */}
            {[...byDate.entries()].map(([dateKey, dayMatches]) => (
              <div key={dateKey} className="rounded-xl border border-border overflow-hidden">
                {/* Date header */}
                {dateKey !== 'non-planifié' && (
                  <div className="px-4 py-2 border-b border-border bg-court-panel">
                    <span className="font-body text-xs font-semibold capitalize text-muted-foreground">
                      {fmtDate(dayMatches[0]?.scheduled_at ?? null)}
                    </span>
                  </div>
                )}

                {/* Matches */}
                <div className="divide-y divide-border">
                  {dayMatches.map(m => {
                    const e1 = entryMap.get(m.entry1_id ?? '')
                    const e2 = entryMap.get(m.entry2_id ?? '')
                    const w  = m.winner_id
                    const sc = scoreStr(m)

                    return (
                      <div
                        key={m.id}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                          m.status === 'live'
                            ? 'bg-gold/5'
                            : m.status === 'completed'
                              ? 'bg-court-card'
                              : 'bg-court-panel hover:bg-court-hover/20'
                        }`}
                      >
                        {/* Status icon */}
                        <div className="w-4 shrink-0">{statusIcon(m.status)}</div>

                        {/* Time */}
                        <div className="w-12 shrink-0">
                          <span className="font-mono text-xs text-muted-foreground">
                            {m.status === 'completed'
                              ? fmt(m.completed_at)
                              : fmt(m.scheduled_at)}
                          </span>
                        </div>

                        {/* Phase */}
                        <div className="w-10 shrink-0">
                          <span className="font-mono text-[10px] text-muted-foreground/60 uppercase">
                            {phaseLabel[m.phase] ?? m.phase}
                          </span>
                        </div>

                        {/* Match code */}
                        {m.notes && (
                          <div className="w-8 shrink-0">
                            <span className="font-mono text-[9px] text-muted-foreground/40">{m.notes}</span>
                          </div>
                        )}

                        {/* Teams */}
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <span className={`font-body text-sm truncate ${w === m.entry1_id && w ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                            {e1 ? `${e1.player1_name ?? '?'} / ${e1.player2_name ?? '?'}` : 'TBD'}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground/40 shrink-0">–</span>
                          <span className={`font-body text-sm truncate ${w === m.entry2_id && w ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                            {e2 ? `${e2.player1_name ?? '?'} / ${e2.player2_name ?? '?'}` : 'TBD'}
                          </span>
                        </div>

                        {/* Score */}
                        {sc && (
                          <span className="font-mono text-xs text-gold shrink-0">{sc}</span>
                        )}
                        {m.status === 'live' && !sc && (
                          <span className="font-mono text-xs text-gold animate-pulse shrink-0">en cours</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
