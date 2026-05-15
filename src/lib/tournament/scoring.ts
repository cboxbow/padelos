/**
 * MPL Scoring Engine — logique FIP par format de match.
 *
 * FORMAT_A : best-of-3 sets (6 jeux/set, TB régulier à 6-6), super TB remplace le 3ème set si 1-1
 * FORMAT_B : 2 sets (6 jeux/set, sans TB régulier), super TB si 1-1 sets
 * FORMAT_C : 1 set (6 jeux), super TB décisif si 6-6 dans le set
 * FORMAT_D : 1 set court, premier à 4 jeux (pas de tiebreak)
 * FORMAT_E : 1 tie-break à 10 points (super TB seul, pas de sets)
 *
 * Super TB : first to 10, min 2 pts d'écart, golden point à 10-10
 */

import type { MatchFormat } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SetScore {
  e1: number
  e2: number
  /** Tiebreak régulier 7 pts à l'intérieur d'un set (FORMAT_A à 6-6) */
  tb?: { e1: number; e2: number }
}

export interface MatchScore {
  sets:        SetScore[]
  superTb?:    { e1: number; e2: number }
  serving:     'e1' | 'e2' | null
  goldenPoint: boolean
}

export type MatchPlayer = 'e1' | 'e2'

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function initialScore(serving: MatchPlayer | null = null, format?: MatchFormat): MatchScore {
  // FORMAT_E : super TB seul, pas de sets
  if (format === 'FORMAT_E') {
    return { sets: [], superTb: { e1: 0, e2: 0 }, serving, goldenPoint: false }
  }
  return { sets: [{ e1: 0, e2: 0 }], serving, goldenPoint: false }
}

/** Jeux gagnés par chaque joueur par set */
export function setsWon(score: MatchScore): { e1: number; e2: number } {
  const acc = { e1: 0, e2: 0 }
  for (const set of score.sets) {
    const w = setWinner(set)
    if (w) acc[w]++
  }
  return acc
}

function setWinner(set: SetScore): MatchPlayer | null {
  const { e1, e2 } = set
  // Tiebreak interne (7-6 scenario, FORMAT_A)
  if (e1 === 6 && e2 === 6 && set.tb) {
    if (set.tb.e1 >= 7 && set.tb.e1 - set.tb.e2 >= 2) return 'e1'
    if (set.tb.e2 >= 7 && set.tb.e2 - set.tb.e1 >= 2) return 'e2'
    return null
  }
  if (e1 >= 6 && e1 - e2 >= 2) return 'e1'
  if (e2 >= 6 && e2 - e1 >= 2) return 'e2'
  if (e1 === 7 && e2 === 5)     return 'e1'
  if (e2 === 7 && e1 === 5)     return 'e2'
  return null
}

// ─── checkMatchComplete ───────────────────────────────────────────────────────

export function checkMatchComplete(score: MatchScore, format: MatchFormat): {
  complete: boolean
  winner:   MatchPlayer | null
} {
  // FORMAT_E : super TB seul — géré par le bloc superTb ci-dessous
  // (le score est initialisé avec superTb directement)

  // FORMAT_D : first to 4 games
  if (format === 'FORMAT_D') {
    const s = score.sets[0]
    if (!s) return { complete: false, winner: null }
    if (s.e1 >= 4) return { complete: true, winner: 'e1' }
    if (s.e2 >= 4) return { complete: true, winner: 'e2' }
    return { complete: false, winner: null }
  }

  // Super tiebreak en cours
  if (score.superTb) {
    const { e1, e2 } = score.superTb
    // Golden point at 10-10
    if (score.goldenPoint) {
      if (e1 > e2) return { complete: true, winner: 'e1' }
      if (e2 > e1) return { complete: true, winner: 'e2' }
    }
    if (e1 >= 10 && e1 - e2 >= 2) return { complete: true, winner: 'e1' }
    if (e2 >= 10 && e2 - e1 >= 2) return { complete: true, winner: 'e2' }
    return { complete: false, winner: null }
  }

  const sw = setsWon(score)

  // FORMAT_C : 1 set, super TB à 6-6
  if (format === 'FORMAT_C') {
    if (sw.e1 === 1) return { complete: true, winner: 'e1' }
    if (sw.e2 === 1) return { complete: true, winner: 'e2' }
    return { complete: false, winner: null }
  }

  // FORMAT_A / FORMAT_B : 2 sets, super TB si 1-1
  if (sw.e1 === 2) return { complete: true, winner: 'e1' }
  if (sw.e2 === 2) return { complete: true, winner: 'e2' }
  return { complete: false, winner: null }
}

// ─── needsSuperTiebreak ───────────────────────────────────────────────────────

/**
 * Entre-sets super TB (FORMAT_A/B) : true quand les deux joueurs sont à 1 set chacun.
 * FORMAT_C utilise needsSuperTiebreakC (déclenchement dans le set à 6-6).
 */
export function needsSuperTiebreak(score: MatchScore, format: MatchFormat): boolean {
  if (format === 'FORMAT_D' || format === 'FORMAT_C' || format === 'FORMAT_E') return false
  if (score.superTb) return false
  const sw = setsWon(score)
  return sw.e1 === 1 && sw.e2 === 1
}

/** FORMAT_C uniquement : super TB décisif si le set unique atteint 6-6. */
export function needsSuperTiebreakC(score: MatchScore, format: MatchFormat): boolean {
  if (format !== 'FORMAT_C') return false
  if (score.superTb) return false
  const cur = score.sets.at(-1)
  return !!cur && cur.e1 === 6 && cur.e2 === 6
}

/** FORMAT_A: does the current set need a regular tiebreak? (à 6-6) */
export function needsRegularTiebreak(score: MatchScore, format: MatchFormat): boolean {
  if (format !== 'FORMAT_A') return false
  const current = score.sets.at(-1)
  return !!current && current.e1 === 6 && current.e2 === 6 && !current.tb
}

// ─── addGame ──────────────────────────────────────────────────────────────────

/**
 * Ajoute un jeu au joueur indiqué.
 * Retourne un nouveau MatchScore (immutable).
 */
export function addGame(score: MatchScore, format: MatchFormat, player: MatchPlayer): MatchScore {
  // FORMAT_E / super TB actif → addSuperTbPoint
  if (score.superTb) return addSuperTbPoint(score, player)

  const sets   = score.sets.map(s => ({ ...s, tb: s.tb ? { ...s.tb } : undefined }))
  const last   = sets.at(-1)
  if (!last) return score

  // Tiebreak régulier FORMAT_A
  if (last.tb !== undefined) {
    const tb = { ...last.tb }
    tb[player]++
    if (tb[player] >= 7 && tb[player] - (player === 'e1' ? tb.e2 : tb.e1) >= 2) {
      last.tb = tb  // set terminé via tiebreak
    } else {
      last.tb = tb
    }
    sets[sets.length - 1] = { ...last, tb }
    return maybeAdvanceSet({ ...score, sets }, format)
  }

  // Jeu normal
  const updated = { ...last, [player]: last[player] + 1 }
  sets[sets.length - 1] = updated

  const next = { ...score, sets }

  // FORMAT_A : si 6-6, ouvrir tiebreak régulier
  if (needsRegularTiebreak(next, format)) {
    sets[sets.length - 1] = { ...updated, tb: { e1: 0, e2: 0 } }
    return { ...next, sets }
  }

  // FORMAT_C : si 6-6 dans le set unique, ouvrir super tiebreak décisif
  if (needsSuperTiebreakC(next, format)) {
    return { ...next, sets, superTb: { e1: 0, e2: 0 } }
  }

  return maybeAdvanceSet(next, format)
}

function maybeAdvanceSet(score: MatchScore, format: MatchFormat): MatchScore {
  const sets  = score.sets.map(s => ({ ...s, tb: s.tb ? { ...s.tb } : undefined }))
  const last  = sets.at(-1)!
  const w     = setWinner(last)
  if (!w) return { ...score, sets }

  // Set terminé — super TB si conditions remplies ?
  const check = needsSuperTiebreak({ ...score, sets }, format)
  if (check) {
    return { ...score, sets, superTb: { e1: 0, e2: 0 } }
  }

  const result = checkMatchComplete({ ...score, sets }, format)
  if (result.complete) return { ...score, sets }

  // Nouveau set
  return { ...score, sets: [...sets, { e1: 0, e2: 0 }] }
}

// ─── addSuperTbPoint ─────────────────────────────────────────────────────────

export function addSuperTbPoint(score: MatchScore, player: MatchPlayer): MatchScore {
  if (!score.superTb) return score
  const tb  = { ...score.superTb }
  tb[player]++
  // Golden point condition : 10-10 → next point wins
  const gp   = tb.e1 === 10 && tb.e2 === 10
  return { ...score, superTb: tb, goldenPoint: gp }
}

// ─── determineWinner ─────────────────────────────────────────────────────────

export function determineWinner(
  score:  MatchScore,
  format: MatchFormat,
  e1Id:   string,
  e2Id:   string,
): string | null {
  const { complete, winner } = checkMatchComplete(score, format)
  if (!complete || !winner) return null
  return winner === 'e1' ? e1Id : e2Id
}

// ─── scoreLabel ───────────────────────────────────────────────────────────────

/** Label lisible du score : "6-3, 4-6, 10-8" */
export function scoreLabel(score: MatchScore): string {
  const parts = score.sets
    .filter(s => s.e1 > 0 || s.e2 > 0)
    .map(s => {
      if (s.tb) return `7-6(${Math.min(s.tb.e1, s.tb.e2)})`
      return `${s.e1}-${s.e2}`
    })
  if (score.superTb) parts.push(`${score.superTb.e1}-${score.superTb.e2}`)
  return parts.join(', ')
}
