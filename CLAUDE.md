# PadelOS — CLAUDE.md
> Lis ce fichier ENTIÈREMENT avant toute action. Il prime sur tout.

## 🎯 Ce que tu construis
**PadelOS** — Le système d'exploitation digital pour les compétitions padel.
Produit SaaS multi-tenant B2B ciblant fédérations et clubs padel.
Premier marché : Océan Indien + Afrique. Premier client : Mauritius Padel League (MPL).

## 🏗️ Stack technique (NON NÉGOCIABLE)
- **Frontend** : Next.js 15 App Router, TypeScript strict (`"strict": true`)
- **UI** : Tailwind CSS + shadcn/ui — tokens MPL dans `tailwind.config.ts`
- **Backend** : Supabase (PostgreSQL + Realtime + RLS + Auth)
- **State** : TanStack Query v5 pour server state, Zustand pour UI state
- **Forms** : React Hook Form + Zod
- **Mobile** : React Native (Expo) — repo séparé `/padelOS-mobile`
- **OBS** : API REST + SSE overlay HTML dans `/obs/`
- **Paiements** : Stripe
- **Deploy** : Vercel (frontend) + Supabase Cloud

## 📁 Structure du projet (respecter strictement)
```
src/
  app/                    # Next.js App Router pages
    (auth)/               # Routes non-authentifiées
    (dashboard)/          # Routes authentifiées
      [orgSlug]/          # Multi-tenant par organisation
        tournaments/
        players/
        rankings/
        settings/
    api/                  # Route handlers
      obs/                # OBS overlay endpoints
      webhooks/           # Stripe, external
  components/
    ui/                   # shadcn/ui components (NE PAS MODIFIER)
    mpl/                  # Composants MPL custom
      tournament/
      scoring/
      bracket/
      rankings/
    layouts/
  lib/
    supabase/             # Client, server, types générés
    tournament/           # Logique métier FIP (CRITIQUE)
    rankings/             # Algorithme best-of-8
    validations/          # Schémas Zod
  hooks/                  # Custom React hooks
  types/                  # Types TypeScript globaux
supabase/
  migrations/             # SQL migrations numérotées
  seed/                   # Données de test
  functions/              # Edge Functions
```

## 🎨 Design System MPL
```typescript
// Palette (tailwind.config.ts)
colors: {
  gold: { DEFAULT: '#C9A84C', light: '#E8C96A', dim: '#8B6914' },
  court: { DEFAULT: '#0A0C12', card: '#0E1118', panel: '#131720' },
  border: { DEFAULT: '#1E2535', gold: 'rgba(201,168,76,0.3)' }
}
// Fonts : Bebas Neue (display) + Rajdhani (body)
// Toujours importer depuis /components/mpl/design-tokens.ts
```

## ⚽ Logique métier FIP (CRITIQUE — ne jamais approximer)
```
Catégories : M25 | M50 | M100 | M250 | M500 | M1000
             JUNIOR_U11 | JUNIOR_U13 | JUNIOR_U15
             W25 | W50 | W100 | W250 | W500 | W1000

Formats de matchs :
  Format A : 3 sets (6/6/6) — super tiebreak si 1-1
  Format B : 2 sets + super tiebreak si 1-1
  Format C : 1 set + super tiebreak si 6-6
  Format D : 1 set court (first to 4 games)

Seeding draw 32 : positions [0,31,8,23,4,27,12,19,16,15,...]
Rankings : best-of-8 FIP — meilleurs 8 résultats sur 52 semaines
Points par round : W=100,SF=60,QF=30,R16=15,R32=8,R64=4,QG=2

Tiebreak qualification groupes : 1) Points 2) Diff jeux 3) Jeux gagnés
Super tiebreak : first to 10, 2 points d'écart, golden point à 10-10
```

## 🔐 Sécurité (INVIOLABLE)
- **JAMAIS** de clé API dans le code — toujours `.env.local` / Vercel env vars
- **TOUJOURS** RLS activé sur toutes les tables Supabase
- **TOUJOURS** valider côté serveur avec Zod (même si validé côté client)
- Utiliser `createServerClient` pour les Server Components, `createBrowserClient` pour Client Components
- RBAC : `super_admin` > `federation_admin` > `club_admin` > `referee` > `player`

## 📧 Emails super admin autorisés (MPL)
- pascal@padelleague.mu
- cbezandry@gmail.com

## 🚫 Ce que tu NE FAIS PAS
- Utiliser `any` en TypeScript — toujours typer explicitement
- Modifier les fichiers dans `components/ui/` (shadcn/ui)
- Écrire des migrations SQL manuellement sans numérotation `YYYYMMDD_description.sql`
- Utiliser `useEffect` pour fetcher des données — utiliser TanStack Query
- Bypasser RLS avec le service role key côté client
- Créer des composants > 200 lignes — découper
- Committer sans message conventionnel (`feat:`, `fix:`, `chore:`, etc.)

## ✅ Conventions de code
```typescript
// Nommage
PascalCase    → Composants, Types, Interfaces
camelCase     → Fonctions, variables, hooks
SCREAMING     → Constantes, enums
kebab-case    → fichiers, dossiers, routes

// Exports : named exports toujours (sauf pages Next.js)
export function TournamentBracket() {} // ✅
export default function TournamentBracket() {} // ❌ (sauf app/page.tsx)

// Types DB : générer depuis Supabase, jamais écrire manuellement
// npx supabase gen types typescript --local > src/types/database.ts
```

## 🧪 Tests & validation
```bash
# Avant chaque commit
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest

# Validation Supabase
npx supabase db lint
npx supabase db reset --local && npm run db:seed
```

## 🔧 Commandes utiles
```bash
npm run dev              # Dev server
npm run db:migrate       # Apply migrations
npm run db:seed          # Seed test data
npm run db:types         # Regénérer types Supabase
npm run build            # Build production
npx supabase start       # Supabase local
npx supabase stop        # Arrêter Supabase local
```

## 📦 Skills disponibles
- `supabase-schema` → architecture BDD, RLS, migrations
- `mpl-tournament-engine` → logique métier FIP, draw, groupes, scoring
- `nextjs-conventions` → patterns Next.js 15 App Router pour ce projet

## 🔗 Références
- Rapport d'expertise : `/docs/MPL_Rapport_Expertise.md`
- Spec MVP : `/docs/SPEC.md`
- Prototype HTML référence : `/docs/prototype/mpl_tournament_system.html`
- Design tokens : `/src/components/mpl/design-tokens.ts`
