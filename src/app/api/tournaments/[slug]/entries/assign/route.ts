/**
 * PATCH /api/tournaments/[slug]/entries/assign
 *
 * Met à jour is_direct_entry sur une ou plusieurs paires.
 * Utilisé avant la génération des groupes.
 */

import { NextResponse }     from 'next/server'
import type { NextRequest } from 'next/server'
import { z }                from 'zod'
import { createClient }     from '@/lib/supabase/server'
import type { TableRow }    from '@/types'

type TournRow = Pick<TableRow<'tournaments'>, 'id' | 'org_id' | 'status'>

const bodySchema = z.object({
  updates: z.array(z.object({
    id:              z.string().uuid(),
    is_direct_entry: z.boolean(),
  })).min(1),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase  = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const tRes = await supabase
    .from('tournaments').select('id, org_id, status').eq('slug', slug).maybeSingle()
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

  // Mettre à jour chaque entrée
  const errors: string[] = []
  for (const u of parsed.data.updates) {
    const { error } = await supabase
      .from('tournament_entries')
      .update({ is_direct_entry: u.is_direct_entry } as never)
      .eq('id', u.id)
      .eq('tournament_id', tournament.id)
    if (error) errors.push(u.id)
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: `Erreur sur ${errors.length} entrée(s)` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: parsed.data.updates.length })
}
