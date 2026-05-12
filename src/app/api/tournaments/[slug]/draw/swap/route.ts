/**
 * POST /api/tournaments/[slug]/draw/swap
 * Échange deux slots du tableau (positions R1).
 * Fonctionne avec n'importe quelle combinaison : équipe↔équipe, équipe↔BYE, BYE↔BYE.
 *
 * Body : { positionA: number, positionB: number }
 */

import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'
import { z }                 from 'zod'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TableRow }     from '@/types'

type TournRow = Pick<TableRow<'tournaments'>, 'id' | 'org_id'>
type MatchRow = {
  id:           string
  match_number: number | null
  entry1_id:    string | null
  entry2_id:    string | null
  status:       string | null
}

const bodySchema = z.object({
  positionA: z.number().int().min(0),
  positionB: z.number().int().min(0),
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

  const tRes = await supabase.from('tournaments').select('id, org_id').eq('slug', slug).maybeSingle()
  const tournament = tRes.data as TournRow | null
  if (!tournament) return NextResponse.json({ error: 'Tournoi introuvable' }, { status: 404 })

  const mRes = await supabase.from('org_members').select('role')
    .eq('org_id', tournament.org_id).eq('user_id', user.id).maybeSingle()
  const member = mRes.data as { role: string } | null
  if (!member || !['super_admin','federation_admin','club_admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const body   = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })

  const { positionA, positionB } = parsed.data
  if (positionA === positionB) return NextResponse.json({ ok: true })

  // Position → match_number + slot index (0 = entry1, 1 = entry2)
  const matchNumA = Math.floor(positionA / 2)
  const slotIdxA  = positionA % 2
  const matchNumB = Math.floor(positionB / 2)
  const slotIdxB  = positionB % 2

  const { data: matchesData } = await admin
    .from('matches')
    .select('id, match_number, entry1_id, entry2_id, status')
    .eq('tournament_id', tournament.id)
    .neq('phase', 'qualification')
    .in('match_number', [matchNumA, matchNumB])

  const matches = (matchesData ?? []) as MatchRow[]
  const matchA  = matches.find(m => m.match_number === matchNumA)
  const matchB  = matches.find(m => m.match_number === matchNumB)

  if (!matchA || !matchB) {
    return NextResponse.json({ error: 'Matchs introuvables' }, { status: 404 })
  }

  // Valeurs actuelles des deux slots
  const valA = slotIdxA === 0 ? matchA.entry1_id : matchA.entry2_id
  const valB = slotIdxB === 0 ? matchB.entry1_id : matchB.entry2_id

  if (matchA.id === matchB.id) {
    // Même match — inverser entry1/entry2
    const newStatus = (matchA.entry1_id == null || matchA.entry2_id == null) ? 'bye' : 'scheduled'
    await admin.from('matches').update({
      entry1_id: valB,
      entry2_id: valA,
      status:    newStatus,
    } as never).eq('id', matchA.id)
  } else {
    // Matches différents — swap croisé
    const updA: Record<string, unknown> = slotIdxA === 0
      ? { entry1_id: valB }
      : { entry2_id: valB }
    const updB: Record<string, unknown> = slotIdxB === 0
      ? { entry1_id: valA }
      : { entry2_id: valA }

    // Recalculer le statut après swap
    const newStatusA = determineStatus(slotIdxA === 0 ? valB : matchA.entry1_id, slotIdxA === 1 ? valB : matchA.entry2_id)
    const newStatusB = determineStatus(slotIdxB === 0 ? valA : matchB.entry1_id, slotIdxB === 1 ? valA : matchB.entry2_id)
    updA.status = newStatusA
    updB.status = newStatusB

    await Promise.all([
      admin.from('matches').update(updA as never).eq('id', matchA.id),
      admin.from('matches').update(updB as never).eq('id', matchB.id),
    ])
  }

  return NextResponse.json({ ok: true })
}

function determineStatus(e1: string | null | undefined, e2: string | null | undefined): string {
  return (e1 == null || e2 == null) ? 'bye' : 'scheduled'
}
