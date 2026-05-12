/**
 * POST /api/tournaments/[slug]/groups/reassign
 *
 * Déplace une paire d'un groupe vers un autre groupe ou vers "Draw Direct".
 * Régénère les matchs round-robin des groupes affectés.
 */

import { NextResponse }     from 'next/server'
import type { NextRequest } from 'next/server'
import { z }                from 'zod'
import { createClient }     from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateRRMatchCodes } from '@/lib/tournament/draw-generator'
import type { TableRow }    from '@/types'

type TournRow     = Pick<TableRow<'tournaments'>, 'id' | 'org_id' | 'format' | 'status'>
type GroupRow     = Pick<TableRow<'qual_groups'>, 'id' | 'name'>
type GEntryRow    = Pick<TableRow<'qual_group_entries'>, 'id' | 'group_id' | 'entry_id' | 'position'>

const bodySchema = z.object({
  entryId:     z.string().uuid(),
  toGroupId:   z.string().uuid().optional(),   // undefined = passer en Direct Entry
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase  = await createClient()
  const admin     = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const tRes = await supabase
    .from('tournaments').select('id, org_id, format, status').eq('slug', slug).maybeSingle()
  const tournament = tRes.data as TournRow | null
  if (!tournament) return NextResponse.json({ error: 'Tournoi introuvable' }, { status: 404 })

  const mRes = await supabase
    .from('org_members').select('role')
    .eq('org_id', tournament.org_id).eq('user_id', user.id).maybeSingle()
  const member = mRes.data as { role: string } | null
  if (!member || !['super_admin','federation_admin','club_admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const body   = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })

  const { entryId, toGroupId } = parsed.data

  // ── Trouver le groupe source ────────────────────────────────────────────────
  const { data: srcGEData } = await admin
    .from('qual_group_entries').select('id, group_id, entry_id, position')
    .eq('entry_id', entryId).maybeSingle()
  const srcGE = srcGEData as GEntryRow | null
  const fromGroupId = srcGE?.group_id ?? null

  if (!toGroupId && !fromGroupId) {
    // Déjà Direct Entry, rien à faire
    return NextResponse.json({ ok: true })
  }

  // ── Retirer du groupe source ────────────────────────────────────────────────
  if (srcGE) {
    await admin.from('qual_group_entries').delete().eq('id', srcGE.id)
    // Supprimer les matchs impliquant cette paire dans ce groupe
    await admin.from('matches')
      .delete()
      .eq('group_id', fromGroupId!)
      .or(`entry1_id.eq.${entryId},entry2_id.eq.${entryId}`)
  }

  // ── Mettre à jour is_direct_entry ──────────────────────────────────────────
  await admin.from('tournament_entries')
    .update({ is_direct_entry: !toGroupId } as never)
    .eq('id', entryId)

  // ── Ajouter au groupe cible (si pas Direct) ────────────────────────────────
  if (toGroupId) {
    // Récupérer les membres actuels du groupe cible
    const { data: targetMembersData } = await admin
      .from('qual_group_entries').select('entry_id, position')
      .eq('group_id', toGroupId).order('position')
    const targetMembers = (targetMembersData ?? []) as GEntryRow[]

    const newPosition = targetMembers.length
    await admin.from('qual_group_entries').insert({
      group_id: toGroupId,
      entry_id: entryId,
      position: newPosition,
    } as never)
  }

  // ── Régénérer les matchs des groupes affectés ──────────────────────────────
  const groupsToRegen = [fromGroupId, toGroupId ?? null].filter(Boolean) as string[]

  for (const gid of groupsToRegen) {
    // Récupérer le label du groupe
    const { data: gData } = await admin.from('qual_groups').select('id, name').eq('id', gid).maybeSingle()
    const group = gData as GroupRow | null
    if (!group) continue

    const label = group.name.replace('Groupe ', '')

    // Récupérer les membres actuels
    const { data: membersData } = await admin
      .from('qual_group_entries').select('entry_id, position')
      .eq('group_id', gid).order('position')
    const members = (membersData ?? []) as GEntryRow[]

    // Supprimer les anciens matchs du groupe
    await admin.from('matches').delete().eq('group_id', gid).eq('phase', 'qualification')

    // Régénérer si au moins 2 membres
    if (members.length >= 2) {
      const rrMatches = generateRRMatchCodes(label, members.length)
      const matchInserts = rrMatches.map(m => ({
        tournament_id: tournament.id,
        group_id:      gid,
        phase:         'qualification' as const,
        format:        tournament.format,
        status:        'scheduled' as const,
        entry1_id:     members[m.team1Pos]?.entry_id ?? null,
        entry2_id:     members[m.team2Pos]?.entry_id ?? null,
        notes:         m.code,
      }))
      await admin.from('matches').insert(matchInserts as never[])
    }
  }

  return NextResponse.json({ ok: true })
}
