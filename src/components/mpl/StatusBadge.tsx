import { cn } from '@/lib/utils'
import {
  TOURNAMENT_STATUS_COLORS,
  TOURNAMENT_STATUS_LABELS,
} from '@/components/mpl/design-tokens'
import type { TournamentStatus } from '@/types'

interface StatusBadgeProps {
  status: TournamentStatus
  /** Affiche un point animé pour les statuts "actif" */
  withDot?: boolean
  className?: string
}

/**
 * Badge coloré selon le statut du tournoi.
 * Usage : <StatusBadge status="active" withDot />
 */
export function StatusBadge({ status, withDot = false, className }: StatusBadgeProps) {
  const colorClass = TOURNAMENT_STATUS_COLORS[status]
  const label = TOURNAMENT_STATUS_LABELS[status]
  const isLive = status === 'active'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5',
        'text-xs font-body font-semibold tracking-wider uppercase',
        'whitespace-nowrap select-none',
        colorClass,
        className
      )}
    >
      {(withDot || isLive) && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full flex-shrink-0',
            isLive ? 'bg-gold animate-pulse-gold' : 'bg-current opacity-70'
          )}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  )
}
