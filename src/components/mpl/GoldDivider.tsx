import { cn } from '@/lib/utils'

interface GoldDividerProps {
  /** Affiche un losange central en ornement */
  withDiamond?: boolean
  className?: string
}

/**
 * Ligne décorative or MPL.
 * Usage : <GoldDivider /> ou <GoldDivider withDiamond />
 */
export function GoldDivider({ withDiamond = false, className }: GoldDividerProps) {
  if (!withDiamond) {
    return (
      <div
        className={cn(
          'h-px w-full bg-gradient-to-r from-transparent via-gold/50 to-transparent',
          className
        )}
        role="separator"
        aria-hidden="true"
      />
    )
  }

  return (
    <div
      className={cn('flex items-center gap-3', className)}
      role="separator"
      aria-hidden="true"
    >
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/40" />
      {/* Losange central */}
      <div className="relative h-2 w-2 rotate-45 bg-gold shadow-[0_0_6px_rgba(201,168,76,0.6)]" />
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/40" />
    </div>
  )
}
