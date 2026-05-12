'use client'

import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import {
  createTournamentSchema,
  toTournamentSlug,
  type CreateTournamentInput,
} from '@/lib/validations/tournament'
import { createTournament } from '@/app/actions/tournaments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { SectionTitle } from '@/components/mpl'

// ─── Constantes UI ────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { group: 'Masculin',  values: ['M25','M50','M100','M250','M500','M1000'] },
  { group: 'Féminin',   values: ['W25','W50','W100','W250','W500','W1000'] },
  { group: 'Juniors',   values: ['JUNIOR_U11','JUNIOR_U13','JUNIOR_U15']   },
] as const

const CATEGORY_LABELS: Record<string, string> = {
  M25:'M25', M50:'M50', M100:'M100', M250:'M250', M500:'M500', M1000:'M1000',
  W25:'W25', W50:'W50', W100:'W100', W250:'W250', W500:'W500', W1000:'W1000',
  JUNIOR_U11:'U11', JUNIOR_U13:'U13', JUNIOR_U15:'U15',
}

const FORMAT_OPTIONS = [
  { value: 'FORMAT_A', label: 'Format A — 3 sets (TB régulier à 6-6, super TB si 1-1)' },
  { value: 'FORMAT_B', label: 'Format B — 2 sets + super TB décisif si 1-1' },
  { value: 'FORMAT_C', label: 'Format C — 1 set + super TB décisif si 6-6' },
  { value: 'FORMAT_D', label: 'Format D — Set court (premier à 4 jeux)' },
]

const MAX_PAIRS_OPTIONS = [4, 8, 16, 24, 32, 48, 64, 96, 128]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewTournamentPage() {
  const params  = useParams<{ orgSlug: string }>()
  const router  = useRouter()
  const orgSlug = params.orgSlug

  const form = useForm<CreateTournamentInput>({
    resolver: zodResolver(createTournamentSchema),
    defaultValues: {
      name:     '',
      format:   'FORMAT_A',
      max_pairs: 32,
    },
  })

  async function onSubmit(data: CreateTournamentInput) {
    const result = await createTournament(orgSlug, data)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Tournoi créé avec succès !')
    // result.data is defined when result.error is undefined (discriminated union)
    router.push(`/${orgSlug}/tournaments/${result.data!.slug}`)
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0 text-muted-foreground hover:text-foreground">
          <Link href={`/${orgSlug}/tournaments`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <SectionTitle title="Nouveau tournoi" withAccent as="h1" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Bloc principal */}
          <FormCard title="Informations générales">
            {/* Nom */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nom du tournoi *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="MPL Open 2026"
                    className="bg-court border-border focus-visible:ring-gold/50"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e)
                      // Auto-preview slug
                    }}
                  />
                </FormControl>
                {field.value && (
                  <FormDescription className="font-mono text-[11px]">
                    Slug : {toTournamentSlug(field.value)}
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )} />

            {/* Catégorie + Format côte à côte */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Catégorie *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-court border-border focus:ring-gold/50">
                        <SelectValue placeholder="Choisir…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-court-panel border-border">
                      {CATEGORY_OPTIONS.map(({ group, values }) => (
                        <div key={group}>
                          <p className="px-2 py-1.5 text-[10px] font-mono text-muted-foreground tracking-widest uppercase">{group}</p>
                          {values.map(v => (
                            <SelectItem key={v} value={v}>{CATEGORY_LABELS[v]}</SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="format" render={({ field }) => (
                <FormItem>
                  <FormLabel>Format de match *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-court border-border focus:ring-gold/50">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-court-panel border-border">
                      {FORMAT_OPTIONS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Max paires */}
            <FormField control={form.control} name="max_pairs" render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre maximum de paires *</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} defaultValue={String(field.value)}>
                  <FormControl>
                    <SelectTrigger className="bg-court border-border focus:ring-gold/50">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-court-panel border-border">
                    {MAX_PAIRS_OPTIONS.map(n => (
                      <SelectItem key={n} value={String(n)}>{n} paires</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </FormCard>

          {/* Dates */}
          <FormCard title="Dates">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="start_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Début *</FormLabel>
                  <FormControl>
                    <Input type="date" className="bg-court border-border focus-visible:ring-gold/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="end_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fin *</FormLabel>
                  <FormControl>
                    <Input type="date" className="bg-court border-border focus-visible:ring-gold/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="registration_end" render={({ field }) => (
              <FormItem>
                <FormLabel>Clôture des inscriptions</FormLabel>
                <FormControl>
                  <Input type="date" className="bg-court border-border focus-visible:ring-gold/50" {...field} />
                </FormControl>
                <FormDescription>Optionnel — doit être avant la date de début.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </FormCard>

          {/* Lieu */}
          <FormCard title="Lieu (optionnel)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="venue" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du lieu</FormLabel>
                  <FormControl>
                    <Input placeholder="Club Padel Tamarin" className="bg-court border-border focus-visible:ring-gold/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ville</FormLabel>
                  <FormControl>
                    <Input placeholder="Port-Louis" className="bg-court border-border focus-visible:ring-gold/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </FormCard>

          {/* Description */}
          <FormCard title="Description (optionnel)">
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Informations complémentaires sur le tournoi…"
                    className="bg-court border-border focus-visible:ring-gold/50 resize-none min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>{(field.value?.length ?? 0)}/500</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </FormCard>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase"
            >
              {form.formState.isSubmitting ? 'Création…' : 'Créer le tournoi'}
            </Button>
            <Button variant="ghost" type="button" asChild className="text-muted-foreground">
              <Link href={`/${orgSlug}/tournaments`}>Annuler</Link>
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

// ─── FormCard ─────────────────────────────────────────────────────────────────

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-court-card p-6 space-y-5">
      <h2 className="font-display text-lg tracking-wider uppercase text-foreground border-b border-border pb-3">
        {title}
      </h2>
      {children}
    </div>
  )
}
