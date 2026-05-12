'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BracketSlot {
  position:    number
  entryId:     string | null
  label:       string
  seed?:       number
  isQualifier: boolean
  isBye:       boolean
}

interface BracketMatch {
  matchNumber: number
  slot1:       BracketSlot
  slot2:       BracketSlot
  winnerId?:   string | null
}

interface BracketViewProps {
  slots:     BracketSlot[]
  drawSize:  number
  canEdit?:  boolean
  swapping?: string | null   // entryId currently being swapped (shows spinner)
  className?: string
}

// ─── BracketView ─────────────────────────────────────────────────────────────

export function BracketView({ slots, drawSize, canEdit = false, swapping, className }: BracketViewProps) {
  const r1Matches: BracketMatch[] = []
  for (let i = 0; i < drawSize; i += 2) {
    r1Matches.push({
      matchNumber: i / 2,
      slot1: slots[i]   ?? { position: i,   entryId: null, label: 'TBD', isQualifier: false, isBye: false },
      slot2: slots[i+1] ?? { position: i+1, entryId: null, label: 'TBD', isQualifier: false, isBye: false },
    })
  }

  const half      = r1Matches.length / 2
  const leftHalf  = r1Matches.slice(0, half)
  const rightHalf = [...r1Matches.slice(half)].reverse()

  return (
    <div className={cn('overflow-x-auto pb-2', className)}>
      {canEdit && (
        <p className="text-xs font-body text-muted-foreground mb-2 flex items-center gap-1">
          <GripVertical className="h-3 w-3" />
          Glissez les paires pour échanger leurs positions dans le tableau.
        </p>
      )}
      <div className="min-w-[520px] flex gap-0">
        {/* LEFT half */}
        <HalfBracket matches={leftHalf} side="left" drawSize={drawSize} canEdit={canEdit} swapping={swapping} />

        {/* Final center */}
        <div className="flex flex-col items-center justify-center px-3 min-w-[90px]">
          <div className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-center">
            <p className="font-display text-xs tracking-widest uppercase text-gold">Finale</p>
            <p className="font-body text-xs text-muted-foreground mt-0.5">TBD</p>
          </div>
        </div>

        {/* RIGHT half (mirrored) */}
        <HalfBracket matches={rightHalf} side="right" drawSize={drawSize} canEdit={canEdit} swapping={swapping} />
      </div>
    </div>
  )
}

// ─── HalfBracket ─────────────────────────────────────────────────────────────

function HalfBracket({
  matches, side, drawSize, canEdit, swapping,
}: {
  matches:   BracketMatch[]
  side:      'left' | 'right'
  drawSize:  number
  canEdit:   boolean
  swapping?: string | null
}) {
  const isLeft = side === 'left'

  return (
    <div className={cn('flex-1 flex gap-0', isLeft ? 'flex-row' : 'flex-row-reverse')}>
      {/* R1 column */}
      <div className="flex flex-col justify-around flex-1">
        {matches.map(m => (
          <BracketPair key={m.matchNumber} match={m} side={side} canEdit={canEdit} swapping={swapping} showConnector />
        ))}
      </div>

      {/* Subsequent rounds placeholder */}
      {drawSize >= 16 && (
        <div className="flex flex-col justify-around" style={{ width: 100 }}>
          {Array.from({ length: matches.length / 2 }).map((_, i) => (
            <div key={i} className={cn('flex items-center', isLeft ? 'justify-start' : 'justify-end')}>
              <PlaceholderSlot label="→ TBD" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── BracketPair ─────────────────────────────────────────────────────────────

function BracketPair({
  match, side, canEdit, swapping, showConnector,
}: {
  match:          BracketMatch
  side:           'left' | 'right'
  canEdit:        boolean
  swapping?:      string | null
  showConnector?: boolean
}) {
  const isLeft = side === 'left'

  return (
    <div className="flex items-stretch my-0.5">
      <div className={cn('flex flex-col', isLeft ? 'items-end' : 'items-start')}>
        <div className={cn(
          'flex items-center border-border border',
          isLeft ? 'border-r border-b border-t' : 'border-l border-b border-t',
        )}>
          <DraggableSlot slot={match.slot1} canEdit={canEdit} isSwapping={swapping === match.slot1.entryId} />
        </div>
        <div className={cn(
          'flex items-center border-border border-x border-b',
          isLeft ? 'border-r border-b' : 'border-l border-b',
        )}>
          <DraggableSlot slot={match.slot2} canEdit={canEdit} isSwapping={swapping === match.slot2.entryId} />
        </div>
      </div>

      {showConnector && (
        <div className="w-3 border-border border-t self-center" />
      )}
    </div>
  )
}

// ─── DraggableSlot ────────────────────────────────────────────────────────────

function DraggableSlot({
  slot, canEdit, isSwapping,
}: {
  slot:       BracketSlot
  canEdit:    boolean
  isSwapping: boolean
}) {
  const id = `pos-${slot.position}`
  const draggable = useDraggable({ id, disabled: !canEdit || !slot.entryId || slot.isBye })
  const droppable = useDroppable({ id, disabled: !canEdit || slot.isBye })

  // Combine refs
  function setRef(el: HTMLElement | null) {
    draggable.setNodeRef(el)
    droppable.setNodeRef(el)
  }

  if (slot.isBye) {
    return (
      <div className="px-2 py-1.5 w-36 bg-court-panel/50">
        <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">BYE</span>
      </div>
    )
  }

  const canDrag = canEdit && !!slot.entryId

  return (
    <div
      ref={setRef}
      {...(canDrag ? draggable.attributes : {})}
      {...(canDrag ? draggable.listeners : {})}
      className={cn(
        'px-2 py-1.5 w-36 bg-court-card flex items-center gap-1 touch-none select-none',
        slot.seed     && 'bg-gold/5',
        canDrag       && 'cursor-grab active:cursor-grabbing',
        draggable.isDragging && 'opacity-40',
        droppable.isOver     && 'ring-1 ring-inset ring-gold/60 bg-gold/10',
        isSwapping           && 'opacity-60 animate-pulse',
      )}
    >
      {canDrag && (
        <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
      )}
      <div className="min-w-0 flex-1">
        {slot.seed && (
          <span className="font-mono text-[10px] text-gold mr-1">[{slot.seed}]</span>
        )}
        {slot.isQualifier && (
          <span className="font-mono text-[10px] text-blue-400 mr-1">{slot.label.split(' ')[0]}</span>
        )}
        <span className={cn(
          'font-body text-[11px] truncate block leading-tight',
          slot.entryId ? 'text-foreground' : 'text-muted-foreground',
        )}>
          {slot.isQualifier ? slot.label.slice(slot.label.indexOf(' ') + 1) : slot.label}
        </span>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function PlaceholderSlot({ label }: { label: string }) {
  return (
    <div className="px-2 py-1.5 w-28 rounded border border-dashed border-border">
      <span className="font-body text-[10px] text-muted-foreground/50">{label}</span>
    </div>
  )
}

/** Extract slot position number from a DnD id like "pos-7" */
export function posFromDndId(id: string): number {
  return parseInt(id.replace('pos-', ''), 10)
}
