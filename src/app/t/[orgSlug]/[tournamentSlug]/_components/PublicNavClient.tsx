'use client'

import Link          from 'next/link'
import { usePathname } from 'next/navigation'
import { cn }        from '@/lib/utils'

interface NavLink {
  label: string
  href:  string
}

interface PublicNavClientProps {
  links: NavLink[]
}

export function PublicNavClient({ links }: PublicNavClientProps) {
  const pathname = usePathname()

  return (
    <nav className="-mb-px flex gap-0 overflow-x-auto">
      {links.map(link => {
        // Active: exact match or starts-with for sub-routes
        const isActive =
          pathname === link.href ||
          (link.href !== links[0]?.href && pathname.startsWith(link.href))

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'shrink-0 px-4 py-2.5 font-body text-sm font-medium tracking-wider uppercase',
              'border-b-2 transition-colors',
              isActive
                ? 'border-gold text-gold'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
