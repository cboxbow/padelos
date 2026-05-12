'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { UserPlus, Trash2, Crown, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import type { TableRow } from '@/types'
import { ImportPairesDialog } from './ImportPairesDialog'

type EntryRow  = TableRow<'tournament_entries'>
type TournRow  = Pick<TableRow<'tournaments'>, 'id' | 'slug' | 'status' | 'max_pairs'>

// ─── Schéma ───────────────────────────────────────────────────────────────────

const addEntrySchema = z.object({
  player1_name: z.string().min(2, 'Minimum 2 caractères').max(80),
  player2_name: z.string().min(2, 'Minimum 2 caractères').max(80),
  seed:         z.coerce.number().int().min(1).max(128).optional().or(z.literal('')),
  direct_entry: z.boolean().default(false),
})
type AddEntryInput = z.infer<typeof addEntrySchema>

// ─── TeamsTab ─────────────────────────────────────────────────────────────────

interface TeamsTabProps {
  tournamentSlug: string
  tournament:     TournRow
  initialEntries: EntryRow[]
}

export function TeamsTab({ tournamentSlug, tournament, initialEntries }: TeamsTabProps) {
  const router = useRouter()
  const [entries, setEntries] = useState<EntryRow[]>(initialEntries)
  const [deleting, startDelete] = useTransition()
  const canAdd = ['draft','registration'].includes(tournament.status) && entries.length < tournament.max_pairs

  const form = useForm<AddEntryInput>({
    resolver: zodResolver(addEntrySchema),
    defaultValues: { player1_name: '', player2_name: '', direct_entry: false },
  })

  // ── Add entry ───────────────────────────────────────────────────────────────
  async function onSubmit(data: AddEntryInput) {
    const res = await fetch(`/api/tournaments/${tournamentSlug}/entries`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...data, seed: data.seed || undefined }),
    })
    const json = await res.json() as { entry?: EntryRow; error?: string }
    if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }
    setEntries(prev => [...prev, json.entry!])
    form.reset()
    toast.success('Paire ajoutée')
    router.refresh()
  }

  // ── Delete entry ────────────────────────────────────────────────────────────
  function deleteEntry(entryId: string) {
    startDelete(async () => {
      const res = await fetch(`/api/tournaments/${tournamentSlug}/entries?entryId=${entryId}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Erreur lors de la suppression'); return }
      setEntries(prev => prev.filter(e => e.id !== entryId))
      toast.success('Paire supprimée')
      router.refresh()
    })
  }

  const seeded   = entries.filter(e => e.seed !== null).sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))
  const unseeded = entries.filter(e => e.seed === null)

  return (
    <div className="space-y-6">
      {/* Compteur + bouton import */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-body text-sm text-muted-foreground">
            <span className="text-foreground font-semibold">{entries.length}</span> / {tournament.max_pairs} paires inscrites
          </span>
          {entries.length >= tournament.max_pairs && (
            <span className="text-xs font-body text-amber-400 bg-amber-950/40 border border-amber-800 px-2 py-0.5 rounded-full">
              Tableau complet
            </span>
          )}
        </div>
        {canAdd && (
          <ImportPairesDialog
            tournamentSlug={tournamentSlug}
            onImported={(newEntries) => setEntries(prev => [...prev, ...newEntries])}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulaire ajout */}
        {canAdd && (
          <div className="rounded-xl border border-border bg-court-card p-5 space-y-4">
            <h3 className="font-display text-base tracking-wider uppercase text-foreground flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-gold" />
              Ajouter une paire
            </h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="player1_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Joueur 1</FormLabel>
                      <FormControl>
                        <Input placeholder="Prénom Nom" className="bg-court border-border focus-visible:ring-gold/50 h-9 text-sm" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="player2_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Joueur 2</FormLabel>
                      <FormControl>
                        <Input placeholder="Prénom Nom" className="bg-court border-border focus-visible:ring-gold/50 h-9 text-sm" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                </div>

                <div className="flex items-end gap-3">
                  <FormField control={form.control} name="seed" render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-xs">Tête de série (optionnel)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={128} placeholder="ex. 1" className="bg-court border-border focus-visible:ring-gold/50 h-9 text-sm" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="direct_entry" render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-xs">Direct Entry</FormLabel>
                      <div className="flex items-center gap-2 h-9">
                        <button
                          type="button"
                          onClick={() => field.onChange(!field.value)}
                          className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${field.value ? 'bg-gold' : 'bg-court-hover border border-border'}`}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${field.value ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                        <span className="font-body text-xs text-muted-foreground">{field.value ? 'Oui' : 'Non'}</span>
                      </div>
                    </FormItem>
                  )} />
                </div>

                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="w-full bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase h-9 text-xs"
                >
                  {form.formState.isSubmitting ? 'Ajout…' : 'Ajouter la paire'}
                </Button>
              </form>
            </Form>
          </div>
        )}

        {/* Liste des paires */}
        <div className="rounded-xl border border-border overflow-hidden">
          {entries.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-body text-sm text-muted-foreground">Aucune paire inscrite</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-court-panel">
                  <th className="px-3 py-2.5 text-left text-[10px] font-body font-medium text-muted-foreground tracking-widest uppercase">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-body font-medium text-muted-foreground tracking-widest uppercase">Paire</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-body font-medium text-muted-foreground tracking-widest uppercase">Statut</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {seeded.map((entry, i) => (
                  <EntryRow key={entry.id} entry={entry} index={i + 1} onDelete={deleteEntry} deleting={deleting} />
                ))}
                {unseeded.map((entry, i) => (
                  <EntryRow key={entry.id} entry={entry} index={seeded.length + i + 1} onDelete={deleteEntry} deleting={deleting} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── EntryRow ─────────────────────────────────────────────────────────────────

function EntryRow({
  entry, index, onDelete, deleting,
}: {
  entry:   EntryRow
  index:   number
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const p1 = entry.player1_name ?? '—'
  const p2 = entry.player2_name ?? '—'
  const isDE = entry.status === 'confirmed' && entry.seed !== null

  return (
    <tr className="hover:bg-court-hover/40 transition-colors">
      <td className="px-3 py-2.5">
        {entry.seed ? (
          <span className="inline-flex items-center gap-1 font-mono text-xs text-gold">
            <Crown className="h-3 w-3" />
            {entry.seed}
          </span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">{index}</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="font-body text-sm text-foreground">{p1}</div>
        <div className="font-body text-xs text-muted-foreground">{p2}</div>
      </td>
      <td className="px-3 py-2.5">
        {isDE ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-purple-400 bg-purple-950/40 border border-purple-800 px-1.5 py-0.5 rounded">
            <Shield className="h-2.5 w-2.5" /> DE
          </span>
        ) : (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
            entry.status === 'confirmed'
              ? 'text-green-400 bg-green-950/40 border-green-800'
              : 'text-muted-foreground bg-court-hover border-border'
          }`}>
            {entry.status === 'confirmed' ? 'Confirmé' : 'En attente'}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(entry.id)}
          disabled={deleting}
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  )
}
