import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TableRow, MatchPhase } from '@/types'

type TournRow  = Pick<TableRow<'tournaments'>, 'id' | 'format' | 'org_id' | 'status' | 'max_pairs'>
type EntryRow  = Pick<TableRow<'tournament_entries'>, 'id' | 'seed' | 'player1_name' | 'player2_name' | 'is_direct_entry'>
type GroupRow  = Pick<TableRow<'qual_groups'>, 'id' | 'group_index' | 'name'>
type GEntryRow = Pick<TableRow<'qual_group_entries'>, 'entry_id' | 'group_id' | 'position'>

// ─── Seed positions (FIP-compliant) ──────────────────────────────────────────

const SEED_POSITIONS: Record<number, number[]> = {
  8:  [0, 7, 4, 3, 2, 5, 6, 1],
  16: [0, 15, 8, 7, 4, 11, 12, 3, 2, 13, 10, 5, 6, 9, 14, 1],
  32: [0, 31, 8, 23, 4, 27, 12, 19, 16, 15, 20, 11, 24, 7, 28, 3,
       2, 29, 6, 25, 10, 21, 14, 17, 1, 30, 9, 22, 5, 26, 13, 18],
}

function drawSizeForPairs(maxPairs: number): number {
  const sizes = [4, 8, 16, 32, 64]
  return sizes.find(s => s >= maxPairs) ?? 32
}

function firstRoundPhase(drawSize: number): MatchPhase {
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

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = await createClient()
  const admin    = createAdminClient()

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

  // ── Récupérer les inscriptions ─────────────────────────────────────────────
  const { data: eData } = await supabase
    .from('tournament_entries')
    .select('id, seed, player1_name, player2_name, is_direct_entry')
    .eq('tournament_id', t.id)
    .not('status', 'eq', 'withdrawn')
  const allEntries = (eData ?? []) as EntryRow[]

  if (allEntries.length === 0) {
    return NextResponse.json({ error: 'Aucune inscription trouvée.' }, { status: 400 })
  }

  // ── Catégoriser les entrées ────────────────────────────────────────────────
  // Direct entries (is_direct_entry = true) : placées aux positions FIP par seed
  const directSeeded = allEntries
    .filter(e => e.is_direct_entry && e.seed !== null)
    .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))
  const directUnseeded = shuffle(allEntries.filter(e => e.is_direct_entry && e.seed === null))
  const directAll = [...directSeeded, ...directUnseeded]

  // Entries de qualification (passent par les groupes)
  const qualEntryIds = new Set(directAll.map(e => e.id))
  const qualEntries  = allEntries.filter(e => !qualEntryIds.has(e.id))

  // ── Récupérer l'ordre dans les groupes ────────────────────────────────────
  // (position = ordre après matchs; avant matchs = ordre d'insertion)
  const { data: gData } = await supabase
    .from('qual_groups').select('id, group_index, name')
    .eq('tournament_id', t.id).order('group_index')
  const groups = (gData ?? []) as GroupRow[]

  let orderedQuals: EntryRow[] = []
  if (groups.length > 0) {
    const { data: geData } = await supabase
      .from('qual_group_entries').select('entry_id, group_id, position')
      .in('group_id', groups.map(g => g.id))
    const groupEntries = (geData ?? []) as GEntryRow[]

    // Trier par groupe (group_index) puis par position dans le groupe
    const entryMap = Object.fromEntries(allEntries.map(e => [e.id, e]))
    const sorted: EntryRow[] = []
    groups.forEach(g => {
      const members = groupEntries
        .filter(ge => ge.group_id === g.id)
        .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
      members.forEach(ge => {
        const entry = entryMap[ge.entry_id]
        if (entry && !qualEntryIds.has(ge.entry_id)) sorted.push(entry)
      })
    })
    orderedQuals = sorted
  } else {
    // Pas de groupes : trier tous les non-directs par seed puis mélanger
    orderedQuals = shuffle(qualEntries)
  }

  // Entries non présentes dans les groupes (sécurité)
  const inGroupIds = new Set(orderedQuals.map(e => e.id))
  const ungrouped  = shuffle(qualEntries.filter(e => !inGroupIds.has(e.id)))

  // Ordre final : directs seedés → directs non-seedés → qualifiés groupes → non groupés
  const allToPlace = [...directAll, ...orderedQuals, ...ungrouped]

  // ── Construire le draw ─────────────────────────────────────────────────────
  const drawSize = drawSizeForPairs(t.max_pairs)
  type Slot = { entryId: string | null; label: string; seed?: number; isBye: boolean }
  const slots: Slot[] = Array.from({ length: drawSize }, () => ({ entryId: null, label: 'BYE', isBye: true }))

  const seedPos = SEED_POSITIONS[drawSize] ?? SEED_POSITIONS[32]!

  // 1. Placer les directs seedés aux positions FIP
  directSeeded.forEach((e, i) => {
    const pos = seedPos[i]
    if (pos !== undefined) {
      slots[pos] = {
        entryId: e.id,
        label:   `[${e.seed}] ${e.player1_name ?? ''} / ${e.player2_name ?? ''}`,
        seed:    e.seed ?? undefined,
        isBye:   false,
      }
    }
  })

  // 2. Placer tous les autres dans les slots vides (mélangés)
  const takenPositions = new Set(slots.map((s, i) => s.entryId ? i : -1).filter(i => i >= 0))
  const freePositions  = shuffle(slots.map((_, i) => i).filter(i => !takenPositions.has(i)))

  // Paires à placer : directs non-seedés + qualifiés groupes + non groupés
  const toPlace = [...directUnseeded, ...orderedQuals, ...ungrouped]
  toPlace.forEach((e, idx) => {
    const pos = freePositions[idx]
    if (pos !== undefined) {
      const isQual = !e.is_direct_entry
      slots[pos] = {
        entryId: e.id,
        label:   isQual
          ? `${e.player1_name ?? '?'} / ${e.player2_name ?? '?'}`
          : `${e.player1_name ?? '?'} / ${e.player2_name ?? '?'}`,
        seed:  e.seed ?? undefined,
        isBye: false,
      }
    }
  })

  // ── Nettoyer anciens matchs main draw ──────────────────────────────────────
  await admin.from('matches').delete().eq('tournament_id', t.id).neq('phase', 'qualification')

  // ── Créer les matchs du premier tour ──────────────────────────────────────
  const phase = firstRoundPhase(drawSize)
  const matchInserts: Record<string, unknown>[] = []
  for (let i = 0; i < drawSize; i += 2) {
    const s1    = slots[i]!
    const s2    = slots[i + 1]!
    const isBye = s1.isBye || s2.isBye
    matchInserts.push({
      tournament_id: t.id,
      phase,
      format:        t.format,
      match_number:  i / 2,
      status:        isBye ? 'bye' : 'scheduled',
      entry1_id:     s1.isBye ? null : (s1.entryId ?? null),
      entry2_id:     s2.isBye ? null : (s2.entryId ?? null),
      notes:         isBye ? 'BYE' : null,
    })
  }

  await admin.from('matches').insert(matchInserts as never[])

  return NextResponse.json({
    ok:       true,
    drawSize,
    slots:    slots.map((s, i) => ({ position: i, ...s })),
    phase,
  })
}
