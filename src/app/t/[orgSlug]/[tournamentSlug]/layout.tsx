import type { Metadata }   from 'next'
import Link                 from 'next/link'
import { notFound }         from 'next/navigation'
import { createClient }     from '@/lib/supabase/server'
import { StatusBadge, CategoryBadge } from '@/components/mpl'
import { PublicNavClient }  from './_components/PublicNavClient'
import type { TableRow }    from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgRow  = Pick<TableRow<'organizations'>, 'id' | 'name' | 'slug' | 'logo_url'>
type TournRow = Pick<TableRow<'tournaments'>, 'id' | 'name' | 'slug' | 'category' | 'status' | 'start_date' | 'end_date' | 'city' | 'venue'>

// ─── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>
}): Promise<Metadata> {
  const { orgSlug, tournamentSlug } = await params
  const supabase = await createClient()

  const [orgRes, tRes] = await Promise.all([
    supabase.from('organizations').select('name').eq('slug', orgSlug).maybeSingle(),
    supabase.from('tournaments').select('name, category, start_date, city').eq('slug', tournamentSlug).maybeSingle(),
  ])

  const org  = orgRes.data as { name: string } | null
  const t    = tRes.data  as { name: string; category: string; start_date: string; city: string | null } | null

  if (!t || !org) return { title: 'Tournoi' }

  const year = new Date(t.start_date).getFullYear()
  const desc = `${t.category} · ${t.city ?? org.name} · ${year}`

  return {
    title:       `${t.name} | ${org.name}`,
    description: desc,
    openGraph: {
      title:       t.name,
      description: desc,
      type:        'website',
    },
  }
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default async function PublicTournamentLayout({
  params,
  children,
}: {
  params:   Promise<{ orgSlug: string; tournamentSlug: string }>
  children: React.ReactNode
}) {
  const { orgSlug, tournamentSlug } = await params
  const supabase = await createClient()

  // Fetch org + tournament — no auth check (public)
  const [orgRes, tRes] = await Promise.all([
    supabase.from('organizations').select('id, name, slug, logo_url').eq('slug', orgSlug).maybeSingle(),
    supabase.from('tournaments')
      .select('id, name, slug, category, status, start_date, end_date, city, venue')
      .eq('slug', tournamentSlug)
      .maybeSingle(),
  ])

  const org = orgRes.data as OrgRow | null
  const t   = tRes.data  as TournRow | null
  if (!org || !t) notFound()

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  const navLinks = [
    { label: 'Overview',  href: `/t/${orgSlug}/${tournamentSlug}` },
    { label: 'Groupes',   href: `/t/${orgSlug}/${tournamentSlug}/groups` },
    { label: 'Tableau',   href: `/t/${orgSlug}/${tournamentSlug}/bracket` },
    { label: 'Planning',  href: `/t/${orgSlug}/${tournamentSlug}/schedule` },
  ]

  return (
    <div className="min-h-screen bg-court text-foreground">
      {/* ── Public header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-court-panel/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-0">
          {/* Top row */}
          <div className="flex items-center justify-between py-3 border-b border-border/50">
            {/* Org brand */}
            <Link
              href={`/t/${orgSlug}/${tournamentSlug}`}
              className="flex items-center gap-2.5 group"
            >
              {org.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.logo_url} alt={org.name} className="h-7 w-7 rounded object-contain" />
              ) : (
                <div className="h-7 w-7 rounded bg-gold/20 flex items-center justify-center">
                  <span className="font-display text-xs text-gold">
                    {org.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="font-body text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {org.name}
              </span>
            </Link>

            {/* Status + PDF export */}
            <div className="flex items-center gap-2">
              <StatusBadge status={t.status} />
              {t.status !== 'draft' && (
                <a
                  href={`/api/tournaments/${tournamentSlug}/export/draw`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-body border border-border rounded text-muted-foreground hover:border-gold/40 hover:text-foreground transition-colors"
                >
                  ↓ PDF
                </a>
              )}
            </div>
          </div>

          {/* Tournament title row */}
          <div className="py-3 flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl tracking-wider uppercase text-foreground leading-none truncate">
                {t.name}
              </h1>
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                {fmt(t.start_date)} – {fmt(t.end_date)}
                {t.city && ` · ${t.city}`}
                {t.venue && ` · ${t.venue}`}
              </p>
            </div>
            <CategoryBadge category={t.category} withGenderIcon className="h-fit shrink-0" />
          </div>

          {/* ── Nav tabs ──────────────────────────────────────────────── */}
          <PublicNavClient links={navLinks} />
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* ── Public footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border mt-12 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="font-body text-xs text-muted-foreground/50">
            Propulsé par{' '}
            <span className="text-gold font-semibold">PadelOS</span>
            {' '}— Le système d&apos;exploitation digital pour le padel
          </p>
        </div>
      </footer>
    </div>
  )
}
