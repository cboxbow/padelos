'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Shuffle, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BracketView } from './BracketView'
import type { BracketSlot } from './BracketView'
import type { TableRow } from '@/types'

type TournRow  = Pick<TableRow<'tournaments'>, 'id' | 'slug' | 'status' | 'max_pairs'>
type MatchRow  = Pick<TableRow<'matches'>, 'id' | 'match_number' | 'entry1_id' | 'entry2_id' | 'status' | 'phase'>
type EntryRow  = Pick<TableRow<'tournament_entries'>, 'id' | 'seed' | 'player1_name' | 'player2_name'>

interface DrawTabProps {
  tournamentSlug: string
  tournament:     TournRow
  initialMatches: MatchRow[]
  entries:        EntryRow[]
  groupsCount:    number
}

// ─── DrawTab ──────────────────────────────────────────────────────────────────

export function DrawTab({ tournamentSlug, tournament, initialMatches, entries, groupsCount }: DrawTabProps) {
  const router                  = useRouter()
  const [matches, setMatches]   = useState<MatchRow[]>(initialMatches)
  const [slots,   setSlots]     = useState<BracketSlot[]>([])
  const [generating, startGen]  = useTransition()

  const mainDrawMatches = matches.filter(m => m.phase !== 'qualification')
  const hasDrawGenerated = mainDrawMatches.length > 0
  const canGenerate      = tournament.status === 'active' && groupsCount > 0 && !hasDrawGenerated

  // Entry lookup
  const entryMap = Object.fromEntries(entries.map(e => [e.id, e]))

  // Build slots from matches (if already generated)
  function buildSlotsFromMatches(matchList: MatchRow[]): BracketSlot[] {
    const r1 = matchList.filter(m => m.phase !== 'qualification').sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0))
    const out: BracketSlot[] = []
    r1.forEach(m => {
      const e1 = m.entry1_id ? entryMap[m.entry1_id] : null
      const e2 = m.entry2_id ? entryMap[m.entry2_id] : null
      out.push(makeSlot(out.length, e1, m.status === 'bye'))
      out.push(makeSlot(out.length, e2, m.status === 'bye'))
    })
    return out
  }

  function makeSlot(pos: number, entry: EntryRow | null | undefined, isBye: boolean): BracketSlot {
    if (isBye || !entry) return { position: pos, entryId: null, label: 'BYE', isQualifier: false, isBye: true }
    return {
      position:    pos,
      entryId:     entry.id,
      label:       `${entry.player1_name ?? '?'} / ${entry.player2_name ?? '?'}`,
      seed:        entry.seed ?? undefined,
      isQualifier: !entry.seed,
      isBye:       false,
    }
  }

  function generate() {
    startGen(async () => {
      const res  = await fetch(`/api/tournaments/${tournamentSlug}/generate-draw`, { method: 'POST' })
      const json = await res.json() as { ok?: boolean; error?: string; slots?: BracketSlot[]; drawSize?: number }
      if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }

      toast.success(`Tableau de ${json.drawSize} généré !`)
      setSlots(json.slots ?? [])
      router.refresh()
    })
  }

  const displaySlots = slots.length > 0
    ? slots
    : hasDrawGenerated
      ? buildSlotsFromMatches(mainDrawMatches)
      : []

  const drawSize = Math.max(displaySlots.length, tournament.max_pairs)

  return (
    <div className="space-y-6">
      {/* Generate button */}
      {canGenerate && (
        <div className="rounded-xl border border-gold/20 bg-gold/5 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 space-y-1">
            <p className="font-body font-semibold text-foreground">Tableau principal prêt à être généré</p>
            <p className="font-body text-sm text-muted-foreground">
              Seeds directs aux positions FIP · Qualifiés dans les slots restants · BYE pour compléter
            </p>
          </div>
          <Button onClick={generate} disabled={generating}
            className="bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase shrink-0">
            <Shuffle className="mr-2 h-4 w-4" />
            {generating ? 'Génération…' : 'Générer le tableau'}
          </Button>
        </div>
      )}

      {/* Bracket */}
      {displaySlots.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg tracking-wider uppercase text-foreground">
              Tableau — Draw {drawSize}
            </h3>
            <div className="flex gap-3 text-xs font-body text-muted-foreground">
              <span><span className="text-gold">■</span> Tête de série</span>
              <span><span className="text-blue-400">■</span> Qualifié</span>
              <span><span className="text-muted-foreground/40">■</span> BYE</span>
            </div>
          </div>
          <BracketView slots={displaySlots} drawSize={drawSize} />
        </div>
      ) : !canGenerate && (
        <EmptyDrawState groupsCount={groupsCount} />
      )}
    </div>
  )
}

function EmptyDrawState({ groupsCount }: { groupsCount: number }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-court-card p-12 text-center space-y-3">
      <Trophy className="mx-auto h-10 w-10 text-muted-foreground/30" />
      <p className="font-body font-medium text-foreground">Tableau non généré</p>
      <p className="font-body text-sm text-muted-foreground">
        {groupsCount === 0
          ? 'Générez d\'abord les groupes de qualification (onglet Groupes).'
          : 'Lancez la génération du tableau depuis l\'onglet Groupes une fois les matchs terminés.'}
      </p>
    </div>
  )
}
