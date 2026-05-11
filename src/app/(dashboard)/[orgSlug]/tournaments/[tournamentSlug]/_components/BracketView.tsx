'use client'

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
  className?: string
}

// ─── BracketView ─────────────────────────────────────────────────────────────

export function BracketView({ slots, drawSize, className }: BracketViewProps) {
  // Build R1 matches from adjacent slot pairs
  const r1Matches: BracketMatch[] = []
  for (let i = 0; i < drawSize; i += 2) {
    r1Matches.push({
      matchNumber: i / 2,
      slot1:       slots[i]   ?? { position: i,   entryId: null, label: 'TBD', isQualifier: false, isBye: false },
      slot2:       slots[i+1] ?? { position: i+1, entryId: null, label: 'TBD', isQualifier: false, isBye: false },
    })
  }

  // Split into top half (left) and bottom half (right)
  const half     = r1Matches.length / 2
  const leftHalf = r1Matches.slice(0, half)
  const rightHalf = [...r1Matches.slice(half)].reverse()

  return (
    <div className={cn('overflow-x-auto pb-2', className)}>
      <div className="min-w-[520px] flex gap-0">
        {/* LEFT half */}
        <HalfBracket matches={leftHalf} side="left" drawSize={drawSize} />

        {/* Final center */}
        <div className="flex flex-col items-center justify-center px-3 min-w-[90px]">
          <div className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-center">
            <p className="font-display text-xs tracking-widest uppercase text-gold">Finale</p>
            <p className="font-body text-xs text-muted-foreground mt-0.5">TBD</p>
          </div>
        </div>

        {/* RIGHT half (mirrored) */}
        <HalfBracket matches={rightHalf} side="right" drawSize={drawSize} />
      </div>
    </div>
  )
}

// ─── HalfBracket ─────────────────────────────────────────────────────────────

function HalfBracket({
  matches, side, drawSize,
}: {
  matches:  BracketMatch[]
  side:     'left' | 'right'
  drawSize: number
}) {
  const isLeft = side === 'left'

  return (
    <div className={cn('flex-1 flex gap-0', isLeft ? 'flex-row' : 'flex-row-reverse')}>
      {/* R1 column */}
      <div className="flex flex-col justify-around flex-1">
        {matches.map(m => (
          <BracketPair key={m.matchNumber} match={m} side={side} showConnector />
        ))}
      </div>

      {/* Subsequent rounds placeholder (SF, QF) */}
      {drawSize >= 16 && (
        <div className="flex flex-col justify-around" style={{ width: 100 }}>
          {Array.from({ length: matches.length / 2 }).map((_, i) => (
            <div key={i} className={cn(
              'flex items-center',
              isLeft ? 'justify-start' : 'justify-end',
            )}>
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
  match, side, showConnector,
}: {
  match:          BracketMatch
  side:           'left' | 'right'
  showConnector?: boolean
}) {
  const isLeft = side === 'left'

  return (
    <div className="flex items-stretch my-0.5">
      <div className={cn('flex flex-col', isLeft ? 'items-end' : 'items-start')}>
        {/* Slot 1 — top arm of connector */}
        <div className={cn(
          'flex items-center border-border',
          isLeft
            ? 'border-r border-b border-t'
            : 'border-l border-b border-t',
          'border',
        )}>
          <SlotLabel slot={match.slot1} />
        </div>

        {/* Slot 2 — bottom arm of connector */}
        <div className={cn(
          'flex items-center border-border',
          isLeft
            ? 'border-r border-b'
            : 'border-l border-b',
          'border-x border-b',
        )}>
          <SlotLabel slot={match.slot2} />
        </div>
      </div>

      {/* Horizontal connector to next round */}
      {showConnector && (
        <div className={cn(
          'w-3 border-border self-center',
          isLeft ? 'border-t' : 'border-t',
        )} />
      )}
    </div>
  )
}

// ─── SlotLabel ────────────────────────────────────────────────────────────────

function SlotLabel({ slot }: { slot: BracketSlot }) {
  if (slot.isBye) {
    return (
      <div className="px-2 py-1.5 w-36 bg-court-panel/50">
        <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">BYE</span>
      </div>
    )
  }

  return (
    <div className={cn(
      'px-2 py-1.5 w-36 bg-court-card',
      slot.seed && 'bg-gold/5',
    )}>
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
  )
}

function PlaceholderSlot({ label }: { label: string }) {
  return (
    <div className="px-2 py-1.5 w-28 rounded border border-dashed border-border">
      <span className="font-body text-[10px] text-muted-foreground/50">{label}</span>
    </div>
  )
}
