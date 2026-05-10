'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from '@/components/ui/sonner'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Garder les données fraîches 30 secondes avant de re-fetcher
        staleTime: 30 * 1000,
        // Retry 1 fois sur erreur réseau
        retry: 1,
        // Ne pas re-fetcher au focus de la fenêtre (UX stable en dev)
        refetchOnWindowFocus: process.env.NODE_ENV === 'production',
      },
      mutations: {
        // Retry 0 fois pour les mutations (feedback immédiat)
        retry: 0,
      },
    },
  })
}

// Singleton côté browser (évite de recréer un QueryClient à chaque render RSC)
let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server : toujours un nouveau QueryClient
    return makeQueryClient()
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  return browserQueryClient
}

interface ProvidersProps {
  children: React.ReactNode
}

/**
 * Fournisseurs globaux côté client :
 * - TanStack Query (server state)
 * - Sonner (notifications toast)
 * - ReactQueryDevtools (dev uniquement)
 */
export function Providers({ children }: ProvidersProps) {
  // useState garantit que le QueryClient n'est pas recréé entre les renders
  const [queryClient] = useState(() => getQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          classNames: {
            toast: 'bg-court-card border border-border font-body',
            title: 'text-foreground font-semibold',
            description: 'text-muted-foreground',
            success: 'border-green-800',
            error: 'border-red-800',
          },
        }}
      />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
