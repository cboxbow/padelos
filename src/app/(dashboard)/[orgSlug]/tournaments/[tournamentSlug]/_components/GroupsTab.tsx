'use client'

import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import { toast }                   from 'sonner'
import { Shuffle, ChevronRight, ArrowRight, ArrowLeft, Crown } from 'lucide-react'
import { Button }                  from '@/components/ui/button'
import { calcGroupCount }          from '@/lib/tournament/draw-generator'
import type { TableRow }           from '@/types'
import { DndGroupsProvider, DroppableGroup } from './DndGroupsTab'

type TournRow  = Pick<TableRow<'tournaments'>, 'id' | 'slug' | 'status' | 'max_pairs' | 'format'>
type EntryRow  = TableRow<'tournament_entries'>
type GroupRow  = TableRow<'qual_groups'>
type GEntryRow = TableRow<'qual_group_entries'>

interface GroupMatch {
  id: string; group_id: string | null; entry1_id: string | null
  entry2_id: string | null; status: string; notes: string | null
}

interface GroupsTabProps {
  tournamentSlug:      string
  tournament:          TournRow
  initialEntries:      EntryRow[]
  initialGroups:       GroupRow[]
  initialGroupEntries: GEntryRow[]
  initialGroupMatches: GroupMatch[]
}

const LABEL_COLORS: Record<string, string> = {
  A:'border-blue-500/30 bg-blue-500/5',   B:'border-purple-500/30 bg-purple-500/5',
  C:'border-green-500/30 bg-green-500/5', D:'border-amber-500/30 bg-amber-500/5',
  E:'border-pink-500/30 bg-pink-500/5',   F:'border-cyan-500/30 bg-cyan-500/5',
  G:'border-rose-500/30 bg-rose-500/5',   H:'border-indigo-500/30 bg-indigo-500/5',
}

// ─── GroupsTab ────────────────────────────────────────────────────────────────

export function GroupsTab({
  tournamentSlug, tournament, initialEntries,
  initialGroups, initialGroupEntries, initialGroupMatches,
}: GroupsTabProps) {
  const router = useRouter()

  // Assignation locale (avant génération)
  const [entries, setEntries]           = useState<EntryRow[]>(
    initialEntries.map(e => ({ ...e, is_direct_entry: e.is_direct_entry ?? (e.seed !== null) }))
  )
  const [groups]       = useState<GroupRow[]>(initialGroups)
  const [groupEntries, setGroupEntries] = useState<GEntryRow[]>(initialGroupEntries)
  const [groupMatches] = useState<GroupMatch[]>(initialGroupMatches)
  const [saving, startSave]             = useTransition()
  const [generating, startGenerate]     = useTransition()
  const [moving, setMoving]             = useState<string | null>(null)

  const hasGroups   = groups.length > 0
  const canEdit     = ['draft','registration','active'].includes(tournament.status)
  const qualEntries = entries.filter(e => !e.is_direct_entry)
  const directEntries = entries.filter(e => e.is_direct_entry)
  const projectedGroups = calcGroupCount(qualEntries.length)

  const entryLabel = (id: string) => {
    const e = entries.find(x => x.id === id)
    return e ? `${e.player1_name ?? '?'} / ${e.player2_name ?? '?'}` : id.slice(0, 8)
  }

  // ── Toggle assignation pre-génération ────────────────────────────────────────
  function toggleDirect(entryId: string, isDirect: boolean) {
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, is_direct_entry: isDirect } : e))
  }

  async function saveAssignment() {
    const updates = entries.map(e => ({ id: e.id, is_direct_entry: e.is_direct_entry ?? false }))
    startSave(async () => {
      const res = await fetch(`/api/tournaments/${tournamentSlug}/entries/assign`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      if (!res.ok) { toast.error('Erreur sauvegarde'); return }
      toast.success('Assignation sauvegardée')
    })
  }

  // ── Génération des groupes ────────────────────────────────────────────────────
  async function generate() {
    if (qualEntries.length < 4) { toast.error('Minimum 4 paires en qualification'); return }
    // Sauvegarder l'assignation puis générer
    const updates = entries.map(e => ({ id: e.id, is_direct_entry: e.is_direct_entry ?? false }))
    await fetch(`/api/tournaments/${tournamentSlug}/entries/assign`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    startGenerate(async () => {
      const res = await fetch(`/api/tournaments/${tournamentSlug}/generate-groups`, { method: 'POST' })
      const json = await res.json() as { ok?: boolean; error?: string; nbGroups?: number }
      if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }
      toast.success(`${json.nbGroups} groupes générés`)
      router.refresh()
    })
  }

  // ── Déplacer une paire post-génération ───────────────────────────────────────
  async function moveEntry(entryId: string, toGroupId: string | undefined) {
    setMoving(entryId)
    try {
      const res = await fetch(`/api/tournaments/${tournamentSlug}/groups/reassign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, toGroupId }),
      })
      if (!res.ok) { toast.error('Erreur déplacement'); return }
      toast.success('Paire déplacée')
      router.refresh()
    } finally { setMoving(null) }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (entries.length < 4) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-court-card p-10 text-center">
        <p className="font-body font-medium text-foreground">Pas encore de groupes</p>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Inscrivez au moins 4 paires (actuellement {entries.length}).
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Mode pré-génération : assignment ── */}
      {!hasGroups && canEdit && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-base tracking-wider uppercase text-foreground">
                Assignation des paires
              </p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                Choisissez qui joue les qualifications et qui entre directement dans le tableau.
              </p>
            </div>
            <Button
              variant="outline" size="sm" onClick={saveAssignment} disabled={saving}
              className="border-border text-muted-foreground hover:text-gold hover:border-gold/40 text-xs"
            >
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Qualification */}
            <div className="rounded-xl border border-border bg-court-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="font-display text-sm tracking-wider uppercase text-foreground">
                  Qualification
                </span>
                <span className="ml-auto font-mono text-xs text-gold">{qualEntries.length} paires</span>
                <span className="font-mono text-xs text-muted-foreground">
                  → {projectedGroups} groupe{projectedGroups > 1 ? 's' : ''}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {qualEntries.map(e => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                    {e.seed && <Crown className="h-3 w-3 text-gold shrink-0" />}
                    <span className="flex-1 font-body text-sm text-foreground truncate">
                      {e.player1_name} / {e.player2_name}
                    </span>
                    <button
                      onClick={() => toggleDirect(e.id, true)}
                      className="shrink-0 text-muted-foreground hover:text-gold transition-colors p-1 rounded"
                      title="Passer en Draw Direct"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </li>
                ))}
                {qualEntries.length === 0 && (
                  <li className="px-4 py-6 text-center text-xs text-muted-foreground font-body">Aucune paire</li>
                )}
              </ul>
            </div>

            {/* Draw Direct */}
            <div className="rounded-xl border border-gold/20 bg-gold/5">
              <div className="flex items-center gap-2 border-b border-gold/20 px-4 py-3">
                <span className="font-display text-sm tracking-wider uppercase text-gold">
                  Main Draw Direct
                </span>
                <span className="ml-auto font-mono text-xs text-gold">{directEntries.length} paires</span>
              </div>
              <ul className="divide-y divide-gold/10">
                {directEntries.map(e => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      onClick={() => toggleDirect(e.id, false)}
                      className="shrink-0 text-muted-foreground hover:text-gold transition-colors p-1 rounded"
                      title="Remettre en Qualification"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    {e.seed && <Crown className="h-3 w-3 text-gold shrink-0" />}
                    <span className="flex-1 font-body text-sm text-foreground truncate">
                      {e.player1_name} / {e.player2_name}
                    </span>
                  </li>
                ))}
                {directEntries.length === 0 && (
                  <li className="px-4 py-6 text-center text-xs text-muted-foreground font-body">
                    Aucune — toutes jouent les qualifications
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Bouton génération */}
          <div className="rounded-xl border border-gold/20 bg-gold/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 space-y-1">
              <p className="font-body font-semibold text-foreground">
                Générer {projectedGroups} groupe{projectedGroups > 1 ? 's' : ''} de qualification
              </p>
              <p className="font-body text-sm text-muted-foreground">
                {qualEntries.length} paires · distribution snake
                {directEntries.length > 0 && ` · ${directEntries.length} paire(s) en draw direct`}
              </p>
            </div>
            <Button
              onClick={generate} disabled={generating || qualEntries.length < 4}
              className="bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase shrink-0"
            >
              <Shuffle className="mr-2 h-4 w-4" />
              {generating ? 'Génération…' : 'Générer les groupes'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Mode post-génération : groupes éditables ── */}
      {hasGroups && (
        <DndGroupsProvider
          tournamentSlug={tournamentSlug}
          groups={groups}
          groupEntries={groupEntries}
          entries={entries}
          canEdit={canEdit}
          onGroupEntriesChange={setGroupEntries}
        >
          {({ groupEntries: liveGE, onMove, moving: dndMoving }) => (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-xs font-body text-muted-foreground bg-court-card border border-border rounded-lg px-3 py-2">
                <Shuffle className="h-3.5 w-3.5 text-gold" />
                Glissez les paires entre les groupes · utilisez le menu pour changer de groupe ou passer en Draw Direct
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {groups.map(group => {
                  const members     = liveGE.filter(ge => ge.group_id === group.id)
                                             .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
                  const matches     = groupMatches.filter(m => m.group_id === group.id)
                  const label       = group.name.replace('Groupe ', '')
                  const otherGroups = groups.filter(g => g.id !== group.id)

                  return (
                    <div key={group.id} className={`rounded-xl border p-4 space-y-3 ${LABEL_COLORS[label] ?? 'border-border bg-court-card'}`}>
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-2xl tracking-widest text-foreground">Groupe {label}</h3>
                        <span className="font-mono text-xs text-muted-foreground">{members.length} paires</span>
                      </div>
                      <DroppableGroup
                        group={group} members={members} entryLabel={entryLabel}
                        groups={otherGroups} tournamentSlug={tournamentSlug}
                        onMove={onMove} canEdit={canEdit}
                      />
                      {matches.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">
                            {matches.length} match{matches.length > 1 ? 's' : ''}
                          </p>
                          <ul className="space-y-1">
                            {matches.map(m => (
                              <li key={m.id} className="flex items-center gap-1.5 text-[11px] font-body text-muted-foreground">
                                <span className="font-mono text-gold w-6">{m.notes}</span>
                                <ChevronRight className="h-3 w-3 opacity-40" />
                                <span className="truncate">{entryLabel(m.entry1_id ?? '')} <span className="opacity-40">vs</span> {entryLabel(m.entry2_id ?? '')}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Draw Direct */}
                {directEntries.length > 0 && (
                  <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-base tracking-widest text-gold">DIRECT</h3>
                      <span className="font-mono text-xs text-muted-foreground">{directEntries.length}</span>
                    </div>
                    <ul className="space-y-1.5">
                      {directEntries.map(e => (
                        <li key={e.id} className="flex items-center gap-2 text-xs font-body bg-court-card rounded px-2 py-1.5">
                          {e.seed && <Crown className="h-3 w-3 text-gold shrink-0" />}
                          <span className="text-foreground truncate flex-1">{e.player1_name} / {e.player2_name}</span>
                          {canEdit && (
                            <select
                              className="text-[10px] font-mono bg-court border border-border rounded px-1 py-0.5 text-muted-foreground"
                              defaultValue="" disabled={dndMoving === e.id}
                              onChange={ev => { if (ev.target.value) onMove(e.id, ev.target.value) }}
                            >
                              <option value="">Déplacer…</option>
                              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </DndGroupsProvider>
      )}
    </div>
  )
}

// ─── GroupCard ────────────────────────────────────────────────────────────────

function GroupCard({
  label, members, matches, entryLabel, groups, moving, onMove,
}: {
  label:      string
  members:    GEntryRow[]
  matches:    GroupMatch[]
  entryLabel: (id: string) => string
  groups:     GroupRow[]
  moving:     string | null
  onMove:     (entryId: string, toGroupId: string | undefined) => void
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${LABEL_COLORS[label] ?? 'border-border bg-court-card'}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl tracking-widest text-foreground">Groupe {label}</h3>
        <span className="font-mono text-xs text-muted-foreground">{members.length} paires</span>
      </div>

      <ul className="space-y-1">
        {members.sort((a, b) => (a.position ?? 99) - (b.position ?? 99)).map(ge => (
          <li key={ge.id} className="flex items-center gap-2 text-xs font-body">
            <span className="text-foreground truncate flex-1">{entryLabel(ge.entry_id)}</span>
            <select
              className="text-[10px] font-mono bg-court border border-border rounded px-1 py-0.5 text-muted-foreground shrink-0"
              defaultValue=""
              disabled={moving === ge.entry_id}
              onChange={ev => {
                const val = ev.target.value
                onMove(ge.entry_id, val === 'direct' ? undefined : val)
                ev.target.value = ''
              }}
            >
              <option value="">Déplacer…</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              <option value="direct">→ Draw Direct</option>
            </select>
          </li>
        ))}
      </ul>

      {matches.length > 0 && (
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">
            {matches.length} match{matches.length > 1 ? 's' : ''}
          </p>
          <ul className="space-y-1">
            {matches.map(m => (
              <li key={m.id} className="flex items-center gap-1.5 text-[11px] font-body text-muted-foreground">
                <span className="font-mono text-gold w-6">{m.notes}</span>
                <ChevronRight className="h-3 w-3 opacity-40" />
                <span className="truncate">{entryLabel(m.entry1_id ?? '')} <span className="opacity-40">vs</span> {entryLabel(m.entry2_id ?? '')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
