'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Search, UserPlus, Medal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { addPlayer }                                        from '@/app/actions/players'
import { addPlayerSchema, type AddPlayerInput }             from '@/lib/validations/players'
import type { TableRow } from '@/types'

type PlayerRow = Pick<
  TableRow<'player_profiles'>,
  'id' | 'display_name' | 'first_name' | 'last_name' | 'gender' | 'nationality' | 'ranking_points' | 'is_active' | 'created_at'
>

interface PlayersClientProps {
  orgSlug:        string
  initialPlayers: PlayerRow[]
}

export function PlayersClient({ orgSlug, initialPlayers }: PlayersClientProps) {
  const router = useRouter()
  const [players]               = useState<PlayerRow[]>(initialPlayers)
  const [query,   setQuery]     = useState('')
  const [sheetOpen, setSheet]   = useState(false)
  const [adding, startAdd]      = useTransition()

  const form = useForm<AddPlayerInput>({
    resolver: zodResolver(addPlayerSchema),
    defaultValues: { first_name: '', last_name: '', gender: 'M', nationality: 'MU' },
  })

  const filtered = query.trim()
    ? players.filter(p =>
        p.display_name.toLowerCase().includes(query.toLowerCase()) ||
        `${p.first_name ?? ''} ${p.last_name ?? ''}`.toLowerCase().includes(query.toLowerCase()),
      )
    : players

  async function onSubmit(data: AddPlayerInput) {
    startAdd(async () => {
      const result = await addPlayer(orgSlug, data)
      if (result.error) { toast.error(result.error); return }
      toast.success(`${data.first_name} ${data.last_name} ajouté`)
      setSheet(false)
      form.reset()
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un joueur…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9 bg-court border-border focus-visible:ring-gold/50"
          />
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheet}>
          <SheetTrigger asChild>
            <Button className="bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase shrink-0">
              <UserPlus className="mr-2 h-4 w-4" />
              Ajouter un joueur
            </Button>
          </SheetTrigger>
          <SheetContent className="bg-court-panel border-border w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="font-display tracking-wider uppercase text-foreground">
                Nouveau joueur
              </SheetTitle>
            </SheetHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="first_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom *</FormLabel>
                      <FormControl>
                        <Input className="bg-court border-border focus-visible:ring-gold/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="last_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom *</FormLabel>
                      <FormControl>
                        <Input className="bg-court border-border focus-visible:ring-gold/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="gender" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Genre *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-court border-border focus:ring-gold/50">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-court-panel border-border">
                          <SelectItem value="M">Masculin</SelectItem>
                          <SelectItem value="F">Féminin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="nationality" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nationalité</FormLabel>
                      <FormControl>
                        <Input maxLength={2} className="bg-court border-border focus-visible:ring-gold/50 uppercase" {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" disabled={adding} className="w-full bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase">
                  {adding ? 'Ajout…' : 'Ajouter'}
                </Button>
              </form>
            </Form>
          </SheetContent>
        </Sheet>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-court-panel">
              <th className="px-4 py-3 text-left text-xs font-body font-medium text-muted-foreground tracking-widest uppercase">#</th>
              <th className="px-4 py-3 text-left text-xs font-body font-medium text-muted-foreground tracking-widest uppercase">Joueur</th>
              <th className="px-4 py-3 text-left text-xs font-body font-medium text-muted-foreground tracking-widest uppercase hidden sm:table-cell">Nat.</th>
              <th className="px-4 py-3 text-right text-xs font-body font-medium text-muted-foreground tracking-widest uppercase">Points FIP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center font-body text-sm text-muted-foreground">
                {query ? 'Aucun résultat pour cette recherche.' : 'Aucun joueur enregistré.'}
              </td></tr>
            ) : filtered.map((p, i) => (
              <tr key={p.id} className="hover:bg-court-hover/40 transition-colors">
                <td className="px-4 py-3">
                  {i < 3
                    ? <Medal className={`h-4 w-4 ${i === 0 ? 'text-gold' : i === 1 ? 'text-slate-400' : 'text-amber-700'}`} />
                    : <span className="font-mono text-sm text-muted-foreground">{i + 1}</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <p className="font-body font-medium text-foreground">{p.display_name}</p>
                  <p className="font-body text-xs text-muted-foreground">{p.gender === 'M' ? '♂' : '♀'}</p>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="font-mono text-sm text-muted-foreground">{p.nationality}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-sm font-bold text-gold">{p.ranking_points ?? 0}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
