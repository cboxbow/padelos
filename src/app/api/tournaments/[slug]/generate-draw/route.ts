import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TableRow, MatchPhase } from '@/types'

type TournRow  = Pick<TableRow<'tournaments'>, 'id' | 'format' | 'org_id' | 'status' | 'max_pairs'>
type EntryRow  = Pick<TableRow<'tournament_entries'>, 'id' | 'seed' | 'status' | 'player1_name' | 'player2_name'>
type GroupRow  = Pick<TableRow<'qual_groups'>, 'id' | 'group_index' | 'name'>
type GEntryRow = Pick<TableRow<'qual_group_entries'>, 'entry_id' | 'group_id' | 'position' | 'points'>

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

// ─── Shuffle (Fisher-Yates) ───────────────────────────────────────────────────

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

  // Auth + admin check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const tRes = await supabase.from('tournaments').select('id, format, org_id, status, max_pairs').eq('slug', slug).maybeSingle()
  const t    = tRes.data as TournRow | null
  if (!t) return NextResponse.json({ error: 'Tournoi introuvable' }, { status: 404 })

  const mRes = await supabase.from('org_members').select('role').eq('org_id', t.org_id).eq('user_id', user.id).maybeSingle()
  const m    = mRes.data as { role: string } | null
  if (!m || !['super_admin','federation_admin','club_admin'].includes(m.role)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  if (t.status !== 'active') {
    return NextResponse.json({ error: 'Générez d\'abord les groupes de qualification.' }, { status: 400 })
  }

  // ── Récupérer les inscriptions ─────────────────────────────────────────────
  const { data: eData } = await supabase.from('tournament_entries').select('id, seed, status, player1_name, player2_name').eq('tournament_id', t.id).not('status', 'eq', 'withdrawn')
  const allEntries = (eData ?? []) as EntryRow[]

  // Seeds directs (confirmed + seed set)
  const directEntries = allEntries.filter(e => e.seed !== null && e.status === 'confirmed').sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))

  // Qualifiés : top 1 de chaque groupe (position=0)
  const { data: gData  } = await supabase.from('qual_groups').select('id, group_index, name').eq('tournament_id', t.id).order('group_index')
  const groups = (gData ?? []) as GroupRow[]

  const { data: geData } = await supabase.from('qual_group_entries').select('entry_id, group_id, position, points').in('group_id', groups.map(g => g.id))
  const groupEntries = (geData ?? []) as GEntryRow[]

  // Top 1 de chaque groupe (position null after ranking, fallback by points)
  const qualifiers: Array<{ entryId: string; label: string }> = groups.map(g => {
    const members = groupEntries.filter(ge => ge.group_id === g.id).sort((a, b) => (a.position ?? 99) - (b.position ?? 99) || b.points - a.points)
    const label   = `Q${g.name.replace('Groupe ', '')}`  // QA, QB...
    return { entryId: members[0]?.entry_id ?? '', label }
  }).filter(q => q.entryId)

  // ── Construire le draw ─────────────────────────────────────────────────────
  const drawSize = drawSizeForPairs(t.max_pairs)
  const slots: Array<{ entryId: string | null; label: string; seed?: number; isBye: boolean }> = Array.from(
    { length: drawSize },
    () => ({ entryId: null, label: 'BYE', isBye: true }),
  )

  // Place seeds
  const seedPos = SEED_POSITIONS[drawSize] ?? SEED_POSITIONS[32]!
  directEntries.forEach((e, i) => {
    const pos = seedPos[i]
    if (pos !== undefined) {
      slots[pos] = { entryId: e.id, label: `[${e.seed}] ${e.player1_name ?? ''} / ${e.player2_name ?? ''}`, seed: e.seed ?? undefined, isBye: false }
    }
  })

  // Place qualifiers in remaining slots (shuffled)
  const emptyPositions = shuffle(slots.map((s, i) => i).filter(i => !slots[i]?.entryId && !slots[i]?.isBye))
  const allEmpty       = shuffle(slots.map((s, i) => i).filter(i => slots[i]!.entryId === null))

  let qualIdx = 0
  for (const pos of allEmpty) {
    if (qualIdx >= qualifiers.length) break
    const q = qualifiers[qualIdx++]!
    slots[pos] = { entryId: q.entryId, label: q.label, isBye: false }
  }

  // ── Nettoyer anciens matchs main draw ──────────────────────────────────────
  await admin.from('matches').delete().eq('tournament_id', t.id).neq('phase', 'qualification')

  // ── Créer les matchs du premier tour ──────────────────────────────────────
  const phase = firstRoundPhase(drawSize)
  const matchInserts = []
  for (let i = 0; i < drawSize; i += 2) {
    const s1 = slots[i]!
    const s2 = slots[i + 1]!
    const isBye = s1.isBye || s2.isBye
    matchInserts.push({
      tournament_id: t.id,
      phase,
      format:       t.format,
      match_number: i / 2,
      status:       isBye ? 'bye' : 'scheduled',
      entry1_id:    s1.entryId ?? null,
      entry2_id:    s2.entryId ?? null,
      notes:        isBye ? 'BYE' : null,
    })
  }

  await admin.from('matches').insert(matchInserts as never)

  return NextResponse.json({
    ok:       true,
    drawSize,
    slots:    slots.map((s, i) => ({ position: i, ...s })),
    phase,
  })
}
