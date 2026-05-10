import { cn } from '@/lib/utils'
import {
  CATEGORY_TIER_COLORS,
  CATEGORY_LABELS,
  CATEGORY_GENDER_ICON,
} from '@/components/mpl/design-tokens'
import type { TournamentCategory } from '@/types'

interface CategoryBadgeProps {
  category: TournamentCategory
  /** Affiche l'icône de genre (♂ ♀ J) */
  withGenderIcon?: boolean
  className?: string
}

/**
 * Badge de catégorie FIP avec couleur par tier.
 * M1000/W1000 → or, M500/W500 → violet/rose, etc.
 * Usage : <CategoryBadge category="M500" /> ou <CategoryBadge category="W1000" withGenderIcon />
 */
export function CategoryBadge({
  category,
  withGenderIcon = false,
  className,
}: CategoryBadgeProps) {
  const colorClass = CATEGORY_TIER_COLORS[category]
  const label = CATEGORY_LABELS[category]
  const genderIcon = CATEGORY_GENDER_ICON[category]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5',
        'text-xs font-mono font-bold tracking-wider uppercase',
        'whitespace-nowrap select-none',
        colorClass,
        className
      )}
    >
      {withGenderIcon && (
        <span className="opacity-70 text-[10px]" aria-hidden="true">
          {genderIcon}
        </span>
      )}
      {label}
    </span>
  )
}
