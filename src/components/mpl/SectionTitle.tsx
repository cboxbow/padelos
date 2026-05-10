import { cn } from '@/lib/utils'

type SectionTitleSize = 'sm' | 'md' | 'lg' | 'xl'

interface SectionTitleProps {
  title: string
  subtitle?: string
  /** Accent doré sous le titre */
  withAccent?: boolean
  size?: SectionTitleSize
  className?: string
  subtitleClassName?: string
  /** Tag HTML à rendre (h2 par défaut) */
  as?: 'h1' | 'h2' | 'h3' | 'h4'
}

const SIZE_CLASSES: Record<SectionTitleSize, string> = {
  sm: 'text-2xl md:text-3xl',
  md: 'text-3xl md:text-4xl',
  lg: 'text-4xl md:text-5xl',
  xl: 'text-5xl md:text-7xl',
}

const ACCENT_SIZES: Record<SectionTitleSize, string> = {
  sm: 'w-8 h-0.5',
  md: 'w-12 h-0.5',
  lg: 'w-16 h-[3px]',
  xl: 'w-20 h-1',
}

/**
 * Titre de section style MPL — police Bebas Neue, accent or optionnel.
 * Usage : <SectionTitle title="Tournois" subtitle="Saison 2026" withAccent />
 */
export function SectionTitle({
  title,
  subtitle,
  withAccent = false,
  size = 'md',
  className,
  subtitleClassName,
  as: Tag = 'h2',
}: SectionTitleProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <Tag
        className={cn(
          'font-display tracking-wider uppercase leading-none',
          SIZE_CLASSES[size]
        )}
      >
        {title}
      </Tag>

      {withAccent && (
        <div
          className={cn(
            'rounded-full bg-gradient-to-r from-gold to-gold-dim',
            ACCENT_SIZES[size]
          )}
          aria-hidden="true"
        />
      )}

      {subtitle && (
        <p
          className={cn(
            'font-body text-muted-foreground tracking-widest uppercase',
            size === 'xl' || size === 'lg' ? 'text-sm' : 'text-xs',
            subtitleClassName
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}
