# PadelOS — SPEC.md
## Spécification Technique Complète · Phase 0 + Phase 1 MVP
> Document de référence pour Claude Code. Lire avant toute session de développement.

---

## PHASE 0 — Fondations (Semaines 1–2)

### 0.1 Setup Projet
```bash
# Initialisation
npx create-next-app@latest padelOS \
  --typescript --tailwind --eslint \
  --app --src-dir --import-alias "@/*"

# Dépendances core
npm install @supabase/supabase-js @supabase/ssr
npm install @tanstack/react-query zustand
npm install react-hook-form @hookform/resolvers zod
npm install stripe @stripe/stripe-js

# shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card dialog table badge
npx shadcn@latest add input select textarea form label
npx shadcn@latest add dropdown-menu avatar sheet tabs
npx shadcn@latest add toast sonner alert separator

# Dev tools
npm install -D vitest @testing-library/react @vitejs/plugin-react
npm install -D @types/node

# Supabase CLI
npm install -g supabase
supabase init
supabase start
```

### 0.2 Variables d'environnement
```env
# .env.local (ne jamais committer)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # Server-side uniquement
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

### 0.3 Tailwind Config MPL
```typescript
// tailwind.config.ts — design tokens obligatoires
theme: {
  extend: {
    colors: {
      gold: {
        DEFAULT: '#C9A84C',
        light: '#E8C96A',
        dim: '#8B6914',
        muted: 'rgba(201,168,76,0.15)',
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
    },
    fontFamily: {
      display: ['Bebas Neue', 'cursive'],
      body: ['Rajdhani', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },
  }
}
```

---

## PHASE 1 — MVP (Semaines 3–10)

### MODULE 1 — Authentication & Multi-Tenant (Sem. 3)

#### Schéma BDD
```sql
-- Organisations (fédérations, clubs)
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,         -- ex: "mpl", "tamarin-club"
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('federation','club','league')),
  logo_url    TEXT,
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Membres d'une organisation
CREATE TABLE org_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN (
                  'super_admin','federation_admin',
                  'club_admin','referee','player')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Profils joueurs
CREATE TABLE player_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  org_id       UUID REFERENCES organizations(id),
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  avatar_url   TEXT,
  nationality  TEXT DEFAULT 'MU',
  license_no   TEXT UNIQUE,
  license_exp  DATE,
  ranking_pts  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

#### RLS Policies obligatoires
```sql
-- organizations : visible par tous, modifiable par admins
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON organizations FOR SELECT USING (true);
CREATE POLICY "Admin write" ON organizations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = organizations.id
    AND user_id = auth.uid()
    AND role IN ('super_admin','federation_admin','club_admin')
  ));

-- org_members : visible par membres de l'org
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org member read" ON org_members FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  ));
```

#### Routes Next.js
```
app/
  (auth)/
    login/page.tsx          # Magic link + OAuth
    register/page.tsx       # Onboarding organisation
    callback/route.ts       # Supabase auth callback
  (dashboard)/
    layout.tsx              # Auth guard + org context
    [orgSlug]/
      layout.tsx            # Org sidebar + nav
      page.tsx              # Dashboard overview
```

#### Middleware auth
```typescript
// middleware.ts — protéger toutes les routes (dashboard)
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Vérifier session, rediriger vers /login si absent
  // Injecter org context depuis URL slug
}
export const config = { matcher: ['/(dashboard)/:path*'] }
```

---

### MODULE 2 — Tournament Engine (Sem. 4–5)

#### Schéma BDD
```sql
-- Tournois
CREATE TABLE tournaments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organizations(id),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  category      TEXT NOT NULL,   -- M25, M50, M100, M250, M500, M1000
  gender        TEXT NOT NULL CHECK (gender IN ('men','women','mixed')),
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','registration','active','completed','cancelled')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  venue         TEXT,
  nb_courts     INTEGER DEFAULT 4,
  draw_size     INTEGER DEFAULT 32,
  nb_groups     INTEGER DEFAULT 4,
  format_quali  TEXT DEFAULT 'FORMAT_D',
  format_main   TEXT DEFAULT 'FORMAT_C',
  format_semi   TEXT DEFAULT 'FORMAT_B',
  format_final  TEXT DEFAULT 'FORMAT_A',
  settings      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, slug)
);

-- Inscriptions
CREATE TABLE tournament_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  player1_id    UUID REFERENCES player_profiles(id),
  player2_id    UUID REFERENCES player_profiles(id),
  seed          INTEGER,
  is_direct     BOOLEAN DEFAULT FALSE,
  group_id      TEXT,              -- 'A','B','C','D'
  group_pos     INTEGER,
  status        TEXT DEFAULT 'registered'
                CHECK (status IN ('registered','confirmed','withdrawn','disqualified')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Groupes de qualification
CREATE TABLE qual_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  group_label   TEXT NOT NULL,     -- 'A','B','C','D'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Matchs
CREATE TABLE matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  phase         TEXT NOT NULL CHECK (phase IN ('qualification','main')),
  round         TEXT,              -- 'GROUP','R32','R16','QF','SF','F'
  match_code    TEXT,              -- 'A1','A2','QF1'...
  group_label   TEXT,
  entry1_id     UUID REFERENCES tournament_entries(id),
  entry2_id     UUID REFERENCES tournament_entries(id),
  court_no      INTEGER,
  scheduled_at  TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  status        TEXT DEFAULT 'pending'
                CHECK (status IN ('pending','in_progress','completed','walkover')),
  score         JSONB,             -- {"sets":[{"e1":6,"e2":4},...],"tb":{"e1":10,"e2":7}}
  winner_id     UUID REFERENCES tournament_entries(id),
  format        TEXT,              -- 'FORMAT_A','FORMAT_B','FORMAT_C','FORMAT_D'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### Fonctions métier à implémenter
```typescript
// src/lib/tournament/

// draw-generator.ts
export function generateGroups(entries: Entry[], nbGroups: number): Group[]
export function generateBracket(seeds: Entry[], drawSize: number, qualifiers: string[]): BracketSlot[]
export function generateMatchCodes(group: Group): Match[]

// seeding.ts
export function snakeDistribute(entries: Entry[], nbGroups: number): GroupAssignment[]
export const SEED_POSITIONS_32: number[] = [0,31,8,23,4,27,12,19,16,15,20,11,24,7,28,3,2,29,6,25,10,21,14,17,1,30,9,22,5,26,13,18]

// rankings.ts
export function calcGroupRanking(matches: Match[], entries: Entry[]): RankedEntry[]
export function tiebreak(a: RankedEntry, b: RankedEntry): number // 1) pts 2) diff jeux 3) jeux gagnés

// scoring.ts
export function isMatchComplete(score: Score, format: MatchFormat): boolean
export function determineWinner(score: Score, entry1Id: string, entry2Id: string): string
export function validateSuperTiebreak(score: TiebreakScore): boolean // first to 10, 2 pt écart
```

---

### MODULE 3 — Live Scoring (Sem. 5–6)

#### Schéma BDD
```sql
-- Score en temps réel (Supabase Realtime)
CREATE TABLE live_scores (
  match_id      UUID PRIMARY KEY REFERENCES matches(id),
  current_set   INTEGER DEFAULT 1,
  score         JSONB NOT NULL DEFAULT '{"sets":[],"serving":null}',
  last_point    TIMESTAMPTZ DEFAULT NOW(),
  referee_id    UUID REFERENCES auth.users(id)
);
-- Activer Realtime sur cette table dans Supabase Dashboard
```

#### Interface arbitre (mobile-first)
```
Route : /[orgSlug]/referee/[matchId]
Composants :
  - ScoreBoard : affichage score actuel
  - PointButton : bouton +1 point (grande zone tactile, min 80px)
  - SetScore : score du set en cours
  - UndoButton : annuler dernier point
  - MatchTimer : chrono du match
  - FormatIndicator : Format A/B/C/D avec règles
  - SuperTiebreakMode : activation automatique si conditions remplies
```

#### Broadcast Supabase Realtime
```typescript
// Hook scoring live
export function useMatchScoring(matchId: string) {
  // Subscribe à live_scores via Supabase Realtime
  // Optimistic updates locaux
  // Sync avec serveur toutes les actions
}

// Route API pour validation score
// POST /api/tournaments/[id]/matches/[matchId]/score
// Validation Zod + RLS (referee uniquement)
```

---

### MODULE 4 — Rankings Engine (Sem. 6–7)

#### Schéma BDD
```sql
-- Points par tournoi
CREATE TABLE ranking_points (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID REFERENCES player_profiles(id),
  tournament_id UUID REFERENCES tournaments(id),
  round_reached TEXT NOT NULL,    -- 'W','SF','QF','R16','R32','QG'
  points        INTEGER NOT NULL,
  earned_at     DATE NOT NULL,
  expires_at    DATE NOT NULL,    -- earned_at + 52 semaines
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, tournament_id)
);

-- Snapshot classements (calculé périodiquement)
CREATE TABLE rankings_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID REFERENCES player_profiles(id),
  org_id        UUID REFERENCES organizations(id),
  category      TEXT,
  rank          INTEGER,
  total_points  INTEGER,
  best_8_points INTEGER,          -- FIP : best of 8 tournaments
  as_of_date    DATE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### Algorithme FIP best-of-8
```typescript
// src/lib/rankings/fip-calculator.ts
export function calcFIPRanking(
  playerId: string,
  pointsHistory: RankingPoint[]
): FIPRankingResult {
  // 1. Filtrer points < 52 semaines
  // 2. Garder les 8 meilleurs scores
  // 3. Sommer les points
  // 4. Retourner total + liste des 8 tournois comptés
}

const FIP_POINTS: Record<string, Record<string, number>> = {
  M1000: { W:1000, SF:600, QF:300, R16:150, R32:75, QG:15 },
  M500:  { W:500,  SF:300, QF:150, R16:75,  R32:38, QG:8  },
  M250:  { W:250,  SF:150, QF:75,  R16:38,  R32:19, QG:4  },
  M100:  { W:100,  SF:60,  QF:30,  R16:15,  R32:8,  QG:2  },
  M50:   { W:50,   SF:30,  QF:15,  R16:8,   R32:4,  QG:1  },
  M25:   { W:25,   SF:15,  QF:8,   R16:4,   R32:2,  QG:0  },
}
```

---

### MODULE 5 — Public Portal (Sem. 7–8)

#### Routes publiques (no auth)
```
app/
  t/[orgSlug]/[tournamentSlug]/
    page.tsx              # Overview tournoi public
    groups/page.tsx       # Tableaux de qualification live
    bracket/page.tsx      # Draw principal live
    schedule/page.tsx     # Planning des matchs
    results/page.tsx      # Résultats finaux
```

#### SEO & Meta
```typescript
// Chaque page doit avoir generateMetadata()
export async function generateMetadata({ params }): Promise<Metadata> {
  return {
    title: `${tournament.name} | MPL`,
    description: `Suivez en direct le ${tournament.category}...`,
    openGraph: { images: [tournament.og_image_url] }
  }
}
```

---

### MODULE 6 — OBS Overlay (Sem. 8–9)

#### Endpoints API
```
GET  /api/obs/[matchId]/scoreboard     # Score temps réel (SSE)
GET  /api/obs/[tournamentId]/bracket   # Draw avec avancements
GET  /api/obs/[tournamentId]/schedule  # Planning courts
```

#### Overlay HTML (browser source OBS)
```
/obs/
  scoreboard.html        # Score match en cours (800x200)
  bracket.html           # Draw principal (1920x1080)
  schedule.html          # Planning courts (1920x400)
  lower-third.html       # Bannière joueurs (1920x200)
```

```typescript
// SSE endpoint pour updates temps réel
// app/api/obs/[matchId]/scoreboard/route.ts
export async function GET(req: Request, { params }) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // Subscribe Supabase Realtime → push SSE
    }
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  })
}
```

---

### MODULE 7 — PDF Export (Sem. 9)

#### Documents à générer
```typescript
// src/lib/pdf/

// tournament-draw.ts → Draw officiel du tournoi (A4 paysage)
export async function generateTournamentDraw(tournamentId: string): Promise<Buffer>

// results-sheet.ts → Feuille de résultats (A4 portrait)
export async function generateResultsSheet(tournamentId: string): Promise<Buffer>

// ranking-certificate.ts → Certificat de classement joueur
export async function generateRankingCertificate(playerId: string): Promise<Buffer>
```

Utiliser `@react-pdf/renderer` ou `puppeteer` (Vercel compatible).

---

### MODULE 8 — Billing (Sem. 10)

#### Plans Stripe Products
```typescript
const PLANS = {
  STARTER:    { priceId: 'price_...', amount: 2900,  currency: 'eur' }, // €29/mois
  CLUB_PRO:   { priceId: 'price_...', amount: 8900,  currency: 'eur' }, // €89/mois
  FEDERATION: { priceId: 'price_...', amount: 29900, currency: 'eur' }, // €299/mois
}
```

#### Schéma BDD
```sql
CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID REFERENCES organizations(id) UNIQUE,
  stripe_customer_id  TEXT UNIQUE,
  stripe_sub_id       TEXT UNIQUE,
  plan                TEXT NOT NULL DEFAULT 'STARTER',
  status              TEXT,         -- 'active','trialing','past_due','cancelled'
  current_period_end  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Checklist MVP (avant premier client payant)

### Fonctionnel
- [ ] Auth magic link fonctionnel
- [ ] Onboarding organisation (3 étapes max)
- [ ] Créer un tournoi end-to-end
- [ ] Générer groupes + draw automatiquement
- [ ] Score live depuis mobile (arbitre)
- [ ] Classements mis à jour automatiquement
- [ ] Portail public accessible sans compte
- [ ] Overlay OBS fonctionnel
- [ ] Export PDF draw officiel
- [ ] Paiement Stripe opérationnel

### Technique
- [ ] 0 erreur TypeScript (`npm run typecheck`)
- [ ] RLS activé sur toutes les tables
- [ ] Tests unitaires logique métier FIP (>80% coverage)
- [ ] Lighthouse score >85 (performance, SEO, a11y)
- [ ] Variables d'environnement documentées
- [ ] README avec setup local < 5 minutes

### Business
- [ ] MPL validé (1 tournoi réel testé)
- [ ] 2 clubs pilotes onboardés
- [ ] Pricing Stripe configuré
- [ ] Domaine + SSL production
