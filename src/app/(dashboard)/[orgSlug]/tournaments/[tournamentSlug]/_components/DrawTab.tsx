'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Shuffle, Trophy, GripVertical, Users, Crown } from 'lucide-react'
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

type QualPerGroup = 1 | 2 | 3 | 4

// ─── DrawTab ──────────────────────────────────────────────────────────────────

export function DrawTab({ tournamentSlug, tournament, initialMatches, entries, groupsCount }: DrawTabProps) {
  const router  = useRouter()
  const canEdit = ['draft', 'registration', 'active'].includes(tournament.status)

  const [matches]   = useState<MatchRow[]>(initialMatches)
  const [localSlots, setLocalSlots] = useState<BracketSlot[] | null>(null)
  const [generating, startGen]  = useTransition()
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  const [swapping, setSwapping] = useState<string | null>(null)
  const [qualPerGroup, setQualPerGroup] = useState<QualPerGroup>(1)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const mainDrawMatches = matches.filter(m => m.phase !== 'qualification')
  const hasDrawGenerated = mainDrawMatches.length > 0
  const canGenerate      = tournament.status === 'active' && groupsCount > 0
  const canDragDrop      = canEdit && hasDrawGenerated

  const entryMap = Object.fromEntries(entries.map(e => [e.id, e]))

  // ── Build slots from persisted matches ────────────────────────────────────────

  function buildSlotsFromMatches(matchList: MatchRow[]): BracketSlot[] {
    const r1 = matchList
      .filter(m => m.phase !== 'qualification')
      .sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0))
    const out: BracketSlot[] = []
    r1.forEach(m => {
      out.push(makeSlot(out.length, m.entry1_id))
      out.push(makeSlot(out.length, m.entry2_id))
    })
    return out
  }

  function makeSlot(pos: number, entryId: string | null | undefined): BracketSlot {
    if (!entryId) {
      return { position: pos, entryId: null, label: 'BYE', isQualifier: false, isBye: true }
    }
    const entry = entryMap[entryId]
    if (!entry) {
      return { position: pos, entryId, label: '?', isQualifier: false, isBye: false }
    }
    return {
      position:    pos,
      entryId:     entry.id,
      label:       `${entry.player1_name ?? '?'} / ${entry.player2_name ?? '?'}`,
      seed:        entry.seed ?? undefined,
      isQualifier: !entry.seed,
      isBye:       false,
    }
  }

  // ── Generate draw ─────────────────────────────────────────────────────────────

  function generate() {
    startGen(async () => {
      const res  = await fetch(`/api/tournaments/${tournamentSlug}/generate-draw`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ qualifiersPerGroup: qualPerGroup }),
      })
      const json = await res.json() as {
        ok?: boolean; error?: string; slots?: BracketSlot[]
        drawSize?: number; totalTeams?: number; byeCount?: number
        directCount?: number; qualifiedCount?: number
      }
      if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }

      toast.success(
        `Draw ${json.drawSize} généré — ${json.directCount} direct(s) + ${json.qualifiedCount} qualifié(s) + ${json.byeCount} BYE(s)`
      )
      setLocalSlots(json.slots ?? [])
      router.refresh()
    })
  }

  // ── DnD ──────────────────────────────────────────────────────────────────────

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
    if (!slotA || !slotB) return

    // Optimistic swap — works for BYE↔team, BYE↔BYE, team↔team
    setLocalSlots(currentSlots.map(s => {
      if (s.position === posA) return { ...slotB, position: posA }
      if (s.position === posB) return { ...slotA, position: posB }
      return s
    }))

    const swapKey = slotA.entryId ?? `bye-${posA}`
    setSwapping(swapKey)
    try {
      const res = await fetch(`/api/tournaments/${tournamentSlug}/draw/swap`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ positionA: posA, positionB: posB }),
      })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        toast.error(json.error ?? 'Erreur lors du swap')
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

  function nextPow2(n: number) { return Math.pow(2, Math.ceil(Math.log2(Math.max(n, 4)))) }
  const drawSize = nextPow2(Math.max(displaySlots.length, 4))

  // Count stats for header
  const teamCount = displaySlots.filter(s => !s.isBye).length
  const byeCount  = displaySlots.filter(s =>  s.isBye).length
  const seedCount = displaySlots.filter(s => !s.isBye && s.seed).length

  // Active dragged slot info (for overlay)
  const activePosNum = activeSlotId ? posFromDndId(activeSlotId) : -1
  const activeSlot   = displaySlots.find(s => s.position === activePosNum)

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-5">

        {/* ── Config + Generate ───────────────────────────────────────────── */}
        {canGenerate && (
          <div className="rounded-xl border border-gold/20 bg-gold/5 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 space-y-1">
                <p className="font-body font-semibold text-foreground flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-gold" />
                  {hasDrawGenerated ? 'Régénérer le tableau' : 'Générer le tableau principal'}
                </p>
                <p className="font-body text-sm text-muted-foreground">
                  Seuls les <strong className="text-foreground">directs</strong> (têtes de série) et les{' '}
                  <strong className="text-foreground">qualifiés des groupes</strong> sont placés dans le tableau.
                  Les BYEs complètent les slots restants.
                </p>
              </div>
              <Button
                onClick={generate} disabled={generating}
                className="bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase shrink-0"
              >
                <Shuffle className="mr-2 h-4 w-4" />
                {generating ? 'Génération…' : hasDrawGenerated ? 'Régénérer' : 'Générer'}
              </Button>
            </div>

            {/* Qualifiers per group selector */}
            <div className="flex items-center gap-3 pt-1 border-t border-gold/10">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-body text-sm text-muted-foreground">Qualifiés par groupe :</span>
              <div className="flex gap-1">
                {([1, 2, 3, 4] as QualPerGroup[]).map(n => (
                  <button
                    key={n}
                    onClick={() => setQualPerGroup(n)}
                    className={cn(
                      'w-8 h-8 rounded font-body text-sm font-semibold transition-colors',
                      qualPerGroup === n
                        ? 'bg-gold text-black'
                        : 'bg-court-panel border border-border text-muted-foreground hover:border-gold/40 hover:text-foreground',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="font-body text-xs text-muted-foreground">
                → {groupsCount} groupes × {qualPerGroup} = <strong className="text-foreground">{groupsCount * qualPerGroup} qualifié(s)</strong>
              </span>
            </div>
          </div>
        )}

        {/* ── Bracket ─────────────────────────────────────────────────────── */}
        {displaySlots.length > 0 ? (
          <div className="space-y-3">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-lg tracking-wider uppercase text-foreground">
                Tableau — Draw {drawSize}
              </h3>
              <div className="flex flex-wrap gap-3 text-xs font-body text-muted-foreground">
                {seedCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Crown className="h-3 w-3 text-gold" /> {seedCount} tête{seedCount > 1 ? 's' : ''} de série
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm bg-foreground/30" /> {teamCount} équipes
                </span>
                {byeCount > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-sm border border-dashed border-border/60" /> {byeCount} BYE{byeCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {canEdit && (
                <Button
                  variant="outline" size="sm"
                  onClick={generate} disabled={generating || !canGenerate}
                  className="ml-auto text-xs border-border/60 text-muted-foreground hover:text-foreground"
                >
                  <Shuffle className="mr-1.5 h-3 w-3" />
                  {generating ? 'Régénération…' : 'Régénérer'}
                </Button>
              )}
            </div>

            {canDragDrop && (
              <p className="text-xs font-body text-muted-foreground flex items-center gap-1.5">
                <GripVertical className="h-3 w-3" />
                Glissez n&apos;importe quel slot (équipe ou BYE) pour échanger sa position.
              </p>
            )}

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
            {activeSlot.isBye ? (
              <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">BYE</span>
            ) : (
              <>
                {activeSlot.seed && <Crown className="h-3 w-3 text-gold" />}
                <span className="text-foreground">{activeSlot.label}</span>
              </>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

function EmptyDrawState({ groupsCount }: { groupsCount: number }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-court-card p-12 text-center space-y-3">
      <Trophy className="mx-auto h-10 w-10 text-muted-foreground/30" />
      <p className="font-body font-medium text-foreground">Tableau non généré</p>
      <p className="font-body text-sm text-muted-foreground">
        {groupsCount === 0
          ? 'Créez d\'abord les groupes de qualification (onglet Groupes).'
          : 'Configurez le nombre de qualifiés par groupe, puis cliquez sur "Générer".'}
      </p>
    </div>
  )
}
