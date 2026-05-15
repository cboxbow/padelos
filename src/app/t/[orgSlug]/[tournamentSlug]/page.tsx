import type { Metadata }   from 'next'
import { notFound }         from 'next/navigation'
import { Calendar, MapPin, Users, Trophy, Clock } from 'lucide-react'
import { createClient }     from '@/lib/supabase/server'
import { MATCH_FORMAT_LABELS, TOURNAMENT_STATUS_LABELS } from '@/components/mpl/design-tokens'
import type { TableRow, MatchFormat, TournamentStatus } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type TournRow  = Pick<TableRow<'tournaments'>,
  'id' | 'name' | 'category' | 'status' | 'format' | 'start_date' | 'end_date' |
  'venue' | 'city' | 'country' | 'max_pairs' | 'description' | 'prize_money' | 'currency'>
type EntryRow  = Pick<TableRow<'tournament_entries'>, 'id' | 'player1_name' | 'player2_name' | 'seed'>
type GroupRow  = Pick<TableRow<'qual_groups'>, 'id' | 'name' | 'group_index'>
type GERow     = Pick<TableRow<'qual_group_entries'>, 'id' | 'group_id' | 'entry_id' | 'points' | 'matches_played' | 'matches_won' | 'games_won' | 'games_lost'>
type MatchRow  = Pick<TableRow<'matches'>, 'id' | 'phase' | 'status' | 'entry1_id' | 'entry2_id' | 'winner_id' | 'score' | 'court' | 'scheduled_at' | 'completed_at'>

// ─── generateMetadata (inherited from layout, but page can override) ──────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>
}): Promise<Metadata> {
  const { tournamentSlug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('tournaments')
    .select('name, description')
    .eq('slug', tournamentSlug)
    .maybeSingle()
  const t = data as { name: string; description: string | null } | null
  return {
    title:       t?.name ?? 'Tournoi',
    description: t?.description ?? undefined,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicOverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>
}) {
  const { tournamentSlug } = await params
  const supabase = await createClient()

  // ── Tournament ──────────────────────────────────────────────────────────────
  const tRes = await supabase
    .from('tournaments')
    .select('id, name, category, status, format, start_date, end_date, venue, city, country, max_pairs, description, prize_money, currency')
    .eq('slug', tournamentSlug)
    .maybeSingle()
  const t = tRes.data as TournRow | null
  if (!t) notFound()

  // ── Entries + groups + recent matches in parallel ───────────────────────────
  const [entriesRes, groupsRes] = await Promise.all([
    supabase.from('tournament_entries').select('id, player1_name, player2_name, seed').eq('tournament_id', t.id),
    supabase.from('qual_groups').select('id, name, group_index').eq('tournament_id', t.id).order('group_index'),
  ])
  const entries  = (entriesRes.data ?? []) as EntryRow[]
  const groups   = (groupsRes.data  ?? []) as GroupRow[]
  const entryMap = new Map(entries.map(e => [e.id, e]))

  // Group standings
  let groupEntries: GERow[] = []
  if (groups.length > 0) {
    const { data: geData } = await supabase
      .from('qual_group_entries')
      .select('id, group_id, entry_id, points, matches_played, matches_won, games_won, games_lost')
      .in('group_id', groups.map(g => g.id))
    groupEntries = (geData ?? []) as GERow[]
  }

  // Matches: next 3 scheduled + last 5 completed
  const { data: matchData } = await supabase
    .from('matches')
    .select('id, phase, status, entry1_id, entry2_id, winner_id, score, court, scheduled_at, completed_at')
    .eq('tournament_id', t.id)
    .in('status', ['scheduled', 'live', 'completed'])
    .order('scheduled_at', { ascending: true, nullsFirst: false })
  const allMatches  = (matchData ?? []) as MatchRow[]
  const upcoming    = allMatches.filter(m => m.status === 'scheduled' || m.status === 'live').slice(0, 4)
  const completed   = [...allMatches].filter(m => m.status === 'completed').sort(
    (a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime()
  ).slice(0, 5)

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const entryLabel = (id: string | null) => {
    if (!id) return 'TBD'
    const e = entryMap.get(id)
    if (!e) return 'TBD'
    return `${e.player1_name ?? '?'} / ${e.player2_name ?? '?'}`
  }

  const phaseLabel: Record<string, string> = {
    qualification: 'Qualification', round_of_32: 'R32', round_of_16: 'R16',
    quarter_final: 'QF', semi_final: 'SF', final: 'Finale', consolation: 'Consolante',
  }

  return (
    <div className="space-y-8">
      {/* ── Info cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCard icon={<Calendar className="h-4 w-4" />} label="Dates">
          <span className="text-xs">{fmt(t.start_date)}</span>
          <span className="text-xs text-muted-foreground">→ {fmt(t.end_date)}</span>
        </InfoCard>
        <InfoCard icon={<MapPin className="h-4 w-4" />} label="Lieu">
          <span>{t.venue ?? t.city ?? '—'}</span>
          {t.city && t.venue && <span className="text-xs text-muted-foreground">{t.city}</span>}
        </InfoCard>
        <InfoCard icon={<Users className="h-4 w-4" />} label="Équipes">
          <span className="font-mono text-lg font-bold text-foreground">{entries.length}</span>
          <span className="text-xs text-muted-foreground">/ {t.max_pairs} max</span>
        </InfoCard>
        <InfoCard icon={<Trophy className="h-4 w-4" />} label="Format">
          <span>{MATCH_FORMAT_LABELS[t.format as MatchFormat]?.replace('Format ', '').replace(' — ', ' · ')}</span>
          {t.prize_money != null && t.prize_money > 0 && (
            <span className="text-xs text-gold font-mono">
              {t.prize_money.toLocaleString()} {t.currency}
            </span>
          )}
        </InfoCard>
      </div>

      {/* ── Description ────────────────────────────────────────────────── */}
      {t.description && (
        <div className="rounded-xl border border-border bg-court-panel p-5">
          <p className="font-body text-sm text-muted-foreground leading-relaxed">{t.description}</p>
        </div>
      )}

      {/* ── Live / upcoming matches ────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <SectionHeading icon={<Clock className="h-4 w-4" />}>
            {upcoming.some(m => m.status === 'live') ? 'En cours & à venir' : 'Prochains matchs'}
          </SectionHeading>
          <div className="space-y-2">
            {upcoming.map(m => (
              <MatchCard
                key={m.id}
                isLive={m.status === 'live'}
                phase={phaseLabel[m.phase] ?? m.phase}
                team1={entryLabel(m.entry1_id)}
                team2={entryLabel(m.entry2_id)}
                court={m.court}
                scheduledAt={m.scheduled_at}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Group standings ────────────────────────────────────────────── */}
      {groups.length > 0 && (
        <section className="space-y-3" id="groups">
          <SectionHeading icon={<Trophy className="h-4 w-4" />}>
            Groupes de qualification
          </SectionHeading>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(g => {
              const gEntries = groupEntries
                .filter(ge => ge.group_id === g.id)
                .sort((a, b) => b.points - a.points || (b.games_won - b.games_lost) - (a.games_won - a.games_lost))

              return (
                <div key={g.id} className="rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border bg-court-panel">
                    <span className="font-display text-sm tracking-widest uppercase text-gold">
                      Groupe {g.name}
                    </span>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-court-card">
                        <th className="px-3 py-1.5 text-left text-[10px] font-body text-muted-foreground uppercase tracking-wider">Équipe</th>
                        <th className="px-2 py-1.5 text-center text-[10px] font-body text-muted-foreground uppercase tracking-wider">J</th>
                        <th className="px-2 py-1.5 text-center text-[10px] font-body text-muted-foreground uppercase tracking-wider">V</th>
                        <th className="px-2 py-1.5 text-center text-[10px] font-body text-muted-foreground uppercase tracking-wider">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {gEntries.map((ge, idx) => {
                        const e = entryMap.get(ge.entry_id)
                        return (
                          <tr key={ge.id} className={idx === 0 ? 'bg-gold/5' : ''}>
                            <td className="px-3 py-2">
                              <p className="font-body text-xs text-foreground leading-tight">
                                {e?.player1_name ?? '—'}
                              </p>
                              <p className="font-body text-[10px] text-muted-foreground">
                                {e?.player2_name ?? '—'}
                              </p>
                            </td>
                            <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{ge.matches_played}</td>
                            <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">{ge.matches_won}</td>
                            <td className="px-2 py-2 text-center">
                              <span className={`font-mono text-sm font-bold ${idx === 0 ? 'text-gold' : 'text-foreground'}`}>
                                {ge.points}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Recent results ─────────────────────────────────────────────── */}
      {completed.length > 0 && (
        <section className="space-y-3">
          <SectionHeading icon={<Trophy className="h-4 w-4" />}>
            Derniers résultats
          </SectionHeading>
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {completed.map(m => {
              const t1 = entryLabel(m.entry1_id)
              const t2 = entryLabel(m.entry2_id)
              const score = m.score
                ? (() => {
                    const s = m.score as { sets?: Array<{e1:number;e2:number}> } | null
                    return s?.sets?.map(set => `${set.e1}-${set.e2}`).join(' ') ?? ''
                  })()
                : ''

              return (
                <div key={m.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 bg-court-card hover:bg-court-hover/20 transition-colors">
                  <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider w-16 shrink-0">
                    {phaseLabel[m.phase] ?? m.phase}
                  </span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className={`font-body text-sm truncate ${m.winner_id === m.entry1_id ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                      {t1}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground shrink-0">vs</span>
                    <span className={`font-body text-sm truncate ${m.winner_id === m.entry2_id ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                      {t2}
                    </span>
                  </div>
                  {score && (
                    <span className="font-mono text-xs text-gold shrink-0">{score}</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="text-center py-16">
          <p className="font-body text-muted-foreground">
            {TOURNAMENT_STATUS_LABELS[t.status as TournamentStatus] === 'Inscriptions'
              ? 'Les inscriptions sont ouvertes.'
              : 'Aucune donnée disponible pour ce tournoi.'}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoCard({
  icon, label, children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-court-panel p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
        {icon}
        <span className="font-body text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex flex-col font-body text-sm text-foreground">{children}</div>
    </div>
  )
}

function SectionHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gold">{icon}</span>
      <h2 className="font-display text-base tracking-widest uppercase text-foreground">{children}</h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function MatchCard({
  isLive, phase, team1, team2, court, scheduledAt,
}: {
  isLive:      boolean
  phase:       string
  team1:       string
  team2:       string
  court?:      string | null
  scheduledAt?: string | null
}) {
  const timeStr = scheduledAt
    ? new Date(scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className={`rounded-xl border overflow-hidden ${isLive ? 'border-gold/40 bg-gold/5' : 'border-border bg-court-panel'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Live pulse / time */}
        <div className="flex flex-col items-center gap-1 w-12 shrink-0">
          {isLive ? (
            <>
              <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />
              <span className="font-mono text-[9px] text-gold uppercase tracking-widest">Live</span>
            </>
          ) : timeStr ? (
            <span className="font-mono text-xs text-muted-foreground">{timeStr}</span>
          ) : null}
        </div>

        {/* Teams */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-body text-sm text-foreground font-medium truncate">{team1}</span>
            <span className="font-mono text-xs text-muted-foreground shrink-0">vs</span>
            <span className="font-body text-sm text-foreground font-medium truncate">{team2}</span>
          </div>
        </div>

        {/* Phase + court */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{phase}</span>
          {court && (
            <span className="font-mono text-[10px] text-muted-foreground/60">{court}</span>
          )}
        </div>
      </div>
    </div>
  )
}
