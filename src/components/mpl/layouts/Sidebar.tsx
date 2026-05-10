'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Trophy,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { GoldDivider } from '@/components/mpl/GoldDivider'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

function buildNavItems(orgSlug: string): NavItem[] {
  return [
    { label: 'Tableau de bord', href: `/${orgSlug}`,              icon: LayoutDashboard },
    { label: 'Tournois',        href: `/${orgSlug}/tournaments`,   icon: Trophy },
    { label: 'Joueurs',         href: `/${orgSlug}/players`,       icon: Users },
    { label: 'Classements',     href: `/${orgSlug}/rankings`,      icon: BarChart3 },
    { label: 'Paramètres',      href: `/${orgSlug}/settings`,      icon: Settings },
  ]
}

interface SidebarProps {
  orgSlug: string
  userEmail?: string
}

// ─── Contenu partagé desktop + mobile ────────────────────────────────────────

function SidebarContent({
  orgSlug,
  pathname,
  userEmail,
  onClose,
}: {
  orgSlug: string
  pathname: string
  userEmail?: string
  onClose?: () => void
}) {
  const navItems = buildNavItems(orgSlug)

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-gold">
          <span className="font-display text-sm font-bold text-black leading-none">P</span>
        </div>
        <span className="font-display text-xl tracking-widest text-gold uppercase">
          PadelOS
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Fermer le menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <GoldDivider className="mx-4" />

      {/* Org badge */}
      <div className="px-5 py-2">
        <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase">
          {orgSlug}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Navigation principale">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-body font-medium transition-colors',
                isActive
                  ? 'bg-gold/10 text-gold border border-gold/20'
                  : 'text-muted-foreground hover:bg-court-hover hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={cn('h-4 w-4 flex-shrink-0', isActive && 'text-gold')} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer user */}
      <GoldDivider className="mx-4" />
      <div className="flex items-center gap-3 px-4 py-4">
        <Avatar className="h-8 w-8 border border-border">
          <AvatarFallback className="bg-court-hover text-xs text-gold">
            {userEmail ? userEmail[0].toUpperCase() : '?'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-body text-foreground">
            {userEmail ?? 'Chargement…'}
          </p>
        </div>
        <button
          className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Se déconnecter"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function Sidebar({ orgSlug, userEmail }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* Desktop : sidebar fixe gauche */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-64 md:flex-col bg-court-panel border-r border-border z-30">
        <SidebarContent orgSlug={orgSlug} pathname={pathname} userEmail={userEmail} />
      </aside>

      {/* Mobile : barre du haut + Sheet */}
      <header className="fixed top-0 inset-x-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-court-panel/95 backdrop-blur-sm px-4 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-display text-lg tracking-widest text-gold uppercase">
          PadelOS
        </span>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-64 p-0 bg-court-panel border-r border-border"
          aria-label="Menu de navigation"
        >
          <SidebarContent
            orgSlug={orgSlug}
            pathname={pathname}
            userEmail={userEmail}
            onClose={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
