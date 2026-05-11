import type { Metadata }         from 'next'
import { notFound }               from 'next/navigation'
import { Trophy }                 from 'lucide-react'
import { createClient }           from '@/lib/supabase/server'
import { PublicBracketLive }      from './_components/PublicBracketLive'
import type { BracketSlot }       from '@/app/(dashboard)/[orgSlug]/tournaments/[tournamentSlug]/_components/BracketView'
import type { TableRow }          from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type TournRow = Pick<TableRow<'tournaments'>, 'id' | 'name' | 'max_pairs'>
type MatchRow = Pick<TableRow<'matches'>, 'id' | 'phase' | 'status' | 'match_number' | 'entry1_id' | 'entry2_id' | 'winner_id'>
type EntryRow = Pick<TableRow<'tournament_entries'>, 'id' | 'seed' | 'player1_name' | 'player2_name'>

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
  return { title: t ? `Tableau — ${t.name}` : 'Tableau' }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicBracketPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>
}) {
  const { tournamentSlug } = await params
  const supabase = await createClient()

  // Tournament
  const tRes = await supabase
    .from('tournaments')
    .select('id, name, max_pairs')
    .eq('slug', tournamentSlug)
    .maybeSingle()
  const t = tRes.data as TournRow | null
  if (!t) notFound()

  // Main draw matches
  const { data: matchData } = await supabase
    .from('matches')
    .select('id, phase, status, match_number, entry1_id, entry2_id, winner_id')
    .eq('tournament_id', t.id)
    .neq('phase', 'qualification')
    .order('match_number')
  const matches = (matchData ?? []) as MatchRow[]

  if (matches.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <Trophy className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="font-body text-muted-foreground">Tableau principal non encore généré.</p>
      </div>
    )
  }

  // Entries for labels
  const entryIds = [...new Set([
    ...matches.map(m => m.entry1_id),
    ...matches.map(m => m.entry2_id),
  ].filter(Boolean))] as string[]

  const { data: entryData } = await supabase
    .from('tournament_entries')
    .select('id, seed, player1_name, player2_name')
    .in('id', entryIds)
  const entries  = (entryData ?? []) as EntryRow[]
  const entryMap = new Map(entries.map(e => [e.id, e]))

  // Build BracketSlots
  function makeSlot(pos: number, entryId: string | null, isBye: boolean): BracketSlot {
    if (isBye || !entryId) {
      return { position: pos, entryId: null, label: 'BYE', isQualifier: false, isBye: true }
    }
    const e = entryMap.get(entryId)
    if (!e) return { position: pos, entryId, label: 'TBD', isQualifier: false, isBye: false }
    return {
      position:    pos,
      entryId:     e.id,
      label:       `${e.player1_name ?? '?'} / ${e.player2_name ?? '?'}`,
      seed:        e.seed ?? undefined,
      isQualifier: !e.seed,
      isBye:       false,
    }
  }

  const r1Matches = matches
    .filter(m => m.phase !== 'qualification')
    .sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0))

  const slots: BracketSlot[] = []
  r1Matches.forEach(m => {
    slots.push(makeSlot(slots.length, m.entry1_id, m.status === 'bye'))
    slots.push(makeSlot(slots.length, m.entry2_id, m.status === 'bye'))
  })

  const drawSize  = Math.max(slots.length, t.max_pairs)
  const liveIds   = matches.filter(m => m.status === 'live').map(m => m.id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg tracking-widest uppercase text-foreground">
          Tableau principal — Draw {drawSize}
        </h2>
        <div className="flex gap-3 text-xs font-body text-muted-foreground">
          <span><span className="text-gold">■</span> Tête de série</span>
          <span><span className="text-blue-400">■</span> Qualifié</span>
        </div>
      </div>

      <PublicBracketLive
        tournamentId={t.id}
        slots={slots}
        drawSize={drawSize}
        liveMatchIds={liveIds}
      />
    </div>
  )
}
