import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SectionTitle, CategoryBadge } from '@/components/mpl'
import { calcFIPTotal } from '@/lib/rankings/fip-calculator'
import type { TournamentCategory, TableRow } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerRow  = Pick<TableRow<'player_profiles'>, 'id' | 'display_name' | 'nationality' | 'gender'>
type RankPtRow  = Pick<TableRow<'ranking_points'>, 'id' | 'player_id' | 'points' | 'round' | 'tournament_date' | 'tournament_id' | 'category'>
type SnapshotRow = Pick<TableRow<'rankings_snapshots'>, 'player_id' | 'rank_position' | 'category'>

const ALL_CATEGORIES: TournamentCategory[] = [
  'M1000','M500','M250','M100','M50','M25',
  'W1000','W500','W250','W100','W50','W25',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RankingsPage({
  params,
  searchParams,
}: {
  params:       Promise<{ orgSlug: string }>
  searchParams: Promise<{ cat?: string }>
}) {
  const { orgSlug }   = await params
  const { cat }       = await searchParams
  const activeCategory = (ALL_CATEGORIES.includes(cat as TournamentCategory) ? cat : 'M100') as TournamentCategory

  const supabase = await createClient()

  // Get org
  const orgRes = await supabase.from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  const org    = orgRes.data as { id: string } | null
  if (!org) return <p className="text-muted-foreground">Organisation introuvable.</p>

  // Get all players for this org
  const { data: playerData } = await supabase
    .from('player_profiles')
    .select('id, display_name, nationality, gender')
    .eq('org_id', org.id)
    .eq('is_active', true)
  const players = (playerData ?? []) as PlayerRow[]
  const playerIds = players.map(p => p.id)

  if (playerIds.length === 0) {
    return (
      <div className="space-y-6">
        <SectionTitle title="Classements" subtitle="FIP Best-of-8" withAccent as="h1" />
        <p className="font-body text-muted-foreground">Aucun joueur dans cet organisme.</p>
      </div>
    )
  }

  // Get ranking points for this category
  const { data: rpData } = await supabase
    .from('ranking_points')
    .select('id, player_id, points, round, tournament_date, tournament_id, category')
    .in('player_id', playerIds)
    .eq('category', activeCategory)
  const allPoints = (rpData ?? []) as RankPtRow[]

  // Get latest snapshots for previous rank comparison
  const { data: snapData } = await supabase
    .from('rankings_snapshots')
    .select('player_id, rank_position, category')
    .in('player_id', playerIds)
    .eq('category', activeCategory)
    .order('computed_at', { ascending: false })
  const snapshots = (snapData ?? []) as SnapshotRow[]
  // Only keep the latest snapshot per player
  const prevRank: Record<string, number> = {}
  snapshots.forEach(s => {
    if (!prevRank[s.player_id]) prevRank[s.player_id] = s.rank_position
  })

  // Compute FIP total per player
  const ranked = players
    .map(p => {
      const pts    = allPoints.filter(r => r.player_id === p.id)
      const result = calcFIPTotal(pts)
      return { player: p, ...result }
    })
    .filter(r => r.total > 0 || true)  // show all players
    .sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle
          title="Classements"
          subtitle={`FIP best-of-8 · Catégorie ${activeCategory}`}
          withAccent
          as="h1"
        />
        <CategoryBadge category={activeCategory} withGenderIcon className="h-fit" />
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {ALL_CATEGORIES.map(c => (
          <Link
            key={c}
            href={`/${orgSlug}/rankings?cat=${c}`}
            className={`text-xs font-mono px-2.5 py-1 rounded border transition-colors ${
              c === activeCategory
                ? 'bg-gold text-black border-gold font-bold'
                : 'border-border text-muted-foreground hover:border-gold/40 hover:text-foreground'
            }`}
          >
            {c}
          </Link>
        ))}
      </div>

      {/* Ranking table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-court-panel">
              <th className="px-4 py-3 text-left text-xs font-body font-medium text-muted-foreground tracking-widest uppercase w-14">Rang</th>
              <th className="px-4 py-3 text-left text-xs font-body font-medium text-muted-foreground tracking-widest uppercase">Joueur</th>
              <th className="px-4 py-3 text-right text-xs font-body font-medium text-muted-foreground tracking-widest uppercase hidden md:table-cell">Tournois</th>
              <th className="px-4 py-3 text-right text-xs font-body font-medium text-muted-foreground tracking-widest uppercase hidden sm:table-cell">Best-8 pts</th>
              <th className="px-4 py-3 text-right text-xs font-body font-medium text-muted-foreground tracking-widest uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ranked.map((r, i) => {
              const prev   = prevRank[r.player.id]
              const rank   = i + 1
              const delta  = prev !== undefined ? prev - rank : null  // positive = improved

              return (
                <tr key={r.player.id} className={`hover:bg-court-hover/40 transition-colors ${rank <= 3 ? 'bg-gold/3' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <RankMedal rank={rank} />
                      {delta !== null && delta !== 0 && (
                        <span className={`text-[10px] font-mono ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {delta > 0 ? <TrendingUp className="h-3 w-3 inline" /> : <TrendingDown className="h-3 w-3 inline" />}
                        </span>
                      )}
                      {delta === 0 && <Minus className="h-3 w-3 text-muted-foreground/40" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-body font-medium text-foreground">{r.player.display_name}</p>
                    <p className="font-body text-xs text-muted-foreground">{r.player.nationality} · {r.player.gender === 'M' ? '♂' : '♀'}</p>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="font-mono text-sm text-muted-foreground">{r.tournamentsCount}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <div className="flex flex-col items-end gap-0.5">
                      {r.counted.slice(0, 3).map(p => (
                        <span key={p.id} className="font-mono text-[10px] text-muted-foreground">{p.points} ({p.round})</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono text-lg font-bold ${rank <= 3 ? 'text-gold' : 'text-foreground'}`}>
                      {r.total}
                    </span>
                  </td>
                </tr>
              )
            })}
            {ranked.every(r => r.total === 0) && (
              <tr><td colSpan={5} className="px-4 py-8 text-center font-body text-sm text-muted-foreground">
                Aucun point FIP enregistré pour la catégorie {activeCategory}.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="font-display text-lg text-gold leading-none">🥇</span>
  if (rank === 2) return <span className="font-display text-lg leading-none">🥈</span>
  if (rank === 3) return <span className="font-display text-lg leading-none">🥉</span>
  return <span className="font-mono text-sm text-muted-foreground">{rank}</span>
}
