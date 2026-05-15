---
name: nextjs-conventions
description: Patterns et conventions Next.js 15 App Router pour PadelOS. Utiliser pour créer des pages, composants, route handlers, middleware, ou résoudre des problèmes d'architecture Next.js. Déclencher quand l'utilisateur crée un composant, une page, un hook, une API route, ou travaille sur le routing et la structure de l'application.
---

# Next.js 15 App Router — Conventions PadelOS

## Server vs Client Components

```typescript
// ✅ SERVER COMPONENT (défaut) — pas de 'use client'
// Fetching direct Supabase server-side, accès cookies/headers
import { createClient } from '@/lib/supabase/server'

export default async function TournamentPage({ params }) {
  const supabase = createClient()
  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', params.tournamentSlug)
    .single()
  return <TournamentView tournament={data} />
}

// ✅ CLIENT COMPONENT — interactivité, hooks, state
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
```

## Pattern Data Fetching (TanStack Query)

```typescript
// src/hooks/use-tournament.ts
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useTournament(tournamentId: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`*, entries:tournament_entries(*, player1:player_profiles!player1_id(*), player2:player_profiles!player2_id(*))`)
        .eq('id', tournamentId)
        .single()
      if (error) throw error
      return data
    },
  })
}

// Mutation avec optimistic update
export function useUpdateScore(matchId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (score: MatchScore) => { /* API call */ },
    onMutate: async (score) => {
      await queryClient.cancelQueries({ queryKey: ['match', matchId] })
      const previous = queryClient.getQueryData(['match', matchId])
      queryClient.setQueryData(['match', matchId], old => ({ ...old, score }))
      return { previous }
    },
    onError: (err, score, ctx) => {
      queryClient.setQueryData(['match', matchId], ctx?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['match', matchId] })
    }
  })
}
```

## Route Handlers (API)

```typescript
// app/api/tournaments/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const UpdateSchema = z.object({
  name: z.string().min(1).max(100),
  status: z.enum(['draft','registration','active','completed'])
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('tournaments')
      .update(parsed.data)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

## Composants MPL — Structure type

```typescript
// src/components/mpl/tournament/TournamentCard.tsx
import { type Tournament } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface TournamentCardProps {
  tournament: Tournament
  className?: string
  onSelect?: (id: string) => void
}

export function TournamentCard({ tournament, className, onSelect }: TournamentCardProps) {
  return (
    <div
      className={cn(
        'bg-court-card border border-border rounded-md p-4',
        'hover:border-border-gold transition-colors cursor-pointer',
        className
      )}
      onClick={() => onSelect?.(tournament.id)}
    >
      {/* contenu */}
    </div>
  )
}
```

## Zod Schemas — Validation

```typescript
// src/lib/validations/tournament.ts
import { z } from 'zod'
import { TOURNAMENT_CATEGORY, MATCH_FORMAT } from '@/lib/tournament/constants'

export const CreateTournamentSchema = z.object({
  name:         z.string().min(2).max(100),
  category:     z.enum(TOURNAMENT_CATEGORY),
  gender:       z.enum(['men','women','mixed']),
  start_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  venue:        z.string().optional(),
  nb_courts:    z.number().int().min(1).max(20).default(4),
  draw_size:    z.enum(['8','16','32']).transform(Number),
  nb_groups:    z.number().int().min(2).max(8).default(4),
  format_quali: z.enum(MATCH_FORMAT).default('FORMAT_D'),
  format_final: z.enum(MATCH_FORMAT).default('FORMAT_A'),
})

export type CreateTournamentInput = z.infer<typeof CreateTournamentSchema>
```

## Error Handling

```typescript
// Pattern standard : error boundary + toast
'use client'
import { useToast } from '@/hooks/use-toast'

export function TournamentForm() {
  const { toast } = useToast()
  const mutation = useCreateTournament()

  async function onSubmit(data: CreateTournamentInput) {
    try {
      await mutation.mutateAsync(data)
      toast({ title: 'Tournoi créé', variant: 'default' })
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: 'destructive'
      })
    }
  }
}
```

## Multi-tenant org context

```typescript
// src/hooks/use-org.ts — accès à l'organisation courante
'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

export function useOrg() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  return useQuery({
    queryKey: ['org', orgSlug],
    queryFn: () => fetchOrg(orgSlug),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
```

## Checklist composant

Avant de soumettre un composant :
- [ ] Props typées avec interface explicite (jamais `any`)
- [ ] `cn()` utilisé pour les classNames conditionnels
- [ ] Loading state géré (skeleton ou spinner)
- [ ] Error state géré
- [ ] Mobile-first (tailwind sm: md: lg:)
- [ ] Accessibilité : aria-labels sur éléments interactifs
- [ ] Moins de 200 lignes (sinon découper)
