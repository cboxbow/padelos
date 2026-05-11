/**
 * MPL Tournament Draw Generator
 * Logique métier FIP — distribution snake + codes matchs round-robin
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RRMatch {
  /** Code lisible ex. "A1", "B3" */
  code: string
  /** Index de l'équipe 1 dans le tableau du groupe (0-based) */
  team1Pos: number
  /** Index de l'équipe 2 dans le tableau du groupe (0-based) */
  team2Pos: number
}

// ─── snakeDistribute ─────────────────────────────────────────────────────────

/**
 * Distribue N éléments en G groupes de façon équilibrée (ordre serpent).
 *
 * Exemple 16 équipes / 4 groupes :
 *   Tour 0 (→) : A, B, C, D
 *   Tour 1 (←) : D, C, B, A
 *   Tour 2 (→) : A, B, C, D
 *   Tour 3 (←) : D, C, B, A
 *
 * Garantit un écart de ±1 entre groupes.
 */
export function snakeDistribute<T>(items: T[], nbGroups: number): T[][] {
  const groups: T[][] = Array.from({ length: nbGroups }, () => [])
  items.forEach((item, i) => {
    const round    = Math.floor(i / nbGroups)
    const pos      = i % nbGroups
    const groupIdx = round % 2 === 0 ? pos : nbGroups - 1 - pos
    groups[groupIdx].push(item)
  })
  return groups
}

// ─── generateRRMatchCodes ─────────────────────────────────────────────────────

/**
 * Génère les codes matchs round-robin pour un groupe.
 *
 * Groupe A, 4 équipes → 6 matchs A1…A6
 * Groupe D, 3 équipes → 3 matchs D1…D3
 *
 * Chaque paire (i,j) avec i < j est un match.
 */
export function generateRRMatchCodes(groupLabel: string, nbTeams: number): RRMatch[] {
  const matches: RRMatch[] = []
  let code = 1
  for (let i = 0; i < nbTeams; i++) {
    for (let j = i + 1; j < nbTeams; j++) {
      matches.push({ code: `${groupLabel}${code++}`, team1Pos: i, team2Pos: j })
    }
  }
  return matches
}

// ─── calcGroupCount ───────────────────────────────────────────────────────────

/**
 * Détermine le nombre de groupes selon le nombre de paires inscrites.
 *
 *  4 – 7  → 2 groupes
 *  8 – 11 → 2 groupes (groupes de 4-6)
 * 12 – 15 → 3 groupes
 * 16 – 23 → 4 groupes
 * 24 – 31 → 4 groupes (groupes de 6-8)
 * 32+     → 8 groupes
 */
export function calcGroupCount(nbEntries: number): number {
  if (nbEntries < 4)  return 0
  if (nbEntries < 8)  return 2
  if (nbEntries < 12) return 2
  if (nbEntries < 16) return 3
  if (nbEntries < 32) return 4
  return 8
}

/** Labels de groupes : A, B, C, D, E, F, G, H */
export const GROUP_LABELS = ['A','B','C','D','E','F','G','H'] as const
export type GroupLabel = typeof GROUP_LABELS[number]
