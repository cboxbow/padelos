'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import { GripVertical, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL_H  = 36   // px — height of one entry slot
const CONN_W  = 20   // px — width of horizontal connector arm
const COL_W   = 176  // px — width of one round column
const ROUND_LABELS: Record<number, string> = {
  1: 'R32', 2: 'R16', 3: 'Quarts', 4: 'Demies', 5: 'Finale',
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface BracketSlot {
  position:    number
  entryId:     string | null
  label:       string
  seed?:       number
  isQualifier: boolean
  isBye:       boolean
}

export interface BracketViewProps {
  slots:     BracketSlot[]
  drawSize:  number
  canEdit?:  boolean
  swapping?: string | null
  className?: string
}

/** Extract slot position number from a DnD id like "pos-7" */
export function posFromDndId(id: string): number {
  return parseInt(id.replace('pos-', ''), 10)
}

// ─── BracketView ─────────────────────────────────────────────────────────────

export function BracketView({
  slots, drawSize, canEdit = false, swapping, className,
}: BracketViewProps) {
  const numRounds = Math.log2(drawSize)          // 5 for draw-32
  const totalH    = drawSize * CELL_H            // total bracket height in px
  const totalW    = numRounds * (COL_W + CONN_W) + COL_W + 16

  return (
    <div className={cn('overflow-x-auto overflow-y-visible pb-4', className)}>
      {canEdit && (
        <p className="flex items-center gap-1 text-xs font-body text-muted-foreground mb-3">
          <GripVertical className="h-3 w-3" />
          Glissez les paires pour échanger leurs positions dans le tableau.
        </p>
      )}

      {/* Round headers */}
      <div className="flex mb-1" style={{ width: totalW }}>
        {Array.from({ length: numRounds }, (_, r) => (
          <div
            key={r}
            style={{ width: COL_W + CONN_W }}
            className="shrink-0 text-center text-[10px] font-display tracking-widest uppercase text-muted-foreground/60 pb-1"
          >
            {ROUND_LABELS[r + 1] ?? `R${r + 1}`}
          </div>
        ))}
        <div
          style={{ width: COL_W }}
          className="shrink-0 text-center text-[10px] font-display tracking-widest uppercase text-gold/70 pb-1"
        >
          Champion
        </div>
      </div>

      {/* Bracket body — absolutely positioned matches */}
      <div className="relative" style={{ width: totalW, height: totalH }}>
        {Array.from({ length: numRounds }, (_, r) => {
          const numMatches = drawSize / Math.pow(2, r + 1)
          const matchH     = totalH / numMatches

          return Array.from({ length: numMatches }, (_, m) => {
            const yTop = m * matchH
            const xLeft = r * (COL_W + CONN_W)

            const slot1: BracketSlot | undefined = r === 0 ? slots[m * 2]     : undefined
            const slot2: BracketSlot | undefined = r === 0 ? slots[m * 2 + 1] : undefined

            return (
              <MatchBlock
                key={`r${r}m${m}`}
                x={xLeft}
                y={yTop}
                matchH={matchH}
                slot1={slot1}
                slot2={slot2}
                roundIndex={r}
                isLastRound={r === numRounds - 1}
                canEdit={canEdit && r === 0}
                swapping={swapping}
              />
            )
          })
        })}

        {/* Champion / Winner slot */}
        <div
          style={{
            position: 'absolute',
            left: numRounds * (COL_W + CONN_W),
            top:  totalH / 2 - CELL_H / 2,
            width: COL_W,
          }}
        >
          <ChampionSlot />
        </div>
      </div>
    </div>
  )
}

// ─── MatchBlock ───────────────────────────────────────────────────────────────

function MatchBlock({
  x, y, matchH, slot1, slot2, roundIndex, isLastRound, canEdit, swapping,
}: {
  x: number; y: number; matchH: number
  slot1?: BracketSlot; slot2?: BracketSlot
  roundIndex: number; isLastRound: boolean
  canEdit: boolean; swapping?: string | null
}) {
  // Entry 1 at top; entry 2 at bottom; vertical connector between them
  const entry1Top = 0
  const entry2Top = matchH - CELL_H
  const midY      = matchH / 2

  // Vertical arm heights
  const topArmH    = midY - CELL_H / 2           // from bottom of slot1 to midpoint
  const bottomArmH = entry2Top - midY + CELL_H / 2 // from midpoint to top of slot2

  return (
    <div style={{ position: 'absolute', left: x, top: y, width: COL_W + CONN_W, height: matchH }}>
      {/* Entry slot 1 */}
      <div style={{ position: 'absolute', top: entry1Top, width: COL_W }}>
        {roundIndex === 0 && slot1
          ? <DraggableSlot slot={slot1} canEdit={canEdit} isSwapping={swapping === slot1.entryId} />
          : <TbdSlot isFuture={roundIndex > 0} />
        }
      </div>

      {/* Entry slot 2 */}
      <div style={{ position: 'absolute', top: entry2Top, width: COL_W }}>
        {roundIndex === 0 && slot2
          ? <DraggableSlot slot={slot2} canEdit={canEdit} isSwapping={swapping === slot2.entryId} />
          : <TbdSlot isFuture={roundIndex > 0} />
        }
      </div>

      {/* Connector lines (right side of the match column) */}
      {!isLastRound && (
        <>
          {/* Top vertical arm */}
          <div style={{
            position: 'absolute',
            left: COL_W - 1,
            top:  entry1Top + CELL_H / 2,
            width: 1,
            height: topArmH,
          }} className="bg-border" />

          {/* Bottom vertical arm */}
          <div style={{
            position: 'absolute',
            left: COL_W - 1,
            top:  midY,
            width: 1,
            height: bottomArmH,
          }} className="bg-border" />

          {/* Horizontal line at midpoint */}
          <div style={{
            position: 'absolute',
            left: COL_W - 1,
            top:  midY,
            width: CONN_W + 1,
            height: 1,
          }} className="bg-border" />
        </>
      )}

      {/* Last round: just horizontal to champion slot */}
      {isLastRound && (
        <div style={{
          position: 'absolute',
          left: COL_W - 1,
          top:  midY,
          width: CONN_W + 1,
          height: 1,
        }} className="bg-border" />
      )}
    </div>
  )
}

// ─── DraggableSlot ────────────────────────────────────────────────────────────

function DraggableSlot({
  slot, canEdit, isSwapping,
}: {
  slot: BracketSlot; canEdit: boolean; isSwapping: boolean
}) {
  const id = `pos-${slot.position}`
  // ALL slots are draggable when canEdit (including BYEs — admin can move them)
  const draggable = useDraggable({ id, disabled: !canEdit })
  const droppable = useDroppable({ id, disabled: !canEdit })

  function setRef(el: HTMLElement | null) {
    draggable.setNodeRef(el)
    droppable.setNodeRef(el)
  }

  const isBye = slot.isBye
  const isOver = droppable.isOver
  const isDragging = draggable.isDragging

  if (isBye) {
    return (
      <div
        ref={setRef}
        {...(canEdit ? draggable.attributes : {})}
        {...(canEdit ? draggable.listeners : {})}
        className={cn(
          'flex items-center gap-1 px-2 bg-court/50 border border-dashed border-border/40 touch-none select-none overflow-hidden',
          canEdit   && 'cursor-grab active:cursor-grabbing hover:border-border hover:bg-court-panel/40',
          isDragging && 'opacity-40',
          isOver     && 'ring-1 ring-inset ring-gold/40 bg-gold/5 border-gold/30',
          isSwapping && 'opacity-60 animate-pulse',
        )}
        style={{ height: CELL_H }}
      >
        {canEdit && <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/20" />}
        <span className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest">BYE</span>
      </div>
    )
  }

  return (
    <div
      ref={setRef}
      {...(canEdit ? draggable.attributes : {})}
      {...(canEdit ? draggable.listeners : {})}
      className={cn(
        'flex items-center gap-1 px-2 bg-court-card border border-border touch-none select-none overflow-hidden',
        slot.seed  && 'bg-gold/5 border-gold/20',
        canEdit    && 'cursor-grab active:cursor-grabbing hover:border-gold/30',
        isDragging && 'opacity-40',
        isOver     && 'ring-1 ring-inset ring-gold/60 bg-gold/10 border-gold/40',
        isSwapping && 'opacity-60 animate-pulse',
      )}
      style={{ height: CELL_H }}
    >
      {canEdit && <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/25" />}
      <div className="min-w-0 flex-1 flex items-center gap-1">
        {slot.seed && (
          <span className="font-mono text-[10px] text-gold shrink-0 flex items-center gap-0.5">
            <Crown className="h-2.5 w-2.5" />
            {slot.seed}
          </span>
        )}
        <span className={cn(
          'font-body text-[11px] leading-tight truncate',
          slot.entryId ? 'text-foreground' : 'text-muted-foreground/50',
        )}>
          {slot.label}
        </span>
      </div>
    </div>
  )
}

// ─── ByeSlot ─────────────────────────────────────────────────────────────────

function ByeSlot() {
  return (
    <div
      className="flex items-center px-3 bg-court/50 border border-dashed border-border/40"
      style={{ height: CELL_H }}
    >
      <span className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest">BYE</span>
    </div>
  )
}

// ─── TbdSlot ──────────────────────────────────────────────────────────────────

function TbdSlot({ isFuture }: { isFuture: boolean }) {
  if (!isFuture) return <ByeSlot />
  return (
    <div
      className="flex items-center px-3 bg-court-panel/30 border border-dashed border-border/30"
      style={{ height: CELL_H }}
    >
      <span className="font-body text-[10px] text-muted-foreground/25">— TBD —</span>
    </div>
  )
}

// ─── ChampionSlot ─────────────────────────────────────────────────────────────

function ChampionSlot() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border border-gold/40 bg-gold/5 px-3"
      style={{ height: CELL_H * 2 }}
    >
      <Crown className="h-4 w-4 text-gold mb-1" />
      <span className="font-display text-[10px] tracking-widest uppercase text-gold">Champion</span>
    </div>
  )
}
