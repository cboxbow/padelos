import Link from 'next/link'
import { Trophy, Users, BarChart3, Plus, Activity, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { SectionTitle, StatusBadge, CategoryBadge } from '@/components/mpl'
import { getDashboardStats, getTournaments } from '@/app/actions/tournaments'
import type { TableRow } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgRow = Pick<TableRow<'organizations'>, 'id' | 'name' | 'slug'>

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatsCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  accent?: boolean
}) {
  return (
    <div className={`rounded-xl border p-5 space-y-3 ${accent ? 'border-gold/30 bg-gold/5' : 'border-border bg-court-card'}`}>
      <div className="flex items-center justify-between">
        <span className="font-body text-xs text-muted-foreground tracking-widest uppercase">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${accent ? 'text-gold' : 'text-muted-foreground'}`} />
      </div>
      <p className={`font-display text-4xl leading-none ${accent ? 'text-gold' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const supabase = await createClient()

  // Fetch org name
  const orgResult = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', orgSlug)
    .maybeSingle()
  const org = orgResult.data as OrgRow | null

  // Fetch stats + recent tournaments in parallel
  const [stats, allTournaments] = await Promise.all([
    getDashboardStats(orgSlug),
    getTournaments(orgSlug),
  ])

  const recentTournaments = allTournaments.slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle
          title={org?.name ?? orgSlug.toUpperCase()}
          subtitle="Tableau de bord"
          withAccent
          size="lg"
          as="h1"
        />
        <Button asChild className="bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase shrink-0">
          <Link href={`/${orgSlug}/tournaments/new`}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau tournoi
          </Link>
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard label="Tournois total"  value={stats.totalTournaments}  icon={Trophy}        />
        <StatsCard label="En cours"        value={stats.activeTournaments} icon={Activity}       accent />
        <StatsCard label="Inscriptions"    value={stats.openRegistrations} icon={ClipboardList}  />
        <StatsCard label="Joueurs"         value={stats.totalPlayers}      icon={Users}          />
      </div>

      {/* Recent tournaments */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl tracking-wider uppercase text-foreground">
            Tournois récents
          </h2>
          <Button variant="ghost" asChild className="text-sm text-muted-foreground hover:text-gold">
            <Link href={`/${orgSlug}/tournaments`}>Voir tout →</Link>
          </Button>
        </div>

        {recentTournaments.length === 0 ? (
          <EmptyTournaments orgSlug={orgSlug} />
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-court-panel">
                  <th className="px-4 py-3 text-left text-xs font-body font-medium text-muted-foreground tracking-widest uppercase">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-body font-medium text-muted-foreground tracking-widest uppercase hidden sm:table-cell">Catégorie</th>
                  <th className="px-4 py-3 text-left text-xs font-body font-medium text-muted-foreground tracking-widest uppercase hidden md:table-cell">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-body font-medium text-muted-foreground tracking-widest uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentTournaments.map((t) => (
                  <tr key={t.id} className="hover:bg-court-hover/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${orgSlug}/tournaments/${t.slug}`}
                        className="font-body font-medium text-foreground hover:text-gold transition-colors"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <CategoryBadge category={t.category} withGenderIcon />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-body text-sm text-muted-foreground">
                        {new Date(t.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: `/${orgSlug}/tournaments`, icon: Trophy,   label: 'Tournois',    desc: 'Gérer les compétitions' },
          { href: `/${orgSlug}/players`,     icon: Users,    label: 'Joueurs',     desc: 'Roster et profils' },
          { href: `/${orgSlug}/rankings`,    icon: BarChart3, label: 'Classements', desc: 'Classement FIP live' },
        ].map(({ href, icon: Icon, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-border bg-court-card p-5 flex items-center gap-4 hover:border-gold/40 hover:bg-court-hover transition-all"
          >
            <div className="h-10 w-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 group-hover:bg-gold/20 transition-colors">
              <Icon className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="font-display text-base tracking-wider uppercase text-foreground">{label}</p>
              <p className="font-body text-xs text-muted-foreground">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function EmptyTournaments({ orgSlug }: { orgSlug: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-court-card p-10 text-center space-y-4">
      <Trophy className="mx-auto h-10 w-10 text-muted-foreground/40" />
      <div>
        <p className="font-body font-medium text-foreground">Aucun tournoi pour l'instant</p>
        <p className="font-body text-sm text-muted-foreground mt-1">Créez votre premier tournoi pour commencer.</p>
      </div>
      <Button asChild className="bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase">
        <Link href={`/${orgSlug}/tournaments/new`}>
          <Plus className="mr-2 h-4 w-4" />
          Créer un tournoi
        </Link>
      </Button>
    </div>
  )
}
