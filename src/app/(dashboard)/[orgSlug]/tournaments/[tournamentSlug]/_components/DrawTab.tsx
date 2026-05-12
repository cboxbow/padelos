'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Shuffle, Trophy, GripVertical } from 'lucide-react'
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import { BracketView, posFromDndId } from './BracketView'
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
  const canEdit = ['draft', 'registration', 'active'].includes(tournament.status)
  const router                  = useRouter()
  const [matches, setMatches]   = useState<MatchRow[]>(initialMatches)
  const [localSlots, setLocalSlots] = useState<BracketSlot[] | null>(null)
  const [generating, startGen]  = useTransition()
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  const [swapping, setSwapping] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const mainDrawMatches = matches.filter(m => m.phase !== 'qualification')
  const hasDrawGenerated = mainDrawMatches.length > 0
  const canGenerate      = tournament.status === 'active' && groupsCount > 0 && !hasDrawGenerated
  const canDragDrop      = canEdit && hasDrawGenerated

  // Entry lookup
  const entryMap = Object.fromEntries(entries.map(e => [e.id, e]))

  function buildSlotsFromMatches(matchList: MatchRow[]): BracketSlot[] {
    const r1 = matchList
      .filter(m => m.phase !== 'qualification')
      .sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0))
    const out: BracketSlot[] = []
    r1.forEach(m => {
      const e1 = m.entry1_id ? entryMap[m.entry1_id] : null
      const e2 = m.entry2_id ? entryMap[m.entry2_id] : null
      out.push(makeSlot(out.length, e1, m.status === 'bye'))
      out.push(makeSlot(out.length, e2, m.status === 'bye'))
    })
    return out
  }

  function makeSlot(pos: number, entry: EntryRow | null | undefined, _matchIsBye: boolean): BracketSlot {
    // Always show a real entry, even when the match is a bye (opponent = BYE)
    if (entry) {
      return {
        position:    pos,
        entryId:     entry.id,
        label:       `${entry.player1_name ?? '?'} / ${entry.player2_name ?? '?'}`,
        seed:        entry.seed ?? undefined,
        isQualifier: !entry.seed,
        isBye:       false,
      }
    }
    // No entry linked → genuine BYE slot
    return { position: pos, entryId: null, label: 'BYE', isQualifier: false, isBye: true }
  }

  function generate() {
    startGen(async () => {
      const res  = await fetch(`/api/tournaments/${tournamentSlug}/generate-draw`, { method: 'POST' })
      const json = await res.json() as { ok?: boolean; error?: string; slots?: BracketSlot[]; drawSize?: number }
      if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }
      toast.success(`Tableau de ${json.drawSize} généré !`)
      setLocalSlots(json.slots ?? [])
      router.refresh()
    })
  }

  // ── DnD handlers ────────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    setActiveSlotId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveSlotId(null)
    if (!over || active.id === over.id) return

    const posA = posFromDndId(active.id as string)
    const posB = posFromDndId(over.id   as string)

    const currentSlots = localSlots ?? buildSlotsFromMatches(mainDrawMatches)
    const slotA = currentSlots.find(s => s.position === posA)
    const slotB = currentSlots.find(s => s.position === posB)

    if (!slotA?.entryId || !slotB?.entryId) return

    const entryIdA = slotA.entryId
    const entryIdB = slotB.entryId

    // Optimistic swap
    setLocalSlots(currentSlots.map(s => {
      if (s.position === posA) return { ...s, entryId: entryIdB, label: slotB.label, seed: slotB.seed, isQualifier: slotB.isQualifier }
      if (s.position === posB) return { ...s, entryId: entryIdA, label: slotA.label, seed: slotA.seed, isQualifier: slotA.isQualifier }
      return s
    }))

    setSwapping(entryIdA)
    try {
      const res = await fetch(`/api/tournaments/${tournamentSlug}/draw/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIdA, entryIdB }),
      })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        toast.error(json.error ?? 'Erreur lors du swap')
        // Revert optimistic update
        setLocalSlots(currentSlots)
        return
      }
      toast.success('Positions échangées')
      router.refresh()
    } finally {
      setSwapping(null)
    }
  }

  // ── Display ──────────────────────────────────────────────────────────────────

  const displaySlots = localSlots
    ?? (hasDrawGenerated ? buildSlotsFromMatches(mainDrawMatches) : [])

  // Draw size must be a power of 2 for the bracket tree to work
  function nextPow2(n: number) { return Math.pow(2, Math.ceil(Math.log2(Math.max(n, 2)))) }
  const rawSize  = Math.max(displaySlots.length, tournament.max_pairs)
  const drawSize = nextPow2(rawSize)

  // Active dragged slot (for overlay)
  const activePosNum = activeSlotId ? posFromDndId(activeSlotId) : -1
  const activeSlot   = displaySlots.find(s => s.position === activePosNum)

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-lg tracking-wider uppercase text-foreground">
                Tableau — Draw {drawSize}
              </h3>
              <div className="flex gap-3 text-xs font-body text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-gold/60" /> Tête de série</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-border" /> BYE</span>
              </div>
              {canEdit && (
                <Button
                  variant="outline" size="sm"
                  onClick={generate} disabled={generating}
                  className="ml-auto text-xs border-border/60 text-muted-foreground hover:text-foreground"
                >
                  <Shuffle className="mr-1.5 h-3 w-3" />
                  {generating ? 'Régénération…' : 'Régénérer'}
                </Button>
              )}
            </div>
            <BracketView
              slots={displaySlots}
              drawSize={drawSize}
              canEdit={canDragDrop}
              swapping={swapping}
            />
          </div>
        ) : !canGenerate && (
          <EmptyDrawState groupsCount={groupsCount} />
        )}
      </div>

      {/* DragOverlay */}
      <DragOverlay>
        {activeSlot && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-body bg-court-panel border border-gold/40 rounded shadow-xl opacity-95">
            <GripVertical className="h-3.5 w-3.5 text-gold" />
            {activeSlot.seed && (
              <span className="font-mono text-[10px] text-gold">[{activeSlot.seed}]</span>
            )}
            <span className="text-foreground">{activeSlot.label}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
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
