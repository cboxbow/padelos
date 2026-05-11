'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Shuffle, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { calcGroupCount } from '@/lib/tournament/draw-generator'
import type { TableRow } from '@/types'

type TournRow   = Pick<TableRow<'tournaments'>, 'id' | 'slug' | 'status' | 'max_pairs'>
type EntryRow   = TableRow<'tournament_entries'>
type GroupRow   = TableRow<'qual_groups'>
type GEntryRow  = TableRow<'qual_group_entries'>

interface GroupMatch {
  id: string
  group_id: string | null
  entry1_id: string | null
  entry2_id: string | null
  status: string
  notes: string | null
}

interface GroupsTabProps {
  tournamentSlug:      string
  tournament:          TournRow
  initialEntries:      EntryRow[]
  initialGroups:       GroupRow[]
  initialGroupEntries: GEntryRow[]
  initialGroupMatches: GroupMatch[]
}

// ─── GroupsTab ────────────────────────────────────────────────────────────────

export function GroupsTab({
  tournamentSlug,
  tournament,
  initialEntries,
  initialGroups,
  initialGroupEntries,
  initialGroupMatches,
}: GroupsTabProps) {
  const router = useRouter()
  const [groups,       setGroups]       = useState<GroupRow[]>(initialGroups)
  const [groupEntries, setGroupEntries] = useState<GEntryRow[]>(initialGroupEntries)
  const [groupMatches, setGroupMatches] = useState<GroupMatch[]>(initialGroupMatches)
  const [entries]                       = useState<EntryRow[]>(initialEntries)
  const [generating, startGenerate]     = useTransition()

  const canGenerate =
    ['draft','registration'].includes(tournament.status) &&
    entries.length >= 4

  const projectedGroups = calcGroupCount(entries.length)

  function generate() {
    startGenerate(async () => {
      const res = await fetch(`/api/tournaments/${tournamentSlug}/generate-groups`, { method: 'POST' })
      const json = await res.json() as {
        ok?: boolean
        error?: string
        nbGroups?: number
      }
      if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }

      toast.success(`${json.nbGroups} groupes générés — tournoi passé en cours`)

      // Re-fetch full page data
      router.refresh()
      // Optimistic: will be replaced by refresh, but fetch fresh groups for immediate display
      const gRes  = await fetch(`/api/tournaments/${tournamentSlug}/entries`)
      if (gRes.ok) {
        // Let router.refresh() handle it
      }
    })
  }

  // ── Build a lookup: entry_id → display name ──────────────────────────────
  const entryNames = Object.fromEntries(
    entries.map(e => [
      e.id,
      `${e.player1_name ?? '?'} / ${e.player2_name ?? '?'}`,
    ]),
  )

  return (
    <div className="space-y-6">
      {/* Génération */}
      {canGenerate && groups.length === 0 && (
        <div className="rounded-xl border border-gold/20 bg-gold/5 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 space-y-1">
            <p className="font-body font-semibold text-foreground">
              Prêt à générer {projectedGroups} groupe{projectedGroups > 1 ? 's' : ''} de qualification
            </p>
            <p className="font-body text-sm text-muted-foreground">
              {entries.length} paires · distribution snake · {projectedGroups} groupe{projectedGroups > 1 ? 's' : ''}
              {entries.length > 0 && ` · ~${Math.ceil(entries.length / projectedGroups)} paires/groupe`}
            </p>
          </div>
          <Button
            onClick={generate}
            disabled={generating}
            className="bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase shrink-0"
          >
            <Shuffle className="mr-2 h-4 w-4" />
            {generating ? 'Génération…' : 'Générer les groupes'}
          </Button>
        </div>
      )}

      {groups.length === 0 && !canGenerate && (
        <div className="rounded-xl border border-dashed border-border bg-court-card p-10 text-center space-y-2">
          <p className="font-body font-medium text-foreground">Pas encore de groupes</p>
          <p className="font-body text-sm text-muted-foreground">
            {entries.length < 4
              ? `Inscrivez au moins 4 paires (actuellement ${entries.length}).`
              : 'Le tournoi est déjà en cours ou terminé.'}
          </p>
        </div>
      )}

      {/* Groupes générés */}
      {groups.length > 0 && (
        <div className="space-y-5">
          {groups.length > 0 && tournament.status === 'active' && canGenerate === false && (
            <div className="flex items-center gap-2 text-xs font-body text-muted-foreground bg-court-card border border-border rounded-lg px-3 py-2">
              <Shuffle className="h-3.5 w-3.5 text-gold" />
              Groupes verrouillés — tournoi en cours
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {groups.map(group => {
              const members  = groupEntries.filter(ge => ge.group_id === group.id)
              const matches  = groupMatches.filter(m => m.group_id === group.id)
              const label    = group.name.replace('Groupe ', '')

              return (
                <GroupCard
                  key={group.id}
                  label={label}
                  members={members}
                  matches={matches}
                  entryNames={entryNames}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── GroupCard ────────────────────────────────────────────────────────────────

function GroupCard({
  label, members, matches, entryNames,
}: {
  label:      string
  members:    GEntryRow[]
  matches:    GroupMatch[]
  entryNames: Record<string, string>
}) {
  const LABEL_COLORS: Record<string, string> = {
    A: 'border-blue-500/30 bg-blue-500/5',
    B: 'border-purple-500/30 bg-purple-500/5',
    C: 'border-green-500/30 bg-green-500/5',
    D: 'border-amber-500/30 bg-amber-500/5',
    E: 'border-pink-500/30 bg-pink-500/5',
    F: 'border-cyan-500/30 bg-cyan-500/5',
    G: 'border-rose-500/30 bg-rose-500/5',
    H: 'border-indigo-500/30 bg-indigo-500/5',
  }

  return (
    <div className={`rounded-xl border p-4 space-y-4 ${LABEL_COLORS[label] ?? 'border-border bg-court-card'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl tracking-widest text-foreground">
          Groupe {label}
        </h3>
        <span className="font-mono text-xs text-muted-foreground">{members.length} paires</span>
      </div>

      {/* Membres */}
      <ul className="space-y-1.5">
        {members
          .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
          .map((ge, i) => (
            <li key={ge.id} className="flex items-center gap-2 text-xs font-body">
              <span className="font-mono text-muted-foreground w-4 text-right">{i + 1}</span>
              <span className="text-foreground truncate">{entryNames[ge.entry_id] ?? ge.entry_id.slice(0, 8)}</span>
            </li>
          ))}
      </ul>

      {/* Matchs RR */}
      {matches.length > 0 && (
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
            {matches.length} match{matches.length > 1 ? 's' : ''}
          </p>
          <ul className="space-y-1">
            {matches.map(m => (
              <li key={m.id} className="flex items-center gap-1.5 text-[11px] font-body text-muted-foreground">
                <span className="font-mono text-gold w-6">{m.notes}</span>
                <ChevronRight className="h-3 w-3 opacity-40" />
                <span className="truncate">{entryNames[m.entry1_id ?? ''] ?? '?'}</span>
                <span className="opacity-40">vs</span>
                <span className="truncate">{entryNames[m.entry2_id ?? ''] ?? '?'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
