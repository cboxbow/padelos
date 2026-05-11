/**
 * SSE endpoint — OBS live score feed.
 *
 * GET /api/obs/[matchId]/score
 *
 * Streams live_scores updates every 2 seconds.
 * No authentication required (public read — OBS browser source doesn't support auth headers).
 * The match ID itself acts as a capability token; URLs are long UUIDs.
 */

import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TableRow } from '@/types'

type LiveScoreRow = TableRow<'live_scores'>

const POLL_INTERVAL_MS = 2_000  // 2 s between polls

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        try {
          const admin = createAdminClient()
          const { data } = await admin
            .from('live_scores')
            .select('*')
            .eq('match_id', matchId)
            .maybeSingle()

          const payload = data ? (data as LiveScoreRow) : null
          const msg     = `data: ${JSON.stringify(payload)}\n\n`
          controller.enqueue(encoder.encode(msg))
        } catch {
          // Silently skip failed polls — client will reconnect on stream close
        }
      }

      // Initial push
      await send()

      // Polling loop — store handle so cancel() can clear it
      const handle = setInterval(() => {
        send().catch(() => {
          clearInterval(handle)
          try { controller.close() } catch { /* already closed */ }
        })
      }, POLL_INTERVAL_MS)

      // Attach handle to controller so cancel() can access it
      ;(controller as unknown as { _handle: ReturnType<typeof setInterval> })._handle = handle
    },

    cancel(controller) {
      const handle = (controller as unknown as { _handle: ReturnType<typeof setInterval> | undefined })._handle
      if (handle !== undefined) clearInterval(handle)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':                'text/event-stream; charset=utf-8',
      'Cache-Control':               'no-cache, no-transform',
      'Connection':                  'keep-alive',
      'X-Accel-Buffering':           'no',       // disable Nginx buffering
      'Access-Control-Allow-Origin': '*',         // allow OBS browser source
    },
  })
}
