import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge, CategoryBadge, SectionTitle } from '@/components/mpl'
import { TournamentTabNav } from './_components/TournamentTabNav'
import { TeamsTab }         from './_components/TeamsTab'
import { GroupsTab }        from './_components/GroupsTab'
import type { TableRow } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type TournRow = Pick<
  TableRow<'tournaments'>,
  'id' | 'name' | 'slug' | 'category' | 'status' | 'format' |
  'start_date' | 'end_date' | 'registration_end' | 'venue' | 'city' |
  'max_pairs' | 'description'
>
type EntryRow  = TableRow<'tournament_entries'>
type GroupRow  = TableRow<'qual_groups'>
type GEntryRow = TableRow<'qual_group_entries'>

const TABS = ['overview','teams','groups','draw'] as const
type Tab = typeof TABS[number]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TournamentPage({
  params,
  searchParams,
}: {
  params:       Promise<{ orgSlug: string; tournamentSlug: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { orgSlug, tournamentSlug } = await params
  const { tab: tabParam }           = await searchParams
  const activeTab = (TABS.includes(tabParam as Tab) ? tabParam : 'overview') as Tab

  const supabase = await createClient()

  // Fetch tournament
  const tResult = await supabase
    .from('tournaments')
    .select('id, name, slug, category, status, format, start_date, end_date, registration_end, venue, city, max_pairs, description')
    .eq('slug', tournamentSlug)
    .maybeSingle()
  const tournament = tResult.data as TournRow | null
  if (!tournament) notFound()

  // Fetch entries + groups in parallel
  const [entriesResult, groupsResult] = await Promise.all([
    supabase
      .from('tournament_entries')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('seed', { ascending: true, nullsFirst: false })
      .order('registered_at', { ascending: true }),
    supabase
      .from('qual_groups')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('group_index', { ascending: true }),
  ])

  const entries = (entriesResult.data ?? []) as EntryRow[]
  const groups  = (groupsResult.data  ?? []) as GroupRow[]

  // Fetch group entries if groups exist
  let groupEntries: GEntryRow[] = []
  if (groups.length > 0) {
    const groupIds = groups.map(g => g.id)
    const geResult = await supabase
      .from('qual_group_entries')
      .select('*')
      .in('group_id', groupIds)
    groupEntries = (geResult.data ?? []) as GEntryRow[]
  }

  // Fetch matches for groups
  type MatchRow = Pick<TableRow<'matches'>, 'id' | 'group_id' | 'entry1_id' | 'entry2_id' | 'status' | 'notes'>
  let groupMatches: MatchRow[] = []
  if (groups.length > 0) {
    const { data } = await supabase
      .from('matches')
      .select('id, group_id, entry1_id, entry2_id, status, notes')
      .eq('tournament_id', tournament.id)
      .eq('phase', 'qualification')
      .order('notes', { ascending: true })
    groupMatches = (data ?? []) as MatchRow[]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <TournamentHeader tournament={tournament} orgSlug={orgSlug} entriesCount={entries.length} />

      {/* Tab nav */}
      <TournamentTabNav
        orgSlug={orgSlug}
        tournamentSlug={tournamentSlug}
        activeTab={activeTab}
        entriesCount={entries.length}
        groupsCount={groups.length}
      />

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab tournament={tournament} entriesCount={entries.length} />
      )}
      {activeTab === 'teams' && (
        <TeamsTab
          tournamentSlug={tournamentSlug}
          tournament={tournament}
          initialEntries={entries}
        />
      )}
      {activeTab === 'groups' && (
        <GroupsTab
          tournamentSlug={tournamentSlug}
          tournament={tournament}
          initialEntries={entries}
          initialGroups={groups}
          initialGroupEntries={groupEntries}
          initialGroupMatches={groupMatches}
        />
      )}
      {activeTab === 'draw' && (
        <div className="rounded-xl border border-dashed border-border bg-court-card p-12 text-center">
          <p className="font-body text-muted-foreground">Tableau principal — Session S5</p>
        </div>
      )}
    </div>
  )
}

// ─── TournamentHeader ─────────────────────────────────────────────────────────

function TournamentHeader({
  tournament, orgSlug, entriesCount,
}: { tournament: TournRow; orgSlug: string; entriesCount: number }) {
  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  const pct = Math.round((entriesCount / tournament.max_pairs) * 100)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <SectionTitle
          title={tournament.name}
          subtitle={tournament.city ?? undefined}
          withAccent
          as="h1"
        />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <StatusBadge status={tournament.status} />
          <CategoryBadge category={tournament.category} withGenderIcon />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs font-body text-muted-foreground">
        <span>📅 {fmt(tournament.start_date)} → {fmt(tournament.end_date)}</span>
        {tournament.venue && <span>📍 {tournament.venue}</span>}
        <span>👥 {entriesCount} / {tournament.max_pairs} paires</span>
      </div>
      {/* Progression bar */}
      <div className="h-1.5 w-full max-w-xs rounded-full bg-court-panel overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-dim to-gold transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}

// ─── OverviewTab ──────────────────────────────────────────────────────────────

function OverviewTab({ tournament, entriesCount }: { tournament: TournRow; entriesCount: number }) {
  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const details = [
    { label: 'Catégorie',   value: <CategoryBadge category={tournament.category} withGenderIcon /> },
    { label: 'Format',      value: tournament.format.replace('FORMAT_', 'Format ') },
    { label: 'Début',       value: fmt(tournament.start_date) },
    { label: 'Fin',         value: fmt(tournament.end_date) },
    tournament.registration_end && { label: 'Clôture inscriptions', value: fmt(tournament.registration_end) },
    tournament.venue && { label: 'Lieu',  value: tournament.venue },
    tournament.city  && { label: 'Ville', value: tournament.city  },
    { label: 'Capacité', value: `${entriesCount} / ${tournament.max_pairs} paires` },
  ].filter(Boolean) as { label: string; value: React.ReactNode }[]

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-court-card p-5 space-y-3">
        <h3 className="font-display text-base tracking-wider uppercase text-foreground">Détails</h3>
        <dl className="space-y-2">
          {details.map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-2 text-sm">
              <dt className="text-muted-foreground font-body w-40 shrink-0">{label}</dt>
              <dd className="font-body text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {tournament.description && (
        <div className="rounded-xl border border-border bg-court-card p-5 space-y-3">
          <h3 className="font-display text-base tracking-wider uppercase text-foreground">Description</h3>
          <p className="font-body text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {tournament.description}
          </p>
        </div>
      )}
    </div>
  )
}
