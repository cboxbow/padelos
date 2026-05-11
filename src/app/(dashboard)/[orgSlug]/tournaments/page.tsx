import Link from 'next/link'
import { Plus, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionTitle, StatusBadge, CategoryBadge } from '@/components/mpl'
import { getTournaments } from '@/app/actions/tournaments'
import type { TournamentStatus } from '@/types'

// ─── Filtres par statut ───────────────────────────────────────────────────────

const STATUS_TABS: { label: string; value: TournamentStatus | 'all' }[] = [
  { label: 'Tous',        value: 'all'          },
  { label: 'En cours',   value: 'active'        },
  { label: 'Inscriptions', value: 'registration' },
  { label: 'Brouillon',  value: 'draft'         },
  { label: 'Terminés',   value: 'completed'     },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TournamentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<{ status?: string }>
}) {
  const { orgSlug } = await params
  const { status } = await searchParams

  const tournaments = await getTournaments(orgSlug)

  const activeFilter = (status ?? 'all') as TournamentStatus | 'all'
  const filtered = activeFilter === 'all'
    ? tournaments
    : tournaments.filter(t => t.status === activeFilter)

  // Comptages par statut
  const counts = tournaments.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle
          title="Tournois"
          subtitle={`${tournaments.length} tournoi${tournaments.length !== 1 ? 's' : ''}`}
          withAccent
          as="h1"
        />
        <Button asChild className="bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase shrink-0">
          <Link href={`/${orgSlug}/tournaments/new`}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau tournoi
          </Link>
        </Button>
      </div>

      {/* Filtres onglets */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-border">
        {STATUS_TABS.map(({ label, value }) => {
          const count = value === 'all' ? tournaments.length : (counts[value] ?? 0)
          const isActive = activeFilter === value
          return (
            <Link
              key={value}
              href={value === 'all' ? `/${orgSlug}/tournaments` : `/${orgSlug}/tournaments?status=${value}`}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-body font-semibold tracking-wider uppercase whitespace-nowrap rounded-t-md transition-colors
                ${isActive
                  ? 'text-gold border-b-2 border-gold -mb-px bg-gold/5'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {label}
              <span className={`inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-mono
                ${isActive ? 'bg-gold/20 text-gold' : 'bg-court-hover text-muted-foreground'}`}>
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Contenu */}
      {filtered.length === 0 ? (
        <EmptyState orgSlug={orgSlug} filtered={activeFilter !== 'all'} />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-court-panel">
                <th className="px-4 py-3 text-left text-xs font-body font-medium text-muted-foreground tracking-widest uppercase">Tournoi</th>
                <th className="px-4 py-3 text-left text-xs font-body font-medium text-muted-foreground tracking-widest uppercase hidden sm:table-cell">Catégorie</th>
                <th className="px-4 py-3 text-left text-xs font-body font-medium text-muted-foreground tracking-widest uppercase hidden lg:table-cell">Dates</th>
                <th className="px-4 py-3 text-left text-xs font-body font-medium text-muted-foreground tracking-widest uppercase hidden md:table-cell">Paires max</th>
                <th className="px-4 py-3 text-left text-xs font-body font-medium text-muted-foreground tracking-widest uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t) => (
                <tr key={t.id} className="group hover:bg-court-hover/50 transition-colors">
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/${orgSlug}/tournaments/${t.slug}`}
                      className="font-body font-semibold text-foreground group-hover:text-gold transition-colors"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <CategoryBadge category={t.category} withGenderIcon />
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="font-body text-sm text-muted-foreground">
                      {new Date(t.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {' – '}
                      {new Date(t.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="font-mono text-sm text-muted-foreground">{t.max_pairs}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EmptyState({ orgSlug, filtered }: { orgSlug: string; filtered: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-court-card p-12 text-center space-y-4">
      <Trophy className="mx-auto h-10 w-10 text-muted-foreground/30" />
      <div>
        <p className="font-body font-medium text-foreground">
          {filtered ? 'Aucun tournoi dans cette catégorie' : 'Aucun tournoi créé'}
        </p>
        <p className="font-body text-sm text-muted-foreground mt-1">
          {filtered ? 'Modifiez le filtre ou créez un nouveau tournoi.' : 'Commencez par créer votre premier tournoi.'}
        </p>
      </div>
      {!filtered && (
        <Button asChild className="bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase">
          <Link href={`/${orgSlug}/tournaments/new`}>
            <Plus className="mr-2 h-4 w-4" />
            Créer un tournoi
          </Link>
        </Button>
      )}
    </div>
  )
}
