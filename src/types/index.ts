/**
 * Global TypeScript types for PadelOS.
 *
 * Stratégie :
 *  - Les types primitifs (unions de CHECK constraints) viennent de database.ts
 *    pour garantir la cohérence avec le schéma Supabase.
 *  - Ce fichier ajoute les types dérivés (JOINs, compound, UI) non présents en DB.
 *  - Les deux fichiers sont complémentaires — importer depuis '@/types' suffit.
 */

// ─── Re-exports depuis database.ts ────────────────────────────────────────────
// Utiliser ces types dans toute l'app pour rester synchronisé avec la DB.

export type {
  // Union types (CHECK constraints)
  OrgType,
  UserRole,
  TournamentCategory,
  TournamentStatus,
  MatchFormat,
  EntryStatus,
  MatchPhase,
  MatchStatus,
  RankingRound,
  PlayerGender,
  ServingSide,
  QualGroupPhase,

  // Row types (résultat d'un SELECT *)
  Organization,
  OrgMember,
  PlayerProfile,
  Tournament,
  TournamentEntry,
  QualGroup,
  QualGroupEntry,
  Match,
  LiveScore,
  RankingPoint,
  RankingsSnapshot,

  // Helpers génériques
  TableRow,
  TableInsert,
  TableUpdate,

  // Type DB complet (pour createClient<Database>)
  Database,
  Json,
} from './database'

// ─── Types dérivés (JOINs fréquents) ─────────────────────────────────────────

import type {
  Tournament,
  TournamentEntry,
  Match,
  PlayerProfile,
  Organization,
  OrgMember,
  QualGroup,
  QualGroupEntry,
  LiveScore,
  RankingsSnapshot,
  TournamentCategory,
  RankingRound,
} from './database'

/** Tournoi avec ses inscriptions chargées */
export interface TournamentWithEntries extends Tournament {
  entries: TournamentEntry[]
}

/** Tournoi avec ses matchs chargés */
export interface TournamentWithMatches extends Tournament {
  matches: Match[]
}

/** Paire inscrite avec les deux profils joueurs */
export interface EntryWithPlayers extends TournamentEntry {
  player1: PlayerProfile
  player2: PlayerProfile
}

/** Match avec les deux paires et les joueurs */
export interface MatchWithEntries extends Match {
  entry1: EntryWithPlayers | null
  entry2: EntryWithPlayers | null
}

/** Match en cours avec le score live */
export interface LiveMatch extends MatchWithEntries {
  live_score: LiveScore | null
}

/** Poule avec ses entrées et classement */
export interface GroupWithStandings extends QualGroup {
  entries: Array<QualGroupEntry & { entry: EntryWithPlayers }>
}

/** Joueur classé (snapshot + profil) */
export interface RankedPlayer extends RankingsSnapshot {
  player: PlayerProfile
}

/** Membre d'une org avec son profil */
export interface OrgMemberWithProfile extends OrgMember {
  profile: PlayerProfile | null
}

/** Organisation avec ses membres */
export interface OrganizationWithMembers extends Organization {
  members: OrgMemberWithProfile[]
}

// ─── Score structures (logique métier FIP) ───────────────────────────────────

export interface SetScore {
  e1: number
  e2: number
}

export interface TiebreakScore {
  e1: number
  e2: number
}

/**
 * Forme exacte du champ JSONB `matches.score`.
 * Format A/B : sets + super tiebreak optionnel
 * Format C/D : set unique
 */
export interface MatchScore {
  sets: SetScore[]
  tb?: TiebreakScore   // super tiebreak (first to 10)
  serving?: 'e1' | 'e2' | null
}

// ─── Ranking FIP ─────────────────────────────────────────────────────────────

/** Résultat du calcul best-of-8 pour un joueur */
export interface FIPRankingResult {
  playerId: string
  category: TournamentCategory
  totalPoints: number      // somme des 8 meilleurs
  best8: Array<{
    tournamentId: string
    tournamentName: string
    round: RankingRound
    points: number
    date: string
  }>
  tournamentsCount: number
}

// ─── Subscription ────────────────────────────────────────────────────────────

export type SubscriptionPlan = 'STARTER' | 'CLUB_PRO' | 'FEDERATION'

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'cancelled'

// ─── API Responses ───────────────────────────────────────────────────────────

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export interface ApiSuccess<T> {
  data: T
  message?: string
}

export type ApiResponse<T> = ApiSuccess<T> | { error: ApiError }

// ─── UI ──────────────────────────────────────────────────────────────────────

export interface NavItem {
  label: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: string | number
  exact?: boolean
}

/** Pagination standard */
export interface PaginationParams {
  page: number
  perPage: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}
