---
name: mpl-tournament-engine
description: Logique métier complète FIP/MPL pour PadelOS. Utiliser pour implémenter la génération de draws, les groupes de qualification, le calcul de classements, le scoring live, ou toute règle compétitive padel. Déclencher quand l'utilisateur mentionne "draw", "bracket", "groupe", "seeding", "score", "format", "classement", "FIP", "MPL", "qualification", "super tiebreak", ou travaille sur la logique tournoi.
---

# MPL Tournament Engine — Logique Métier FIP

## Catégories (enums TypeScript)

```typescript
export const TOURNAMENT_CATEGORY = [
  'M25','M50','M100','M250','M500','M1000',
  'W25','W50','W100','W250','W500','W1000',
  'JUNIOR_U11','JUNIOR_U13','JUNIOR_U15'
] as const
export type TournamentCategory = typeof TOURNAMENT_CATEGORY[number]

export const MATCH_FORMAT = ['FORMAT_A','FORMAT_B','FORMAT_C','FORMAT_D'] as const
export type MatchFormat = typeof MATCH_FORMAT[number]

export const MATCH_ROUND = ['GROUP','R64','R32','R16','QF','SF','F'] as const
```

## Formats de match

```typescript
export const FORMAT_RULES: Record<MatchFormat, FormatRule> = {
  FORMAT_A: { sets: 3, gamesPerSet: 6, tiebreakAt: '6-6', superTB: true,  desc: '3 sets' },
  FORMAT_B: { sets: 2, gamesPerSet: 6, tiebreakAt: '1-1', superTB: true,  desc: '2 sets + TB' },
  FORMAT_C: { sets: 1, gamesPerSet: 6, tiebreakAt: '6-6', superTB: true,  desc: '1 set + TB' },
  FORMAT_D: { sets: 1, gamesPerSet: 4, tiebreakAt: null,  superTB: false, desc: '1 set court (first to 4)' },
}
// Super tiebreak : first to 10 points, 2 pts d'écart minimum, golden point à 10-10
```

## Points FIP par catégorie

```typescript
export const FIP_POINTS: Record<string, Record<string, number>> = {
  M1000: { F:1000, SF:600,  QF:300, R16:150, R32:75,  QG:15 },
  M500:  { F:500,  SF:300,  QF:150, R16:75,  R32:38,  QG:8  },
  M250:  { F:250,  SF:150,  QF:75,  R16:38,  R32:19,  QG:4  },
  M100:  { F:100,  SF:60,   QF:30,  R16:15,  R32:8,   QG:2  },
  M50:   { F:50,   SF:30,   QF:15,  R16:8,   R32:4,   QG:1  },
  M25:   { F:25,   SF:15,   QF:8,   R16:4,   R32:2,   QG:0  },
}
```

## Distribution Snake (équilibrage groupes)

```typescript
// Distribuer N équipes en G groupes de façon équilibrée
// ex : 16 équipes, 4 groupes → snake [A,B,C,D,D,C,B,A,A,B,C,D...]
export function snakeDistribute<T>(items: T[], nbGroups: number): T[][] {
  const groups: T[][] = Array.from({ length: nbGroups }, () => [])
  items.forEach((item, i) => {
    const round = Math.floor(i / nbGroups)
    const pos = i % nbGroups
    const groupIdx = round % 2 === 0 ? pos : (nbGroups - 1 - pos)
    groups[groupIdx].push(item)
  })
  return groups
}
```

## Positions seeds draw 32

```typescript
// Positions standard pour un draw 32 (FIP-compliant)
export const SEED_POSITIONS_32 = [
  0,  31, // Seeds 1,2 — quarts de tableau opposés
  8,  23, // Seeds 3,4
  4,  27, // Seeds 5,6 (non gardées)
  12, 19, // Seeds 7,8
  16, 15, 20, 11, 24, 7, 28, 3, // Seeds 9–16
  2,  29, 6,  25, 10, 21, 14, 17, // Seeds 17–24
  1,  30, 9,  22, 5,  26, 13, 18  // Seeds 25–32
]
```

## Génération codes matchs Round Robin

```typescript
// Groupe A avec 4 équipes → 6 matchs : A1...A6
// Méthode round-robin : chaque paire (i,j) avec i<j
export function generateRRMatchCodes(groupLabel: string, nbTeams: number): RRMatch[] {
  const matches: RRMatch[] = []
  let code = 1
  for (let i = 0; i < nbTeams; i++) {
    for (let j = i + 1; j < nbTeams; j++) {
      matches.push({
        code: `${groupLabel}${code++}`,
        team1Pos: i,
        team2Pos: j
      })
    }
  }
  return matches
  // 4 équipes : 6 matchs (A1–A6)
  // 3 équipes : 3 matchs (D1–D3)
}
```

## Classement groupe (tiebreak FIP)

```typescript
export function calcGroupRanking(
  teams: TeamEntry[],
  results: MatchResult[]
): RankedTeam[] {
  // 1. Calculer points (victoire=2, nul=1, défaite=0)
  // 2. Calculer différence de jeux
  // 3. Calculer jeux gagnés total
  // Sort : 1) pts desc 2) diff jeux desc 3) jeux gagnés desc
  // En cas d'égalité 3 équipes : résultat direct entre elles
}
```

## Score live — structure JSON

```typescript
// Structure du champ score dans la table matches
interface MatchScore {
  sets: Array<{
    e1: number  // games entry1
    e2: number  // games entry2
    tb?: { e1: number; e2: number }  // tiebreak standard (7 pts)
  }>
  superTb?: {
    e1: number  // points super tiebreak
    e2: number
  }
  serving: 'e1' | 'e2' | null
  goldenPoint: boolean
}

// Exemple score Format B (2 sets + super TB) : 6-4, 3-6, 10-8
// { sets:[{e1:6,e2:4},{e1:3,e2:6}], superTb:{e1:10,e2:8}, serving:'e2', goldenPoint:false }
```

## Vérification fin de match

```typescript
export function checkMatchComplete(score: MatchScore, format: MatchFormat): {
  complete: boolean
  winnerId?: 'e1' | 'e2'
} {
  // FORMAT_D : premier à 4 jeux
  // FORMAT_C : 1 set, si 6-6 → super tiebreak
  // FORMAT_B : 2 sets, si 1-1 → super tiebreak
  // FORMAT_A : 3 sets, si 1-1 → 3ème set normal, si 1-1 en 3ème à 6-6 → super tiebreak
}
```

## Rankings FIP best-of-8

```typescript
export function calcFIPTotal(points: RankingPoint[]): {
  total: number
  counted: RankingPoint[]  // Les 8 meilleurs
  dropped: RankingPoint[]
} {
  const valid = points
    .filter(p => isWithin52Weeks(p.earned_at))
    .sort((a, b) => b.points - a.points)
  const counted = valid.slice(0, 8)
  return {
    total: counted.reduce((s, p) => s + p.points, 0),
    counted,
    dropped: valid.slice(8)
  }
}
```

## Règles métier importantes

- Un joueur ne peut pas être dans 2 équipes du même tournoi
- Les têtes de série (direct entries) ne jouent pas les qualifications
- En qualification : TOP 1 de chaque groupe → tableau principal (défaut)
- Les BYE sont distribués du côté opposé aux têtes de série
- Le tirage au sort des qualifiés (QA, QB...) dans le tableau est aléatoire sauf contraintes
- Le super tiebreak remplace le 3ème set en FORMAT_A (jamais un 3ème set complet en padel MPL)
