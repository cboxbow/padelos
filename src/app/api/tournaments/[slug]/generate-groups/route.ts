import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  snakeDistribute,
  generateRRMatchCodes,
  calcGroupCount,
  GROUP_LABELS,
} from '@/lib/tournament/draw-generator'
import type { TableRow } from '@/types'

type TournRow = Pick<TableRow<'tournaments'>, 'id' | 'format' | 'org_id' | 'status' | 'max_pairs'>
type EntryRow = Pick<TableRow<'tournament_entries'>, 'id' | 'seed' | 'status' | 'is_direct_entry'>

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = await createClient()
  const admin    = createAdminClient()

  // ── Auth + ownership ────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const tResult = await supabase
    .from('tournaments')
    .select('id, format, org_id, status, max_pairs')
    .eq('slug', slug)
    .maybeSingle()
  const tournament = tResult.data as TournRow | null
  if (!tournament) return NextResponse.json({ error: 'Tournoi introuvable' }, { status: 404 })

  const mResult = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', tournament.org_id)
    .eq('user_id', user.id)
    .maybeSingle()
  const member = mResult.data as { role: string } | null
  const ADMIN_ROLES = ['super_admin','federation_admin','club_admin']
  if (!member || !ADMIN_ROLES.includes(member.role)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  // ── Conditions de génération ────────────────────────────────────────────────
  if (!['draft','registration'].includes(tournament.status)) {
    return NextResponse.json({ error: 'Les groupes ont déjà été générés.' }, { status: 400 })
  }

  // ── Récupérer les inscriptions ──────────────────────────────────────────────
  const { data: entriesData } = await supabase
    .from('tournament_entries')
    .select('id, seed, status, is_direct_entry')
    .eq('tournament_id', tournament.id)
    .not('status', 'eq', 'withdrawn')
    .order('seed', { ascending: true, nullsFirst: false })
    .order('registered_at', { ascending: true })

  const entries = (entriesData ?? []) as EntryRow[]
  if (entries.length < 4) {
    return NextResponse.json({ error: 'Minimum 4 paires requises pour générer les groupes.' }, { status: 400 })
  }

  // ── Séparer Direct Entries (draw direct) vs Qualification ──────────────────
  const qualEntries = entries.filter(e => !e.is_direct_entry)
  const seeded   = qualEntries.filter(e => e.seed !== null).sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))
  const unseeded = qualEntries.filter(e => e.seed === null)

  const toDistribute = [...seeded, ...unseeded]

  const nbGroups = calcGroupCount(toDistribute.length)
  if (nbGroups === 0) {
    return NextResponse.json({ error: 'Pas assez de paires pour former des groupes.' }, { status: 400 })
  }

  // ── Nettoyer les anciens groupes si régénération ────────────────────────────
  await admin.from('qual_groups').delete().eq('tournament_id', tournament.id)

  // ── Snake distribute ────────────────────────────────────────────────────────
  const groupedEntries = snakeDistribute(toDistribute, nbGroups)

  const createdGroups: Array<{
    id: string; label: string; entries: EntryRow[]; matchCodes: ReturnType<typeof generateRRMatchCodes>
  }> = []

  for (let gi = 0; gi < nbGroups; gi++) {
    const label       = GROUP_LABELS[gi] ?? String(gi + 1)
    const groupMembers = groupedEntries[gi] ?? []
    if (groupMembers.length === 0) continue

    // Créer le groupe
    const { data: groupData, error: groupErr } = await admin
      .from('qual_groups')
      .insert({
        tournament_id: tournament.id,
        name:          `Groupe ${label}`,
        group_index:   gi,
        phase:         'qualification',
      } as never)
      .select('id')
      .single()

    if (groupErr || !groupData) {
      return NextResponse.json({ error: `Erreur création groupe ${label}: ${groupErr?.message}` }, { status: 500 })
    }
    const groupId = (groupData as { id: string }).id

    // Créer les qual_group_entries
    const groupEntryInserts = groupMembers.map((entry, pos) => ({
      group_id: groupId,
      entry_id: entry.id,
      position: pos,
    }))
    await admin.from('qual_group_entries').insert(groupEntryInserts as never)

    // Générer les matchs round-robin
    const rrMatches = generateRRMatchCodes(label, groupMembers.length)
    const matchInserts = rrMatches.map((m) => ({
      tournament_id: tournament.id,
      group_id:      groupId,
      phase:         'qualification' as const,
      format:        tournament.format,
      status:        'scheduled' as const,
      entry1_id:     groupMembers[m.team1Pos]?.id ?? null,
      entry2_id:     groupMembers[m.team2Pos]?.id ?? null,
      notes:         m.code,
    }))
    await admin.from('matches').insert(matchInserts as never)

    createdGroups.push({ id: groupId, label, entries: groupMembers, matchCodes: rrMatches })
  }

  // ── Passer le tournoi en 'active' ───────────────────────────────────────────
  await admin
    .from('tournaments')
    .update({ status: 'active' })
    .eq('id', tournament.id)

  return NextResponse.json({
    ok:         true,
    nbGroups,
    groups:     createdGroups.map(g => ({ id: g.id, label: g.label, nbEntries: g.entries.length, nbMatches: g.matchCodes.length })),
  })
}
