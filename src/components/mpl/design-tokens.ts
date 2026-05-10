/**
 * MPL Design Tokens — Source unique de vérité.
 * Toujours importer depuis ici, jamais hardcoder les valeurs.
 */

// ─── Palette ────────────────────────────────────────────────────────────────

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

// ─── Typographie ─────────────────────────────────────────────────────────────

export const FONTS = {
  display: 'var(--font-display)',  // Bebas Neue
  body: 'var(--font-body)',        // Rajdhani
  mono: 'var(--font-mono)',        // JetBrains Mono
} as const

// ─── Statuts tournoi ─────────────────────────────────────────────────────────

export const TOURNAMENT_STATUS_COLORS = {
  draft:        'text-muted-foreground bg-muted border border-border',
  registration: 'text-blue-300 bg-blue-950/60 border border-blue-800',
  active:       'text-gold bg-gold-muted border border-gold/30',
  completed:    'text-green-400 bg-green-950/60 border border-green-800',
  cancelled:    'text-red-400 bg-red-950/60 border border-red-800',
} as const

export const TOURNAMENT_STATUS_LABELS = {
  draft:        'Brouillon',
  registration: 'Inscriptions',
  active:       'En cours',
  completed:    'Terminé',
  cancelled:    'Annulé',
} as const

// ─── Catégories tournoi ──────────────────────────────────────────────────────

export const CATEGORY_TIER_COLORS = {
  // Masculin
  M25:        'text-slate-400  bg-slate-900/60  border border-slate-700',
  M50:        'text-slate-300  bg-slate-800/60  border border-slate-600',
  M100:       'text-cyan-400   bg-cyan-950/60   border border-cyan-800',
  M250:       'text-blue-400   bg-blue-950/60   border border-blue-800',
  M500:       'text-purple-400 bg-purple-950/60 border border-purple-800',
  M1000:      'text-gold bg-gold-muted border border-gold/40',
  // Féminin
  W25:        'text-slate-400  bg-slate-900/60  border border-slate-700',
  W50:        'text-slate-300  bg-slate-800/60  border border-slate-600',
  W100:       'text-pink-400   bg-pink-950/60   border border-pink-800',
  W250:       'text-pink-300   bg-pink-900/60   border border-pink-700',
  W500:       'text-rose-400   bg-rose-950/60   border border-rose-800',
  W1000:      'text-gold bg-gold-muted border border-gold/40',
  // Junior
  JUNIOR_U11: 'text-orange-400 bg-orange-950/60 border border-orange-800',
  JUNIOR_U13: 'text-orange-400 bg-orange-950/60 border border-orange-800',
  JUNIOR_U15: 'text-amber-400  bg-amber-950/60  border border-amber-800',
} as const

export const CATEGORY_LABELS = {
  M25:   'M25',   M50:  'M50',  M100:  'M100',  M250:  'M250',  M500:  'M500',  M1000:  'M1000',
  W25:   'W25',   W50:  'W50',  W100:  'W100',  W250:  'W250',  W500:  'W500',  W1000:  'W1000',
  JUNIOR_U11: 'U11', JUNIOR_U13: 'U13', JUNIOR_U15: 'U15',
} as const

export const CATEGORY_GENDER_ICON = {
  M25:   '♂', M50:   '♂', M100:   '♂', M250:   '♂', M500:   '♂', M1000:   '♂',
  W25:   '♀', W50:   '♀', W100:   '♀', W250:   '♀', W500:   '♀', W1000:   '♀',
  JUNIOR_U11: 'J', JUNIOR_U13: 'J', JUNIOR_U15: 'J',
} as const

// ─── Formats de match ────────────────────────────────────────────────────────

export const MATCH_FORMAT_LABELS = {
  FORMAT_A: 'Format A — 3 sets',
  FORMAT_B: 'Format B — 2 sets + super TB',
  FORMAT_C: 'Format C — 1 set + super TB',
  FORMAT_D: 'Format D — Set court (4 jeux)',
} as const

export const MATCH_FORMAT_SHORT = {
  FORMAT_A: '3 sets',
  FORMAT_B: '2+TB',
  FORMAT_C: '1+TB',
  FORMAT_D: '4 jeux',
} as const

// ─── Rôles ───────────────────────────────────────────────────────────────────

export const ROLE_LABELS = {
  super_admin:      'Super Admin',
  federation_admin: 'Admin Fédération',
  club_admin:       'Admin Club',
  referee:          'Arbitre',
  player:           'Joueur',
} as const

export const ROLE_COLORS = {
  super_admin:      'text-gold bg-gold-muted border border-gold/30',
  federation_admin: 'text-purple-300 bg-purple-950/60 border border-purple-700',
  club_admin:       'text-blue-300 bg-blue-950/60 border border-blue-700',
  referee:          'text-cyan-300 bg-cyan-950/60 border border-cyan-700',
  player:           'text-slate-300 bg-slate-800/60 border border-slate-600',
} as const

// ─── Navigation sidebar ──────────────────────────────────────────────────────

export const SIDEBAR_WIDTH = 'w-64' // 256px
export const SIDEBAR_WIDTH_PX = 256
