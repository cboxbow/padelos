import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/mpl'
import type { TableRow } from '@/types'

type OrgRow = Pick<TableRow<'organizations'>, 'id' | 'name' | 'slug'>

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const supabase = await createClient()

  // L'auth est déjà vérifiée dans (dashboard)/layout.tsx mais on re-fetch
  // pour avoir l'email à passer au DashboardLayout
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Vérifier que l'org existe
  const orgResult = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', orgSlug)
    .maybeSingle()

  const org = orgResult.data as OrgRow | null
  if (!org) notFound()

  // Vérifier que l'utilisateur est membre
  const memberResult = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!memberResult.data) {
    redirect('/login?error=acces_refuse')
  }

  return (
    <DashboardLayout orgSlug={orgSlug} userEmail={user.email}>
      {children}
    </DashboardLayout>
  )
}
