'use client'

/**
 * ImportPairesDialog — import CSV / Excel de paires.
 *
 * Format attendu (avec ou sans en-tête) :
 *   Joueur 1 | Joueur 2 | Tête de série (opt.) | Direct Entry (opt.)
 *
 * Colonnes détectées automatiquement par nom ou position.
 */

import { useRef, useState }    from 'react'
import { useRouter }           from 'next/navigation'
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast }               from 'sonner'
import { Button }              from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import type { TableRow } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  player1_name: string
  player2_name: string
  seed?:        number
  direct_entry: boolean
  _error?:      string
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

const H1 = ['joueur1','player1','joueur 1','player 1','j1','p1','nom 1','name 1']
const H2 = ['joueur2','player2','joueur 2','player 2','j2','p2','nom 2','name 2']
const HS = ['seed','tête','tete','tds','ts','seeded']
const HD = ['direct','de','direct entry','directentry']

function detectCol(headers: string[], candidates: string[]): number {
  return headers.findIndex(h => candidates.includes(h.toLowerCase().trim()))
}

function parseBool(v: string): boolean {
  return ['1','true','oui','yes','o','y'].includes(v.toLowerCase().trim())
}

function parseRows(raw: string[][]): ParsedRow[] {
  if (raw.length === 0) return []

  // Détecter si la première ligne est un en-tête
  const firstRow = raw[0].map(c => c.toLowerCase().trim())
  const hasHeader = H1.some(h => firstRow.includes(h)) || H2.some(h => firstRow.includes(h))

  let c1 = 0, c2 = 1, cS = -1, cD = -1
  const dataRows = hasHeader ? raw.slice(1) : raw

  if (hasHeader) {
    c1 = detectCol(raw[0], H1); if (c1 < 0) c1 = 0
    c2 = detectCol(raw[0], H2); if (c2 < 0) c2 = 1
    cS = detectCol(raw[0], HS)
    cD = detectCol(raw[0], HD)
  } else {
    // Sans en-tête : positions fixes 0,1,2,3
    cS = 2; cD = 3
  }

  return dataRows
    .filter(r => r.some(c => c.trim() !== ''))
    .map(r => {
      const p1 = (r[c1] ?? '').trim()
      const p2 = (r[c2] ?? '').trim()
      if (!p1 || !p2) return { player1_name: p1, player2_name: p2, direct_entry: false, _error: 'Noms manquants' }
      if (p1.length < 2 || p2.length < 2) return { player1_name: p1, player2_name: p2, direct_entry: false, _error: 'Minimum 2 caractères' }
      const seedRaw = cS >= 0 ? (r[cS] ?? '').trim() : ''
      const seed    = seedRaw ? (Number.isInteger(+seedRaw) && +seedRaw > 0 ? +seedRaw : undefined) : undefined
      const de      = cD >= 0 ? parseBool(r[cD] ?? '') : false
      return { player1_name: p1, player2_name: p2, seed, direct_entry: de }
    })
}

async function parseFile(file: File): Promise<ParsedRow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text()
    const sep  = text.includes(';') ? ';' : ','
    const raw  = text.split(/\r?\n/).map(l => l.split(sep))
    return parseRows(raw)
  }

  // Excel : import dynamique de xlsx
  const { read, utils } = await import('xlsx')
  const buf  = await file.arrayBuffer()
  const wb   = read(buf, { type: 'array' })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const raw  = utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })
  return parseRows(raw as string[][])
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  tournamentSlug: string
  onImported:     (entries: TableRow<'tournament_entries'>[]) => void
}

export function ImportPairesDialog({ tournamentSlug, onImported }: Props) {
  const router            = useRouter()
  const inputRef          = useRef<HTMLInputElement>(null)
  const [open, setOpen]   = useState(false)
  const [rows, setRows]   = useState<ParsedRow[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone]   = useState<{ imported: number; skipped: number } | null>(null)

  const valid   = rows.filter(r => !r._error)
  const invalid = rows.filter(r => r._error)

  async function onFile(file: File | undefined) {
    if (!file) return
    setDone(null)
    try {
      const parsed = await parseFile(file)
      setRows(parsed)
    } catch {
      toast.error('Impossible de lire le fichier.')
    }
  }

  async function handleImport() {
    if (valid.length === 0) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/tournaments/${tournamentSlug}/entries/import`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ entries: valid }),
      })
      const json = await res.json() as { imported?: number; skipped?: number; entries?: TableRow<'tournament_entries'>[]; error?: string }
      if (!res.ok) { toast.error(json.error ?? 'Erreur import'); return }
      setDone({ imported: json.imported ?? 0, skipped: json.skipped ?? 0 })
      onImported(json.entries ?? [])
      router.refresh()
      toast.success(`${json.imported} paire(s) importée(s)`)
    } finally {
      setLoading(false)
    }
  }

  function reset() { setRows([]); setDone(null) }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-border text-muted-foreground hover:text-gold hover:border-gold/40">
          <FileSpreadsheet className="h-4 w-4" />
          Importer CSV / Excel
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-court-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg tracking-wider uppercase">
            Importer des paires
          </DialogTitle>
        </DialogHeader>

        {/* Format attendu */}
        <p className="text-xs text-muted-foreground font-body">
          Colonnes attendues (dans cet ordre, avec ou sans en-tête) :<br />
          <span className="font-mono text-gold/80">Joueur 1 · Joueur 2 · Tête de série (opt.) · Direct Entry (opt.)</span>
        </p>

        {/* Zone de dépôt */}
        {rows.length === 0 && !done && (
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-gold/40 transition-colors"
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="font-body text-sm text-muted-foreground">
              Glisser-déposer ou <span className="text-gold underline">choisir un fichier</span>
            </p>
            <p className="font-body text-xs text-muted-foreground/60 mt-1">.csv · .xlsx · .xls</p>
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden"
              onChange={e => onFile(e.target.files?.[0])} />
          </div>
        )}

        {/* Résultat import */}
        {done && (
          <div className="flex items-center gap-3 rounded-lg border border-green-800 bg-green-950/40 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
            <div className="font-body text-sm">
              <span className="text-green-400 font-semibold">{done.imported} paire(s) importée(s)</span>
              {done.skipped > 0 && <span className="text-muted-foreground ml-2">({done.skipped} ignorée(s) — tableau complet)</span>}
            </div>
          </div>
        )}

        {/* Aperçu */}
        {rows.length > 0 && !done && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-body text-xs text-muted-foreground">
                <span className="text-foreground font-semibold">{valid.length}</span> paire(s) valide(s)
                {invalid.length > 0 && <span className="text-red-400 ml-2">· {invalid.length} erreur(s) ignorée(s)</span>}
              </p>
              <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs text-muted-foreground gap-1">
                <X className="h-3 w-3" /> Changer
              </Button>
            </div>

            <div className="max-h-52 overflow-y-auto rounded-lg border border-border text-xs font-mono">
              <table className="w-full">
                <thead className="sticky top-0 bg-court-panel">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-muted-foreground">Joueur 1</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">Joueur 2</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">Seed</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">DE</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r, i) => (
                    <tr key={i} className={r._error ? 'bg-red-950/20' : ''}>
                      <td className="px-3 py-1.5 text-foreground">{r.player1_name || '—'}</td>
                      <td className="px-3 py-1.5 text-foreground">{r.player2_name || '—'}</td>
                      <td className="px-3 py-1.5 text-gold">{r.seed ?? '—'}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.direct_entry ? 'Oui' : '—'}</td>
                      <td className="px-3 py-1.5">
                        {r._error && (
                          <span className="flex items-center gap-1 text-red-400">
                            <AlertCircle className="h-3 w-3" /> {r._error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              onClick={handleImport}
              disabled={loading || valid.length === 0}
              className="w-full bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase h-9 text-xs"
            >
              {loading ? 'Import en cours…' : `Importer ${valid.length} paire(s)`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
