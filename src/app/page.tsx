import Link from 'next/link'
import { GoldDivider } from '@/components/mpl/GoldDivider'
import { SectionTitle } from '@/components/mpl/SectionTitle'
import { StatusBadge } from '@/components/mpl/StatusBadge'
import { CategoryBadge } from '@/components/mpl/CategoryBadge'
import type { TournamentStatus, TournamentCategory } from '@/types'

const ALL_STATUSES: TournamentStatus[] = [
  'draft', 'registration', 'active', 'completed', 'cancelled',
]

const ALL_CATEGORIES: TournamentCategory[] = [
  'M1000', 'M500', 'M250', 'M100', 'M50', 'M25',
  'W1000', 'W500', 'W250', 'W100', 'W50', 'W25',
  'JUNIOR_U15', 'JUNIOR_U13', 'JUNIOR_U11',
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-court-deep text-foreground">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="mb-4 font-mono text-xs tracking-[0.4em] text-gold/60 uppercase">
          Mauritius Padel League · v1.0
        </p>

        <h1 className="font-display text-7xl sm:text-9xl md:text-[10rem] leading-none tracking-widest text-gold-gradient uppercase">
          PadelOS
        </h1>

        <GoldDivider withDiamond className="my-8 max-w-xs w-full" />

        <p className="font-body text-base sm:text-lg text-muted-foreground tracking-[0.25em] uppercase max-w-sm">
          Le système d&apos;exploitation digital des compétitions padel
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-md bg-gold px-8 text-sm font-body font-semibold text-black tracking-wider uppercase transition-colors hover:bg-gold-light"
          >
            Accéder à la plateforme
          </Link>
          <Link
            href="/t/mpl"
            className="inline-flex h-11 items-center justify-center rounded-md border border-gold/30 px-8 text-sm font-body text-gold tracking-wider uppercase transition-colors hover:bg-gold/10"
          >
            Tournois MPL
          </Link>
        </div>
      </section>

      {/* ── Design System Showcase ──────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-4 py-20 space-y-16">

        {/* Titres */}
        <div className="space-y-8">
          <SectionTitle
            title="Design System"
            subtitle="Composants MPL"
            withAccent
            size="lg"
            as="h2"
          />
          <GoldDivider />

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-border bg-court-card p-5">
              <SectionTitle title="Section XL" subtitle="Sous-titre" withAccent size="xl" as="h3" />
            </div>
            <div className="space-y-3 rounded-lg border border-border bg-court-card p-5">
              <SectionTitle title="Section LG" subtitle="Sous-titre" withAccent size="lg" as="h3" />
              <SectionTitle title="Section MD" subtitle="Sous-titre" withAccent size="md" as="h3" />
              <SectionTitle title="Section SM" subtitle="Sous-titre" withAccent size="sm" as="h3" />
            </div>
          </div>
        </div>

        {/* GoldDivider variants */}
        <div className="space-y-4">
          <SectionTitle title="Gold Dividers" size="sm" withAccent as="h3" />
          <GoldDivider />
          <GoldDivider withDiamond />
          <GoldDivider withDiamond />
        </div>

        {/* Statuts */}
        <div className="space-y-4">
          <SectionTitle title="Statuts Tournoi" subtitle="StatusBadge" size="sm" withAccent as="h3" />
          <div className="flex flex-wrap gap-2">
            {ALL_STATUSES.map((s) => (
              <StatusBadge key={s} status={s} withDot />
            ))}
          </div>
        </div>

        {/* Catégories */}
        <div className="space-y-4">
          <SectionTitle title="Catégories FIP" subtitle="CategoryBadge" size="sm" withAccent as="h3" />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.filter(c => c.startsWith('M')).map((c) => (
                <CategoryBadge key={c} category={c} withGenderIcon />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.filter(c => c.startsWith('W')).map((c) => (
                <CategoryBadge key={c} category={c} withGenderIcon />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.filter(c => c.startsWith('J')).map((c) => (
                <CategoryBadge key={c} category={c} withGenderIcon />
              ))}
            </div>
          </div>
        </div>

        {/* Palette */}
        <div className="space-y-4">
          <SectionTitle title="Palette MPL" subtitle="Tokens de couleur" size="sm" withAccent as="h3" />
          <div className="grid grid-cols-5 gap-2">
            {[
              { name: 'deep',    bg: 'bg-court-deep',  label: '#080A0F' },
              { name: 'court',   bg: 'bg-court',       label: '#0A0C12' },
              { name: 'card',    bg: 'bg-court-card',  label: '#0E1118' },
              { name: 'panel',   bg: 'bg-court-panel', label: '#131720' },
              { name: 'hover',   bg: 'bg-court-hover', label: '#1A2030' },
            ].map(({ name, bg, label }) => (
              <div key={name} className="space-y-1 text-center">
                <div className={`h-12 rounded border border-border ${bg}`} />
                <p className="font-mono text-[10px] text-muted-foreground">{name}</p>
                <p className="font-mono text-[10px] text-muted-foreground/50">{label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { name: 'gold',       bg: 'bg-gold',       label: '#C9A84C' },
              { name: 'gold-light', bg: 'bg-gold-light', label: '#E8C96A' },
              { name: 'gold-dim',   bg: 'bg-gold-dim',   label: '#8B6914' },
              { name: 'gold-muted', bg: 'bg-gold-muted', label: 'rgba 15%' },
            ].map(({ name, bg, label }) => (
              <div key={name} className="space-y-1 text-center">
                <div className={`h-12 rounded border border-gold/30 ${bg}`} />
                <p className="font-mono text-[10px] text-muted-foreground">{name}</p>
                <p className="font-mono text-[10px] text-muted-foreground/50">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <GoldDivider withDiamond />

        {/* Footer */}
        <p className="text-center font-mono text-xs text-muted-foreground/40 tracking-widest uppercase">
          PadelOS · Mauritius Padel League · Océan Indien
        </p>
      </section>
    </main>
  )
}
