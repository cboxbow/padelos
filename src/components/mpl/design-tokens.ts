/**
 * MPL Design Tokens
 * Single source of truth — always import from here, never hardcode values.
 */

export const COLORS = {
  gold: {
    DEFAULT: '#C9A84C',
    light: '#E8C96A',
    dim: '#8B6914',
    muted: 'rgba(201,168,76,0.15)',
    border: 'rgba(201,168,76,0.3)',
  },
  court: {
    deep: '#080A0F',
    DEFAULT: '#0A0C12',
    card: '#0E1118',
    panel: '#131720',
    hover: '#1A2030',
  },
  border: {
    DEFAULT: '#1E2535',
    gold: 'rgba(201,168,76,0.3)',
  },
} as const

export const FONTS = {
  display: 'var(--font-display)',
  body: 'var(--font-body)',
  mono: 'var(--font-mono)',
} as const

export const TOURNAMENT_STATUS_COLORS: Record<string, string> = {
  draft: 'text-muted-foreground bg-muted',
  registration: 'text-blue-400 bg-blue-950',
  active: 'text-gold bg-gold-muted border border-gold/30',
  completed: 'text-green-400 bg-green-950',
  cancelled: 'text-red-400 bg-red-950',
}

export const CATEGORY_TIER_COLORS: Record<string, string> = {
  M25: 'text-slate-400 bg-slate-900',
  M50: 'text-slate-300 bg-slate-800',
  M100: 'text-cyan-400 bg-cyan-950',
  M250: 'text-blue-400 bg-blue-950',
  M500: 'text-purple-400 bg-purple-950',
  M1000: 'text-gold bg-gold-muted border border-gold/30',
  W25: 'text-slate-400 bg-slate-900',
  W50: 'text-slate-300 bg-slate-800',
  W100: 'text-pink-400 bg-pink-950',
  W250: 'text-pink-400 bg-pink-900',
  W500: 'text-rose-400 bg-rose-950',
  W1000: 'text-gold bg-gold-muted border border-gold/30',
  JUNIOR_U11: 'text-orange-400 bg-orange-950',
  JUNIOR_U13: 'text-orange-400 bg-orange-950',
  JUNIOR_U15: 'text-orange-400 bg-orange-950',
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  federation_admin: 'Admin Fédération',
  club_admin: 'Admin Club',
  referee: 'Arbitre',
  player: 'Joueur',
}
