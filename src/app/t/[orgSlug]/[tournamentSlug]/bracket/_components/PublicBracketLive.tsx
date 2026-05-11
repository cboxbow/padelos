'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase/client'
import { BracketView }         from '@/app/(dashboard)/[orgSlug]/tournaments/[tournamentSlug]/_components/BracketView'
import type { BracketSlot }    from '@/app/(dashboard)/[orgSlug]/tournaments/[tournamentSlug]/_components/BracketView'
import type { TableRow }       from '@/types'

type LiveScoreRow = Pick<TableRow<'live_scores'>, 'match_id' | 'score_entry1' | 'score_entry2' | 'is_tiebreak'>

interface LiveMatchStatus {
  matchId:  string
  score:    string   // e.g. "4-3"
  isLive:   boolean
}

interface PublicBracketLiveProps {
  tournamentId: string
  slots:        BracketSlot[]
  drawSize:     number
  liveMatchIds: string[]   // matches currently 'live' from SSR
}

export function PublicBracketLive({
  tournamentId, slots, drawSize, liveMatchIds,
}: PublicBracketLiveProps) {
  const [liveStatuses, setLiveStatuses] = useState<Map<string, LiveMatchStatus>>(
    () => new Map(liveMatchIds.map(id => [id, { matchId: id, score: '', isLive: true }]))
  )

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`public-bracket-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'live_scores',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          const row = payload.new as LiveScoreRow | null
          if (!row) return
          setLiveStatuses(prev => {
            const next = new Map(prev)
            next.set(row.match_id, {
              matchId: row.match_id,
              score:   `${row.score_entry1}-${row.score_entry2}`,
              isLive:  true,
            })
            return next
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tournamentId])

  // Augment slots with live badge indicator (we pass extra className via label)
  const augmentedSlots = slots.map(s => {
    const status = s.entryId ? liveStatuses.get(s.entryId) : undefined
    if (!status?.isLive) return s
    return { ...s, label: `🔴 ${s.label}` }
  })

  return (
    <div className="space-y-4">
      {/* Live indicator legend */}
      {liveStatuses.size > 0 && (
        <div className="flex items-center gap-2 text-xs font-body text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span>Score en direct · mise à jour automatique</span>
          {[...liveStatuses.values()].map(s => (
            s.score ? (
              <span key={s.matchId} className="font-mono text-gold">{s.score}</span>
            ) : null
          ))}
        </div>
      )}

      <BracketView slots={augmentedSlots} drawSize={drawSize} />
    </div>
  )
}
