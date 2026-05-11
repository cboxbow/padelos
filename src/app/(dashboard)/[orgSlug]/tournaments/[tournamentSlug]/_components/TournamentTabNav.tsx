'use client'

import Link from 'next/link'
import { LayoutDashboard, Users, Grid3x3, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tab {
  key:   string
  label: string
  icon:  React.ComponentType<{ className?: string }>
  badge?: number
}

interface TournamentTabNavProps {
  orgSlug:        string
  tournamentSlug: string
  activeTab:      string
  entriesCount:   number
  groupsCount:    number
}

export function TournamentTabNav({
  orgSlug,
  tournamentSlug,
  activeTab,
  entriesCount,
  groupsCount,
}: TournamentTabNavProps) {
  const base = `/${orgSlug}/tournaments/${tournamentSlug}`

  const tabs: Tab[] = [
    { key: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
    { key: 'teams',    label: 'Équipes',         icon: Users,    badge: entriesCount || undefined },
    { key: 'groups',   label: 'Groupes',         icon: Grid3x3,  badge: groupsCount  || undefined },
    { key: 'draw',     label: 'Tableau',         icon: Trophy },
  ]

  return (
    <div className="flex gap-1 border-b border-border overflow-x-auto">
      {tabs.map(({ key, label, icon: Icon, badge }) => {
        const isActive = activeTab === key
        const href = key === 'overview' ? base : `${base}?tab=${key}`
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-xs font-body font-semibold tracking-wider uppercase whitespace-nowrap transition-colors',
              isActive
                ? 'text-gold border-b-2 border-gold -mb-px bg-gold/5'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {badge !== undefined && (
              <span className={cn(
                'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-mono',
                isActive ? 'bg-gold/20 text-gold' : 'bg-court-hover text-muted-foreground',
              )}>
                {badge}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
