'use client'

/**
 * DndGroupsTab — couche DnD par-dessus GroupsTab.
 * Drag d'une paire entre groupes ou vers Direct.
 * Drag within même groupe → réordonnancement (position).
 */

import { useCallback, useState } from 'react'
import { useRouter }            from 'next/navigation'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Crown } from 'lucide-react'
import { toast }               from 'sonner'
import type { TableRow }       from '@/types'

type GEntryRow  = TableRow<'qual_group_entries'>
type GroupRow   = TableRow<'qual_groups'>
type EntryRow   = TableRow<'tournament_entries'>

interface Props {
  tournamentSlug: string
  groups:         GroupRow[]
  groupEntries:   GEntryRow[]
  entries:        EntryRow[]
  canEdit:        boolean
  onGroupEntriesChange: (ge: GEntryRow[]) => void
}

// ─── SortableEntry ────────────────────────────────────────────────────────────

export function SortableEntry({
  ge, label, groups, tournamentSlug, onMove, disabled,
}: {
  ge:             GEntryRow
  label:          string
  groups:         GroupRow[]
  tournamentSlug: string
  onMove:         (entryId: string, toGroupId: string | undefined) => Promise<void>
  disabled:       boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ge.entry_id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 text-xs font-body bg-court-card rounded group"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 text-foreground truncate">{label}</span>
      {!disabled && (
        <select
          className="text-[10px] font-mono bg-court border border-border rounded px-1 py-0.5 text-muted-foreground"
          defaultValue=""
          onChange={ev => { if (ev.target.value) { onMove(ge.entry_id, ev.target.value === 'direct' ? undefined : ev.target.value); ev.target.value = '' } }}
        >
          <option value="">Déplacer…</option>
          {groups.map(g => g.id !== ge.group_id && <option key={g.id} value={g.id}>{g.name}</option>)}
          <option value="direct">→ Direct</option>
        </select>
      )}
    </li>
  )
}

// ─── DroppableGroup ───────────────────────────────────────────────────────────

export function DroppableGroup({
  group, members, entryLabel, groups, tournamentSlug, onMove, canEdit, children,
}: {
  group:          GroupRow
  members:        GEntryRow[]
  entryLabel:     (id: string) => string
  groups:         GroupRow[]
  tournamentSlug: string
  onMove:         (entryId: string, toGroupId: string | undefined) => Promise<void>
  canEdit:        boolean
  children?:      React.ReactNode
}) {
  const ids = members.map(m => m.entry_id)

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <ul className="space-y-1 min-h-[2rem]" data-group-id={group.id}>
        {members.map(ge => (
          <SortableEntry
            key={ge.entry_id}
            ge={ge}
            label={entryLabel(ge.entry_id)}
            groups={groups}
            tournamentSlug={tournamentSlug}
            onMove={onMove}
            disabled={!canEdit}
          />
        ))}
        {members.length === 0 && (
          <li className="text-center text-xs text-muted-foreground/50 py-3 border border-dashed border-border rounded">
            Déposer ici
          </li>
        )}
      </ul>
    </SortableContext>
  )
}

// ─── DndGroupsProvider ───────────────────────────────────────────────────────

export function DndGroupsProvider({
  tournamentSlug, groups, groupEntries, entries, canEdit, onGroupEntriesChange, children,
}: Props & { children: (props: {
  groupEntries: GEntryRow[]
  onMove: (entryId: string, toGroupId: string | undefined) => Promise<void>
  moving: string | null
}) => React.ReactNode }) {
  const router = useRouter()
  const [localGE, setLocalGE]   = useState<GEntryRow[]>(groupEntries)
  const [active, setActive]     = useState<string | null>(null)
  const [moving, setMoving]     = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onMove = useCallback(async (entryId: string, toGroupId: string | undefined) => {
    setMoving(entryId)
    try {
      const res = await fetch(`/api/tournaments/${tournamentSlug}/groups/reassign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, toGroupId }),
      })
      if (!res.ok) { toast.error('Erreur déplacement'); return }
      toast.success(toGroupId ? 'Paire déplacée' : 'Paire en Draw Direct')
      router.refresh()
    } finally { setMoving(null) }
  }, [tournamentSlug, router])

  function handleDragStart(event: DragStartEvent) {
    setActive(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActive(null)
    if (!over || active.id === over.id) return

    const activeId = active.id as string
    const overId   = over.id   as string

    // Trouver les groupes source et cible
    const srcGroup = localGE.find(ge => ge.entry_id === activeId)?.group_id
    const dstGroup = localGE.find(ge => ge.entry_id === overId)?.group_id

    if (!srcGroup) return

    if (srcGroup === dstGroup) {
      // Réordonnancement dans le même groupe (optimistic)
      const groupMembers = localGE.filter(ge => ge.group_id === srcGroup)
      const oldIdx = groupMembers.findIndex(ge => ge.entry_id === activeId)
      const newIdx = groupMembers.findIndex(ge => ge.entry_id === overId)
      if (oldIdx < 0 || newIdx < 0) return

      const reordered = arrayMove(groupMembers, oldIdx, newIdx).map((ge, pos) => ({ ...ge, position: pos }))
      setLocalGE(prev => [...prev.filter(ge => ge.group_id !== srcGroup), ...reordered])
      onGroupEntriesChange([...localGE.filter(ge => ge.group_id !== srcGroup), ...reordered])
      // Pas d'appel API pour le simple réordonnancement visuel dans le même groupe
    } else if (dstGroup) {
      // Cross-group move via API
      await onMove(activeId, dstGroup)
    }
  }

  const activeEntry = entries.find(e => e.id === active)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {children({ groupEntries: localGE, onMove, moving })}
      <DragOverlay>
        {active && activeEntry && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-body bg-court-panel border border-gold/40 rounded shadow-xl opacity-95">
            <GripVertical className="h-3.5 w-3.5 text-gold" />
            {activeEntry.seed && <Crown className="h-3 w-3 text-gold" />}
            <span className="text-foreground">{activeEntry.player1_name} / {activeEntry.player2_name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
