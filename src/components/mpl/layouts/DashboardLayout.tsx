import { cn } from '@/lib/utils'
import { Sidebar } from '@/components/mpl/layouts/Sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
  orgSlug: string
  /** Email de l'utilisateur connecté (passé depuis le Server Component parent) */
  userEmail?: string
  className?: string
}

/**
 * Layout principal du dashboard PadelOS.
 * Sidebar fixe (desktop) + barre mobile responsive.
 *
 * Usage dans un layout Next.js :
 * ```tsx
 * export default async function OrgLayout({ children, params }) {
 *   const { orgSlug } = await params
 *   const { data: { user } } = await supabase.auth.getUser()
 *   return (
 *     <DashboardLayout orgSlug={orgSlug} userEmail={user?.email}>
 *       {children}
 *     </DashboardLayout>
 *   )
 * }
 * ```
 */
export function DashboardLayout({
  children,
  orgSlug,
  userEmail,
  className,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-court">
      {/* Sidebar (client component — gère son propre état mobile) */}
      <Sidebar orgSlug={orgSlug} userEmail={userEmail} />

      {/* Contenu principal */}
      <div className="md:pl-64">
        {/* Espaceur mobile pour la barre du haut fixe */}
        <div className="h-14 md:hidden" aria-hidden="true" />

        <main
          className={cn(
            'min-h-[calc(100vh-3.5rem)] md:min-h-screen',
            'p-4 md:p-6 lg:p-8',
            className
          )}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
