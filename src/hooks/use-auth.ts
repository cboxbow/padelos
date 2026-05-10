'use client'

import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { UserRole, TableRow } from '@/types'

// Sous-types des requêtes (pour contourner l'inférence Supabase sur les selects partiels)
type OrgQueryRow    = Pick<TableRow<'organizations'>, 'id' | 'name'>
type MemberQueryRow = Pick<TableRow<'org_members'>, 'role'>

// ─── Keys ────────────────────────────────────────────────────────────────────

const AUTH_KEYS = {
  user:          ['auth', 'user'] as const,
  membership:    (orgSlug: string) => ['auth', 'membership', orgSlug] as const,
}

// ─── useUser ─────────────────────────────────────────────────────────────────

/**
 * Retourne l'utilisateur Supabase Auth courant.
 * Utilise getUser() (vérifié côté serveur) pour éviter les faux positifs JWT.
 */
export function useUser() {
  return useQuery({
    queryKey: AUTH_KEYS.user,
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user
    },
    staleTime: 60_000,   // 1 minute
    retry: false,
  })
}

// ─── useSignOut ───────────────────────────────────────────────────────────────

/**
 * Déconnecte l'utilisateur, vide le cache TanStack Query et redirige vers /login.
 */
export function useSignOut() {
  const router      = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.clear()
      router.push('/login')
      router.refresh()
    },
  })
}

// ─── useOrgMembership ────────────────────────────────────────────────────────

interface OrgMembership {
  orgId:   string
  orgName: string
  role:    UserRole
}

/**
 * Retourne le rôle de l'utilisateur courant dans l'organisation donnée (par slug).
 * Retourne `null` si l'utilisateur n'est pas membre.
 */
export function useOrgMembership(orgSlug: string) {
  return useQuery({
    queryKey: AUTH_KEYS.membership(orgSlug),
    queryFn: async (): Promise<OrgMembership | null> => {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      // 1. Trouver l'org par slug (cast explicite : inférence Supabase sur selects partiels)
      const orgResult = await supabase
        .from('organizations')
        .select('id, name')
        .eq('slug', orgSlug)
        .maybeSingle()

      const org = orgResult.data as OrgQueryRow | null
      if (!org) return null

      // 2. Vérifier la membership
      const memberResult = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', org.id)
        .eq('user_id', user.id)
        .maybeSingle()

      const member = memberResult.data as MemberQueryRow | null
      if (!member) return null

      return {
        orgId:   org.id,
        orgName: org.name,
        role:    member.role as UserRole,
      }
    },
    enabled: !!orgSlug,
    staleTime: 5 * 60_000,   // 5 minutes
    retry: false,
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Vérifie si un rôle a les droits d'administration */
export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === 'super_admin' || role === 'federation_admin' || role === 'club_admin'
}

/** Vérifie si un rôle peut saisir des scores */
export function canScoreMatch(role: UserRole | null | undefined): boolean {
  return isAdmin(role) || role === 'referee'
}
