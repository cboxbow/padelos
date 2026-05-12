/**
 * POST /api/tournaments/[slug]/draw/swap
 * Échange deux entrées dans le tableau (swaps their positions in R1 matches).
 */

import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'
import { z }                 from 'zod'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TableRow }     from '@/types'

type TournRow = Pick<TableRow<'tournaments'>, 'id' | 'org_id'>

const bodySchema = z.object({
  entryIdA: z.string().uuid(),
  entryIdB: z.string().uuid(),
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

  const { entryIdA, entryIdB } = parsed.data

  // Trouver les matchs R1 contenant chaque entrée
  type MatchRow = { id: string; entry1_id: string | null; entry2_id: string | null }

  const { data: matchesData } = await admin
    .from('matches')
    .select('id, entry1_id, entry2_id')
    .eq('tournament_id', tournament.id)
    .neq('phase', 'qualification')
    .or(`entry1_id.eq.${entryIdA},entry2_id.eq.${entryIdA},entry1_id.eq.${entryIdB},entry2_id.eq.${entryIdB}`)

  const matches = (matchesData ?? []) as MatchRow[]

  const matchA = matches.find(m => m.entry1_id === entryIdA || m.entry2_id === entryIdA)
  const matchB = matches.find(m => m.entry1_id === entryIdB || m.entry2_id === entryIdB)

  if (!matchA || !matchB) return NextResponse.json({ error: 'Entrées introuvables dans le tableau' }, { status: 404 })

  // Swap : remplacer A par B et B par A dans leurs matchs respectifs
  const updatesA: Record<string, string | null> = {}
  if (matchA.entry1_id === entryIdA) updatesA.entry1_id = entryIdB
  else                                updatesA.entry2_id = entryIdB

  const updatesB: Record<string, string | null> = {}
  if (matchB.entry1_id === entryIdB) updatesB.entry1_id = entryIdA
  else                                updatesB.entry2_id = entryIdA

  // Si même match (A et B dans le même match R1) → juste les inverser
  if (matchA.id === matchB.id) {
    await admin.from('matches').update({
      entry1_id: matchA.entry1_id === entryIdA ? entryIdB : entryIdA,
      entry2_id: matchA.entry2_id === entryIdA ? entryIdB : entryIdA,
    } as never).eq('id', matchA.id)
  } else {
    await Promise.all([
      admin.from('matches').update(updatesA as never).eq('id', matchA.id),
      admin.from('matches').update(updatesB as never).eq('id', matchB.id),
    ])
  }

  return NextResponse.json({ ok: true })
}
