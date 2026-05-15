/**
 * POST /api/tournaments/[slug]/generate-draw
 *
 * Génère le tableau principal avec :
 *   • Têtes de série (is_direct_entry = true) placées aux positions FIP
 *   • Qualifiés des groupes (top-N par groupe, N = qualifiersPerGroup)
 *   • BYE pour compléter le tableau (puissance de 2)
 *
 * Body : { qualifiersPerGroup?: 1 | 2 | 3 | 4 }  (défaut : 1)
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TableRow, MatchPhase } from '@/types'

type TournRow  = Pick<TableRow<'tournaments'>, 'id' | 'format' | 'org_id' | 'status' | 'max_pairs'>
type EntryRow  = Pick<TableRow<'tournament_entries'>, 'id' | 'seed' | 'player1_name' | 'player2_name' | 'is_direct_entry'>
type GroupRow  = Pick<TableRow<'qual_groups'>, 'id' | 'group_index' | 'name'>
type GEntryRow = Pick<TableRow<'qual_group_entries'>, 'entry_id' | 'group_id' | 'position'>

const bodySchema = z.object({
  qualifiersPerGroup: z.number().int().min(1).max(4).default(1),
})

// ─── Seed positions FIP ────────────────────────────────────────────────────────

const SEED_POSITIONS: Record<number, number[]> = {
  4:  [0, 3, 1, 2],
  8:  [0, 7, 4, 3, 2, 5, 6, 1],
  16: [0, 15, 8, 7, 4, 11, 12, 3, 2, 13, 10, 5, 6, 9, 14, 1],
  32: [0, 31, 8, 23, 4, 27, 12, 19, 16, 15, 20, 11, 24, 7, 28, 3,
       2, 29, 6, 25, 10, 21, 14, 17, 1, 30, 9, 22, 5, 26, 13, 18],
  64: Array.from({ length: 64 }, (_, i) => i), // simplified
}

function nextPow2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(n, 4))))
}

function firstRoundPhase(drawSize: number): MatchPhase {
  if (drawSize <= 4)  return 'quarter_final'
  if (drawSize <= 8)  return 'quarter_final'
  if (drawSize <= 16) return 'round_of_16'
  return 'round_of_32'
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Slot ─────────────────────────────────────────────────────────────────────

type Slot = {
  entryId: string | null
  label:   string
  seed?:   number
  isBye:   boolean
}

function entrySlot(e: EntryRow): Slot {
  return {
    entryId: e.id,
    label:   `${e.player1_name ?? '?'} / ${e.player2_name ?? '?'}`,
    seed:    e.seed ?? undefined,
    isBye:   false,
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase  = await createClient()
  const admin     = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const tRes = await supabase.from('tournaments')
    .select('id, format, org_id, status, max_pairs').eq('slug', slug).maybeSingle()
  const t = tRes.data as TournRow | null
  if (!t) return NextResponse.json({ error: 'Tournoi introuvable' }, { status: 404 })

  const mRes = await supabase.from('org_members').select('role')
    .eq('org_id', t.org_id).eq('user_id', user.id).maybeSingle()
  const m = mRes.data as { role: string } | null
  if (!m || !['super_admin','federation_admin','club_admin'].includes(m.role)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  if (t.status !== 'active') {
    return NextResponse.json({ error: 'Générez d\'abord les groupes de qualification.' }, { status: 400 })
  }

  // ── Body ──────────────────────────────────────────────────────────────────────
  const rawBody = await req.json().catch(() => ({})) as Record<string, unknown>
  const { qualifiersPerGroup } = bodySchema.parse(rawBody)

  // ── Inscriptions ──────────────────────────────────────────────────────────────
  const { data: eData } = await supabase
    .from('tournament_entries')
    .select('id, seed, player1_name, player2_name, is_direct_entry')
    .eq('tournament_id', t.id)
    .not('status', 'eq', 'withdrawn')
  const allEntries = (eData ?? []) as EntryRow[]

  // Têtes de série directes : is_direct_entry = true, triées par seed
  const directSeeded = allEntries
    .filter(e => e.is_direct_entry && e.seed != null)
    .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))

  // Directs non-seedés (wild cards)
  const directUnseeded = shuffle(allEntries.filter(e => e.is_direct_entry && e.seed == null))

  // ── Groupes et qualifiés ──────────────────────────────────────────────────────
  const { data: gData } = await supabase
    .from('qual_groups').select('id, group_index, name')
    .eq('tournament_id', t.id).order('group_index')
  const groups = (gData ?? []) as GroupRow[]

  const qualifiedEntries: EntryRow[] = []

  if (groups.length > 0) {
    const { data: geData } = await supabase
      .from('qual_group_entries').select('entry_id, group_id, position')
      .in('group_id', groups.map(g => g.id))
    const groupEntries = (geData ?? []) as GEntryRow[]

    const entryMap = Object.fromEntries(allEntries.map(e => [e.id, e]))
    const directIds = new Set([...directSeeded, ...directUnseeded].map(e => e.id))

    for (const g of groups) {
      const members = groupEntries
        .filter(ge => ge.group_id === g.id && !directIds.has(ge.entry_id))
        .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))

      for (let rank = 0; rank < qualifiersPerGroup && rank < members.length; rank++) {
        const ge = members[rank]
        if (!ge) continue
        const entry = entryMap[ge.entry_id]
        if (entry) qualifiedEntries.push(entry)
      }
    }
  }

  const qualifiedShuffled = shuffle(qualifiedEntries)

  // ── Validation ────────────────────────────────────────────────────────────────
  const totalTeams = directSeeded.length + directUnseeded.length + qualifiedShuffled.length
  if (totalTeams < 2) {
    return NextResponse.json({
      error: groups.length === 0
        ? 'Aucune équipe éligible. Vérifiez les inscriptions et les groupes.'
        : `Pas assez d'équipes : ${directSeeded.length} tête(s) de série + ${qualifiedShuffled.length} qualifié(s). Augmentez le nombre de qualifiés par groupe.`,
    }, { status: 400 })
  }

  // ── Construire le draw ────────────────────────────────────────────────────────
  const drawSize = nextPow2(totalTeams)
  const byeCount = drawSize - totalTeams

  const slots: Slot[] = Array.from({ length: drawSize }, () => ({
    entryId: null, label: 'BYE', isBye: true,
  }))

  // 1. Têtes de série aux positions FIP
  const seedPos = SEED_POSITIONS[drawSize] ?? Array.from({ length: drawSize }, (_, i) => i)
  directSeeded.forEach((e, i) => {
    const pos = seedPos[i]
    if (pos !== undefined) slots[pos] = entrySlot(e)
  })

  // 2. Directs non-seedés + qualifiés dans les slots restants (mélangés)
  const takenPositions = new Set(slots.map((s, i) => s.entryId ? i : -1).filter(i => i >= 0))
  const freePositions  = shuffle(
    Array.from({ length: drawSize }, (_, i) => i).filter(i => !takenPositions.has(i))
  )

  ;[...directUnseeded, ...qualifiedShuffled].forEach((e, idx) => {
    const pos = freePositions[idx]
    if (pos !== undefined) slots[pos] = entrySlot(e)
  })

  // ── Nettoyer anciens matchs draw ──────────────────────────────────────────────
  await admin.from('matches').delete().eq('tournament_id', t.id).neq('phase', 'qualification')

  // ── Créer les matchs R1 ───────────────────────────────────────────────────────
  const phase = firstRoundPhase(drawSize)
  const matchInserts: Record<string, unknown>[] = []
  for (let i = 0; i < drawSize; i += 2) {
    const s1 = slots[i]!
    const s2 = slots[i + 1]!
    matchInserts.push({
      tournament_id: t.id,
      phase,
      format:        t.format,
      match_number:  i / 2,
      status:        (s1.isBye || s2.isBye) ? 'bye' : 'scheduled',
      entry1_id:     s1.isBye ? null : (s1.entryId ?? null),
      entry2_id:     s2.isBye ? null : (s2.entryId ?? null),
      notes:         null,
    })
  }
  await admin.from('matches').insert(matchInserts as never[])

  return NextResponse.json({
    ok:       true,
    drawSize,
    totalTeams,
    byeCount,
    directCount:    directSeeded.length + directUnseeded.length,
    qualifiedCount: qualifiedShuffled.length,
    slots: slots.map((s, i) => ({ position: i, ...s })),
    phase,
  })
}
