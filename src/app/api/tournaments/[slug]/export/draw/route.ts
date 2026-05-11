/**
 * GET /api/tournaments/[slug]/export/draw
 *
 * Génère le tableau officiel MPL en PDF A4 paysage.
 * Utilise @react-pdf/renderer côté serveur — aucune dépendance navigateur.
 * Public : accessible sans authentification pour diffusion / affichage terrain.
 */

import type { NextRequest }                           from 'next/server'
import React                                          from 'react'
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { Style }                                 from '@react-pdf/types'
import { createClient }                               from '@/lib/supabase/server'
import type { TableRow, TournamentCategory, MatchFormat } from '@/types'
import { CATEGORY_LABELS, MATCH_FORMAT_SHORT }        from '@/components/mpl/design-tokens'

// ─── Types ────────────────────────────────────────────────────────────────────

type TournRow = Pick<TableRow<'tournaments'>,
  'id' | 'name' | 'category' | 'format' | 'start_date' | 'end_date' | 'venue' | 'city' | 'max_pairs'>
type MatchRow = Pick<TableRow<'matches'>, 'id' | 'phase' | 'status' | 'match_number' | 'entry1_id' | 'entry2_id' | 'winner_id' | 'score'>
type EntryRow = Pick<TableRow<'tournament_entries'>, 'id' | 'seed' | 'player1_name' | 'player2_name'>

// ─── MPL colour palette ───────────────────────────────────────────────────────

const C = {
  gold:       '#C9A84C',
  goldLight:  '#E8C96A',
  court:      '#0A0C12',
  courtCard:  '#0E1118',
  courtPanel: '#131720',
  border:     '#1E2535',
  fg:         '#F0F2F7',
  muted:      '#6B7694',
  white:      '#FFFFFF',
  black:      '#000000',
} as const

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    backgroundColor: C.court,
    paddingHorizontal: 28,
    paddingVertical: 22,
    fontFamily: 'Helvetica',
    color: C.fg,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    justifyContent:'space-between',
    marginBottom:  16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.gold,
  },
  headerLeft: { flex: 1 },
  tournName: {
    fontSize:      22,
    fontFamily:    'Helvetica-Bold',
    color:         C.fg,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom:  3,
  },
  headerMeta: {
    fontSize:    9,
    color:       C.muted,
    letterSpacing: 0.5,
  },
  catBadge: {
    backgroundColor: C.gold,
    borderRadius:    4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf:       'flex-start',
  },
  catText: {
    fontSize:  12,
    fontFamily:'Helvetica-Bold',
    color:     C.black,
    letterSpacing: 1,
  },

  // ── Bracket area ──
  bracketRow: {
    flexDirection:  'row',
    flex:           1,
    gap:            8,
  },
  half: {
    flex:    1,
    gap:     0,
  },

  // ── Match slot ──
  matchBlock: {
    marginBottom:   6,
    borderRadius:   4,
    overflow:       'hidden',
    borderWidth:    1,
    borderColor:    C.border,
  },
  slotRow: {
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   C.courtCard,
  },
  slotRowLast: {
    paddingHorizontal: 8,
    paddingVertical:   4,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   C.courtCard,
  },
  slotRowWinner: {
    backgroundColor: '#0F1A10',
  },
  slotRowBye: {
    backgroundColor: C.courtPanel,
  },
  seedText: {
    fontSize:    7,
    color:       C.gold,
    fontFamily:  'Helvetica-Bold',
    width:       14,
    flexShrink:  0,
  },
  slotText: {
    fontSize:    7.5,
    color:       C.fg,
    flex:        1,
  },
  byeText: {
    fontSize:    7,
    color:       C.muted,
    fontFamily:  'Helvetica-Oblique',
  },
  scoreText: {
    fontSize:    7,
    color:       C.gold,
    fontFamily:  'Helvetica-Bold',
  },
  matchLabel: {
    fontSize:    6,
    color:       C.muted,
    letterSpacing: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: C.courtPanel,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  // ── Final centre ──
  finalBox: {
    width:           60,
    alignSelf:       'center',
    borderRadius:    6,
    borderWidth:     1,
    borderColor:     C.gold,
    backgroundColor: '#1A1500',
    paddingHorizontal: 8,
    paddingVertical:  10,
    alignItems:      'center',
    gap:             4,
  },
  finalLabel: {
    fontSize:  9,
    fontFamily:'Helvetica-Bold',
    color:     C.gold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  finalTbd: {
    fontSize:  8,
    color:     C.muted,
    textTransform: 'uppercase',
  },

  // ── Section headings ──
  sectionTitle: {
    fontSize:    8,
    color:       C.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  // ── Footer ──
  footer: {
    position:  'absolute',
    bottom:    14,
    left:      28,
    right:     28,
    flexDirection: 'row',
    justifyContent:'space-between',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 6,
    color:    C.muted,
  },
  footerBrand: {
    fontSize:  6,
    color:     C.gold,
    fontFamily:'Helvetica-Bold',
  },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

const scoreStr = (m: MatchRow) => {
  if (!m.score) return ''
  const s = m.score as { sets?: Array<{e1:number; e2:number}> } | null
  return s?.sets?.map(set => `${set.e1}-${set.e2}`).join(' ') ?? ''
}

// ─── DrawDocument ─────────────────────────────────────────────────────────────

interface MatchData {
  id:       string
  phase:    string
  code:     string
  e1Label:  string
  e2Label:  string
  e1Seed?:  number
  e2Seed?:  number
  e1Wins:   boolean
  e2Wins:   boolean
  score:    string
  isBye:    boolean
}

function DrawDocument({
  tournament,
  leftMatches,
  rightMatches,
  finalWinner,
}: {
  tournament:   TournRow
  leftMatches:  MatchData[]
  rightMatches: MatchData[]
  finalWinner:  string
}) {
  const catLabel   = CATEGORY_LABELS[tournament.category as TournamentCategory] ?? tournament.category
  const fmtLabel   = MATCH_FORMAT_SHORT[tournament.format as MatchFormat] ?? tournament.format
  const dateStr    = `${fmtDate(tournament.start_date)} – ${fmtDate(tournament.end_date)}`
  const locationStr = [tournament.venue, tournament.city].filter(Boolean).join(', ')

  const MatchBlock = ({ m }: { m: MatchData }) => (
    React.createElement(View, { style: S.matchBlock },
      React.createElement(Text, { style: S.matchLabel }, m.code),
      React.createElement(View, {
        style: [S.slotRow, m.isBye ? S.slotRowBye : (m.e1Wins ? S.slotRowWinner : S.slotRow)] as Style[],
      },
        m.e1Seed ? React.createElement(Text, { style: S.seedText }, `[${m.e1Seed}]`) : null,
        React.createElement(Text, { style: m.isBye ? S.byeText : S.slotText },
          m.isBye ? 'BYE' : m.e1Label
        ),
        m.e1Wins && m.score ? React.createElement(Text, { style: S.scoreText }, m.score) : null,
      ),
      React.createElement(View, {
        style: [S.slotRowLast, m.e2Wins ? S.slotRowWinner : S.slotRowLast] as Style[],
      },
        m.e2Seed ? React.createElement(Text, { style: S.seedText }, `[${m.e2Seed}]`) : null,
        React.createElement(Text, { style: S.slotText }, m.e2Label),
      ),
    )
  )

  return React.createElement(
    Document,
    { title: tournament.name },
    React.createElement(
      Page,
      { size: 'A4', orientation: 'landscape', style: S.page },

      // ── Header ──
      React.createElement(View, { style: S.header },
        React.createElement(View, { style: S.headerLeft },
          React.createElement(Text, { style: S.tournName }, tournament.name),
          React.createElement(Text, { style: S.headerMeta },
            `${dateStr}${locationStr ? `  ·  ${locationStr}` : ''}  ·  Format ${fmtLabel}  ·  Draw ${tournament.max_pairs}`
          ),
        ),
        React.createElement(View, { style: S.catBadge },
          React.createElement(Text, { style: S.catText }, catLabel),
        ),
      ),

      // ── Bracket ──
      React.createElement(View, { style: S.bracketRow },
        // Left half
        React.createElement(View, { style: S.half },
          React.createElement(Text, { style: S.sectionTitle }, 'Partie haute'),
          ...leftMatches.map(m => React.createElement(MatchBlock, { key: m.id, m })),
        ),

        // Final
        React.createElement(View, { style: S.finalBox },
          React.createElement(Text, { style: S.finalLabel }, 'FINALE'),
          React.createElement(Text, { style: S.finalTbd }, finalWinner || 'TBD'),
        ),

        // Right half
        React.createElement(View, { style: S.half },
          React.createElement(Text, { style: S.sectionTitle }, 'Partie basse'),
          ...rightMatches.map(m => React.createElement(MatchBlock, { key: m.id, m })),
        ),
      ),

      // ── Footer ──
      React.createElement(View, { style: S.footer, fixed: true },
        React.createElement(Text, { style: S.footerText },
          `Généré le ${new Date().toLocaleDateString('fr-FR')} · PadelOS`
        ),
        React.createElement(Text, { style: S.footerBrand }, 'PADELOSHQ.COM'),
      ),
    ),
  )
}

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase  = await createClient()

  // Tournament (public — no auth)
  const tRes = await supabase
    .from('tournaments')
    .select('id, name, category, format, start_date, end_date, venue, city, max_pairs')
    .eq('slug', slug)
    .maybeSingle()
  const t = tRes.data as TournRow | null
  if (!t) return Response.json({ error: 'Tournoi introuvable' }, { status: 404 })

  // Main draw matches
  const { data: matchData } = await supabase
    .from('matches')
    .select('id, phase, status, match_number, entry1_id, entry2_id, winner_id, score')
    .eq('tournament_id', t.id)
    .neq('phase', 'qualification')
    .order('match_number')
  const matches = (matchData ?? []) as MatchRow[]

  // Entries
  const entryIds = [...new Set([
    ...matches.map(m => m.entry1_id),
    ...matches.map(m => m.entry2_id),
  ].filter(Boolean))] as string[]

  const { data: entryData } = entryIds.length > 0
    ? await supabase.from('tournament_entries').select('id, seed, player1_name, player2_name').in('id', entryIds)
    : { data: [] }
  const entries  = (entryData ?? []) as EntryRow[]
  const entryMap = new Map(entries.map(e => [e.id, e]))

  const entryLabel = (id: string | null): string => {
    if (!id) return 'TBD'
    const e = entryMap.get(id)
    if (!e) return 'TBD'
    return `${e.player1_name ?? '?'} / ${e.player2_name ?? '?'}`
  }

  // Build match data
  const phaseLabel: Record<string, string> = {
    round_of_32: 'R32', round_of_16: 'R16', quarter_final: 'QF',
    semi_final: 'SF', final: 'F',
  }

  const allMatchData: MatchData[] = matches.map(m => {
    const e1  = m.entry1_id ? entryMap.get(m.entry1_id) : null
    const e2  = m.entry2_id ? entryMap.get(m.entry2_id) : null
    return {
      id:      m.id,
      phase:   m.phase,
      code:    `${phaseLabel[m.phase] ?? m.phase} · Match ${m.match_number ?? '—'}`,
      e1Label: entryLabel(m.entry1_id),
      e2Label: entryLabel(m.entry2_id),
      e1Seed:  e1?.seed ?? undefined,
      e2Seed:  e2?.seed ?? undefined,
      e1Wins:  m.winner_id === m.entry1_id && !!m.winner_id,
      e2Wins:  m.winner_id === m.entry2_id && !!m.winner_id,
      score:   scoreStr(m),
      isBye:   m.status === 'bye',
    }
  })

  // Split half
  const half         = Math.ceil(allMatchData.length / 2)
  const leftMatches  = allMatchData.slice(0, half)
  const rightMatches = [...allMatchData.slice(half)].reverse()

  // Final winner
  const finalMatch  = allMatchData.find(m => m.phase === 'final')
  const finalWinner = finalMatch?.e1Wins ? finalMatch.e1Label
    : finalMatch?.e2Wins ? finalMatch.e2Label
    : ''

  // Render PDF — cast through unknown to satisfy react-pdf's ReactElement<DocumentProps> constraint
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docElement = React.createElement(DrawDocument, { tournament: t, leftMatches, rightMatches, finalWinner }) as any
  const pdfBuffer  = await renderToBuffer(docElement)

  const filename = `draw_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`

  // pdfBuffer is a Node.js Buffer; convert to Uint8Array for the Web Response API
  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}
