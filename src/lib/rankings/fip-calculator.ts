/**
 * Calcul classement FIP — best-of-8 sur 52 semaines.
 * Points par catégorie et par tour selon le barème officiel FIP.
 */

import type { TournamentCategory, RankingRound } from '@/types'
import type { TableRow } from '@/types'

// ─── Table des points FIP ─────────────────────────────────────────────────────

export const FIP_POINTS: Partial<Record<TournamentCategory, Partial<Record<RankingRound, number>>>> = {
  M1000: { W: 1000, SF: 600, QF: 300, R16: 150, R32: 75,  QG: 15 },
  M500:  { W:  500, SF: 300, QF: 150, R16:  75, R32: 38,  QG:  8 },
  M250:  { W:  250, SF: 150, QF:  75, R16:  38, R32: 19,  QG:  4 },
  M100:  { W:  100, SF:  60, QF:  30, R16:  15, R32:  8,  QG:  2 },
  M50:   { W:   50, SF:  30, QF:  15, R16:   8, R32:  4,  QG:  1 },
  M25:   { W:   25, SF:  15, QF:   8, R16:   4, R32:  2,  QG:  0 },
  W1000: { W: 1000, SF: 600, QF: 300, R16: 150, R32: 75,  QG: 15 },
  W500:  { W:  500, SF: 300, QF: 150, R16:  75, R32: 38,  QG:  8 },
  W250:  { W:  250, SF: 150, QF:  75, R16:  38, R32: 19,  QG:  4 },
  W100:  { W:  100, SF:  60, QF:  30, R16:  15, R32:  8,  QG:  2 },
  W50:   { W:   50, SF:  30, QF:  15, R16:   8, R32:  4,  QG:  1 },
  W25:   { W:   25, SF:  15, QF:   8, R16:   4, R32:  2,  QG:  0 },
}

// ─── getPointsForRound ────────────────────────────────────────────────────────

/**
 * Retourne les points FIP pour une catégorie et un tour donné.
 * Retourne 0 si la catégorie n'a pas de barème (juniors).
 */
export function getPointsForRound(
  category: TournamentCategory,
  round:    RankingRound,
): number {
  return FIP_POINTS[category]?.[round] ?? 0
}

// ─── calcFIPTotal ─────────────────────────────────────────────────────────────

type RankingPointRow = Pick<
  TableRow<'ranking_points'>,
  'id' | 'points' | 'round' | 'tournament_date' | 'tournament_id'
>

export interface FIPResult {
  total:           number
  counted:         RankingPointRow[]   // Les 8 meilleurs
  dropped:         RankingPointRow[]   // Au-delà du top-8
  tournamentsCount: number
}

/**
 * Calcule le total FIP pour un joueur : best-of-8 sur 52 semaines.
 * Entrée : tous les ranking_points du joueur.
 */
export function calcFIPTotal(points: RankingPointRow[]): FIPResult {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)  // 52 semaines

  const valid = points
    .filter(p => new Date(p.tournament_date) >= cutoff)
    .sort((a, b) => b.points - a.points)  // desc

  const counted = valid.slice(0, 8)
  const dropped = valid.slice(8)

  return {
    total:            counted.reduce((sum, p) => sum + p.points, 0),
    counted,
    dropped,
    tournamentsCount: valid.length,
  }
}

// ─── matchPhaseToRound ────────────────────────────────────────────────────────

import type { MatchPhase } from '@/types'

/**
 * Convertit une phase de match en code de tour FIP pour les points.
 */
export function matchPhaseToRound(phase: MatchPhase): RankingRound | null {
  const map: Partial<Record<MatchPhase, RankingRound>> = {
    final:        'W',
    semi_final:   'SF',
    quarter_final:'QF',
    round_of_16:  'R16',
    round_of_32:  'R32',
    qualification:'QG',
  }
  return map[phase] ?? null
}
