import { notFound }        from 'next/navigation'
import { headers }         from 'next/headers'
import Link                from 'next/link'
import { Radio, Monitor } from 'lucide-react'
import { createClient }    from '@/lib/supabase/server'
import { SectionTitle, CategoryBadge, StatusBadge } from '@/components/mpl'
import { BroadcastClient } from './_components/BroadcastClient'
import type { TableRow }   from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type TournRow  = Pick<TableRow<'tournaments'>,  'id' | 'name' | 'slug' | 'category' | 'status'>
type MatchRow  = Pick<TableRow<'matches'>,       'id' | 'phase' | 'status' | 'entry1_id' | 'entry2_id' | 'court'>
type EntryRow  = Pick<TableRow<'tournament_entries'>, 'id' | 'player1_name' | 'player2_name'>
type OrgRow    = Pick<TableRow<'organizations'>, 'id' | 'name'>

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BroadcastPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>
}) {
  const { orgSlug, tournamentSlug } = await params
  const supabase = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Org
  const orgRes = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', orgSlug)
    .maybeSingle()
  const org = orgRes.data as OrgRow | null
  if (!org) notFound()

  // Admin check
  const mbrRes = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()
  const mbr = mbrRes.data as { role: string } | null
  const ADMIN_ROLES = ['super_admin', 'federation_admin', 'club_admin']
  if (!mbr || !ADMIN_ROLES.includes(mbr.role)) notFound()

  // Tournament
  const tRes = await supabase
    .from('tournaments')
    .select('id, name, slug, category, status')
    .eq('slug', tournamentSlug)
    .maybeSingle()
  const t = tRes.data as TournRow | null
  if (!t) notFound()

  // Matches that are live or scheduled in the main draw
  const { data: matchData } = await supabase
    .from('matches')
    .select('id, phase, status, entry1_id, entry2_id, court')
    .eq('tournament_id', t.id)
    .neq('phase', 'qualification')
    .in('status', ['live', 'scheduled'])
    .order('phase')
  const matches = (matchData ?? []) as MatchRow[]

  // Load entry names for all matches
  const entryIds = [...new Set([
    ...matches.map(m => m.entry1_id),
    ...matches.map(m => m.entry2_id),
  ].filter(Boolean))] as string[]

  const { data: entryData } = await supabase
    .from('tournament_entries')
    .select('id, player1_name, player2_name')
    .in('id', entryIds)
  const entries = (entryData ?? []) as EntryRow[]
  const entryMap = new Map(entries.map(e => [e.id, e]))

  // Build app base URL from request headers (host + protocol)
  const headersList = await headers()
  const host  = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') ?? 'http'
  const appUrl = `${proto}://${host}`

  // Build OBS URL builders
  const obsMatch = matches.map(m => {
    const e1 = m.entry1_id ? entryMap.get(m.entry1_id) : null
    const e2 = m.entry2_id ? entryMap.get(m.entry2_id) : null
    const label = [
      e1?.player1_name, e1?.player2_name,
      'vs',
      e2?.player1_name, e2?.player2_name,
    ].filter(Boolean).join(' ')

    return {
      id:            m.id,
      phase:         m.phase,
      status:        m.status,
      court:         m.court,
      label:         label || m.id,
      scoreboardUrl: `${appUrl}/obs/scoreboard.html?match=${m.id}&api=${appUrl}`,
      lowerThirdUrl: `${appUrl}/obs/lower-third.html?match=${m.id}&api=${appUrl}`,
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionTitle
            title="Diffusion OBS"
            subtitle={t.name}
            withAccent
            as="h1"
          />
        </div>
        <div className="flex items-center gap-2">
          <CategoryBadge category={t.category} className="h-fit" />
          <StatusBadge   status={t.status}     className="h-fit" />
        </div>
      </div>

      {/* Finalize section — only if not completed */}
      {t.status !== 'completed' && (
        <FinalizeSection tournSlug={tournamentSlug} />
      )}

      {/* OBS overlays */}
      <div className="space-y-3">
        <h2 className="font-display text-sm tracking-widest uppercase text-muted-foreground">
          Overlays OBS — {matches.length} match{matches.length !== 1 ? 's' : ''} actif{matches.length !== 1 ? 's' : ''}
        </h2>

        {obsMatch.length === 0 && (
          <div className="rounded-xl border border-border bg-court-panel px-6 py-10 text-center">
            <Monitor className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="font-body text-sm text-muted-foreground">
              Aucun match en cours ou planifié dans le tableau principal.
            </p>
            <p className="font-body text-xs text-muted-foreground/60 mt-1">
              Lancez des matchs depuis l&apos;onglet Tableau pour voir les URLs OBS ici.
            </p>
          </div>
        )}

        {obsMatch.map(m => (
          <div key={m.id} className="rounded-xl border border-border bg-court-panel overflow-hidden">
            {/* Match header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-court-card">
              <div className="flex items-center gap-2">
                {m.status === 'live' && (
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-red-400 uppercase tracking-wider">
                    <Radio className="h-3 w-3" /> Live
                  </span>
                )}
                <span className="font-body text-sm font-medium text-foreground">{m.label}</span>
              </div>
              {m.court && (
                <span className="font-mono text-xs text-muted-foreground">{m.court}</span>
              )}
            </div>

            {/* URL rows */}
            <div className="divide-y divide-border">
              <BroadcastClient.UrlRow
                label="Scoreboard 800×200"
                description="Score en temps réel — fond foncé"
                url={m.scoreboardUrl}
                previewPath={`/obs/scoreboard.html?match=${m.id}&api=${appUrl}`}
              />
              <BroadcastClient.UrlRow
                label="Lower Third 1920×200"
                description="Bannière noms de joueurs — bas d'écran"
                url={m.lowerThirdUrl}
                previewPath={`/obs/lower-third.html?match=${m.id}&api=${appUrl}`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* OBS setup instructions */}
      <details className="group">
        <summary className="cursor-pointer list-none flex items-center gap-2 font-body text-xs text-muted-foreground hover:text-foreground transition-colors">
          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
          Comment configurer OBS
        </summary>
        <div className="mt-3 rounded-xl border border-border bg-court-panel p-5 text-sm font-body space-y-2 text-muted-foreground">
          <p className="text-foreground font-semibold">Ajouter une source &ldquo;Navigateur&rdquo; dans OBS :</p>
          <ol className="list-decimal list-inside space-y-1.5 ml-2">
            <li>Dans OBS, cliquez sur <code className="bg-court text-gold px-1 rounded">+</code> dans la liste Sources</li>
            <li>Sélectionnez <strong>Navigateur</strong> (Browser Source)</li>
            <li>Collez l&apos;URL copiée ci-dessus</li>
            <li>Scoreboard : <code className="bg-court text-gold px-1 rounded">800 × 200</code> — activez <em>Contrôler l&apos;audio</em></li>
            <li>Lower Third : <code className="bg-court text-gold px-1 rounded">1920 × 200</code> — positionnez en bas de scène</li>
            <li>Cochez <strong>Actualiser le navigateur lorsque la scène devient active</strong></li>
          </ol>
          <p className="text-xs text-muted-foreground/60 pt-1">
            Le score se met à jour automatiquement toutes les 2 secondes via Server-Sent Events.
          </p>
        </div>
      </details>

      {/* Back link */}
      <Link
        href={`/${orgSlug}/tournaments/${tournamentSlug}?tab=draw`}
        className="inline-flex items-center gap-1.5 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Retour au tableau
      </Link>
    </div>
  )
}

// ─── Finalize section ─────────────────────────────────────────────────────────

function FinalizeSection({ tournSlug }: { tournSlug: string }) {
  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-5 flex items-start gap-4">
      <div className="flex-1 space-y-1">
        <p className="font-body font-semibold text-foreground">Finaliser le tournoi</p>
        <p className="font-body text-sm text-muted-foreground">
          Calcule les points FIP pour tous les joueurs selon leur tour atteint,
          enregistre les ranking_points et met à jour les classements.
        </p>
      </div>
      <BroadcastClient.FinalizeButton tournSlug={tournSlug} />
    </div>
  )
}
