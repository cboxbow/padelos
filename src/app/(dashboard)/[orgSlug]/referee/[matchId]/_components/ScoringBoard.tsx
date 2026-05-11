'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Undo2, Wifi, WifiOff, CheckCircle2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import {
  initialScore,
  addGame,
  addSuperTbPoint,
  needsSuperTiebreak,
  checkMatchComplete,
  setsWon,
  scoreLabel,
  type MatchScore,
  type MatchPlayer,
} from '@/lib/tournament/scoring'
import type { MatchFormat, TableRow } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchRow = Pick<
  TableRow<'matches'>,
  'id' | 'tournament_id' | 'format' | 'status' | 'entry1_id' | 'entry2_id' | 'score'
>

interface ScoringBoardProps {
  match:        MatchRow
  orgSlug:      string
  tournSlug:    string
  team1Label:   string
  team2Label:   string
}

// ─── ScoringBoard ─────────────────────────────────────────────────────────────

export function ScoringBoard({ match, orgSlug, tournSlug, team1Label, team2Label }: ScoringBoardProps) {
  const router  = useRouter()
  const format  = match.format as MatchFormat

  const [history, setHistory] = useState<MatchScore[]>([])
  const [score,   setScore]   = useState<MatchScore>(() => {
    if (match.score && typeof match.score === 'object') {
      // Json type requires double cast (Supabase generic Json ≠ MatchScore)
      return match.score as unknown as MatchScore
    }
    return initialScore()
  })
  const [saving,    setSaving]    = useState(false)
  const [connected, setConnected] = useState(true)

  const { complete, winner } = checkMatchComplete(score, format)
  const sw      = setsWon(score)
  const inSuperTb = !!score.superTb
  const currentSet = score.sets.at(-1)

  // ── Supabase Realtime ──────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase
      .channel(`live-${match.id}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'live_scores',
        filter: `match_id=eq.${match.id}`,
      }, () => { setConnected(true) })
      .subscribe(status => { setConnected(status === 'SUBSCRIBED') })

    return () => { void supabase.removeChannel(channel) }
  }, [match.id])

  // ── Actions ────────────────────────────────────────────────────────────────
  function recordGame(player: MatchPlayer) {
    if (complete) return
    setHistory(h => [...h, score])
    const next = inSuperTb ? addSuperTbPoint(score, player) : addGame(score, format, player)
    setScore(next)
    void persistScore(next)
  }

  function undo() {
    const prev = history.at(-1)
    if (!prev) return
    setHistory(h => h.slice(0, -1))
    setScore(prev)
    void persistScore(prev)
  }

  async function persistScore(s: MatchScore) {
    setSaving(true)
    try {
      const res = await fetch(`/api/tournaments/${tournSlug}/matches/${match.id}/score`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(s),
      })
      if (!res.ok) toast.error('Erreur lors de la sauvegarde du score')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (complete) {
    const winnerLabel = winner === 'e1' ? team1Label : team2Label
    return (
      <MatchComplete winnerLabel={winnerLabel} scoreSummary={scoreLabel(score)}
        onBack={() => router.push(`/${orgSlug}/tournaments/${tournSlug}?tab=groups`)} />
    )
  }

  return (
    <div className="min-h-screen bg-court-deep flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-court-panel">
        <span className="font-body text-xs text-muted-foreground uppercase tracking-widest">
          {format.replace('FORMAT_', 'Format ')} · {inSuperTb ? 'Super TB' : `Set ${score.sets.length}`}
        </span>
        <div className="flex items-center gap-2">
          {connected ? <Wifi className="h-3.5 w-3.5 text-green-400" /> : <WifiOff className="h-3.5 w-3.5 text-red-400" />}
          {saving && <span className="font-body text-[10px] text-muted-foreground">Sauvegarde…</span>}
        </div>
      </div>

      {/* Scoreboard */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
        {/* Sets won */}
        <div className="flex gap-8 text-center">
          {(['e1','e2'] as MatchPlayer[]).map(p => (
            <div key={p} className="space-y-1">
              <p className="font-body text-xs text-muted-foreground truncate max-w-[140px]">
                {p === 'e1' ? team1Label : team2Label}
              </p>
              <p className="font-display text-6xl text-gold leading-none">{sw[p]}</p>
              <p className="font-body text-xs text-muted-foreground">set{sw[p] !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>

        {/* Current set or super TB score */}
        <div className="flex gap-6 text-center">
          {(['e1','e2'] as MatchPlayer[]).map(p => (
            <div key={p} className="space-y-0.5">
              <p className="font-display text-5xl text-foreground leading-none">
                {inSuperTb ? (score.superTb?.[p] ?? 0) : (currentSet?.[p] ?? 0)}
              </p>
              <p className="font-body text-[10px] text-muted-foreground uppercase tracking-widest">
                {inSuperTb ? 'pts' : 'jeux'}
              </p>
            </div>
          ))}
        </div>

        {/* Score history */}
        {score.sets.length > 1 && (
          <div className="font-mono text-sm text-muted-foreground">
            {scoreLabel(score)}
          </div>
        )}

        {/* Big scoring buttons */}
        <div className="flex gap-4 w-full max-w-sm mt-4">
          {(['e1','e2'] as MatchPlayer[]).map(p => (
            <button
              key={p}
              onClick={() => recordGame(p)}
              className="flex-1 rounded-2xl bg-court-card border-2 border-gold/30 hover:border-gold hover:bg-gold/10 active:scale-95 transition-all
                         flex flex-col items-center justify-center gap-2 py-8 px-4 select-none touch-none"
              style={{ minHeight: 120 }}
            >
              <span className="font-display text-5xl text-gold leading-none">+</span>
              <span className="font-body text-xs text-muted-foreground text-center leading-tight truncate w-full text-center">
                {p === 'e1' ? team1Label.split(' / ')[0] : team2Label.split(' / ')[0]}
              </span>
            </button>
          ))}
        </div>

        {/* Undo */}
        <Button
          variant="ghost"
          size="sm"
          onClick={undo}
          disabled={history.length === 0}
          className="text-muted-foreground hover:text-foreground gap-2 mt-2"
        >
          <Undo2 className="h-4 w-4" />
          Annuler
        </Button>
      </div>
    </div>
  )
}

// ─── MatchComplete ────────────────────────────────────────────────────────────

function MatchComplete({
  winnerLabel, scoreSummary, onBack,
}: { winnerLabel: string; scoreSummary: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-court-deep flex flex-col items-center justify-center gap-6 p-6">
      <Trophy className="h-16 w-16 text-gold" />
      <div className="text-center space-y-2">
        <p className="font-display text-4xl text-gold uppercase tracking-widest">Match terminé</p>
        <p className="font-body text-xl text-foreground">{winnerLabel}</p>
        <p className="font-mono text-sm text-muted-foreground">{scoreSummary}</p>
      </div>
      <Button onClick={onBack} className="bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase mt-4">
        <CheckCircle2 className="mr-2 h-4 w-4" />
        Retour au tournoi
      </Button>
    </div>
  )
}
