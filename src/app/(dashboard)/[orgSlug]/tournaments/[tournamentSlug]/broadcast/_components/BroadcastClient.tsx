'use client'

import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import { toast }                   from 'sonner'
import { Copy, Check, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── UrlRow ───────────────────────────────────────────────────────────────────

interface UrlRowProps {
  label:       string
  description: string
  url:         string
  previewPath: string
}

function UrlRow({ label, description, url, previewPath }: UrlRowProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('URL copiée dans le presse-papier')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossible de copier — sélectionnez et copiez manuellement')
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-body text-xs font-semibold text-foreground">{label}</p>
        <p className="font-body text-[11px] text-muted-foreground">{description}</p>
        <p className="font-mono text-[11px] text-muted-foreground/60 truncate mt-0.5">
          {url}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Preview in new tab */}
        <a
          href={previewPath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-border text-xs text-muted-foreground hover:border-gold/40 hover:text-foreground transition-colors"
          title="Prévisualiser"
        >
          <ExternalLink className="h-3 w-3" />
          <span className="hidden sm:inline">Aperçu</span>
        </a>
        {/* Copy */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className={`border-border text-xs gap-1.5 transition-colors ${
            copied
              ? 'border-green-500/50 text-green-400 bg-green-500/5'
              : 'hover:border-gold/40 hover:text-foreground'
          }`}
        >
          {copied
            ? <><Check className="h-3 w-3" /> Copié</>
            : <><Copy className="h-3 w-3" /> Copier</>
          }
        </Button>
      </div>
    </div>
  )
}

// ─── FinalizeButton ───────────────────────────────────────────────────────────

interface FinalizeButtonProps {
  tournSlug: string
}

function FinalizeButton({ tournSlug }: FinalizeButtonProps) {
  const router               = useRouter()
  const [pending, startTrans] = useTransition()
  const [done, setDone]      = useState(false)

  async function handleFinalize() {
    startTrans(async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournSlug}/finalize`, {
          method: 'POST',
        })
        const body = await res.json() as {
          ok?: boolean
          error?: string
          pointsInserted?: number
          playersUpdated?: number
        }

        if (!res.ok || body.error) {
          toast.error(body.error ?? 'Erreur lors de la finalisation')
          return
        }

        toast.success(
          `Tournoi finalisé — ${body.pointsInserted ?? 0} points FIP enregistrés pour ${body.playersUpdated ?? 0} joueurs.`,
        )
        setDone(true)
        router.refresh()
      } catch {
        toast.error('Erreur réseau — veuillez réessayer')
      }
    })
  }

  if (done) {
    return (
      <span className="flex items-center gap-1.5 font-body text-sm text-green-400">
        <Check className="h-4 w-4" /> Finalisé
      </span>
    )
  }

  return (
    <Button
      onClick={handleFinalize}
      disabled={pending}
      className="shrink-0 bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase text-xs"
    >
      {pending
        ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Calcul…</>
        : 'Finaliser & calculer FIP'
      }
    </Button>
  )
}

// ─── Namespace export (avoids barrel + keeps file count low) ─────────────────

export const BroadcastClient = { UrlRow, FinalizeButton }
