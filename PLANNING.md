# PadelOS — Planning de Développement
## 10 Semaines · Phase 0 + Phase 1 MVP
> Prompts Claude Code exacts pour chaque session

---

## 🗓️ VUE D'ENSEMBLE

| Semaine | Phase | Focus | Livrable |
|---------|-------|-------|----------|
| S1 | Phase 0 | Setup + Architecture | Repo initialisé, Supabase local, design system |
| S2 | Phase 0 | Schema BDD complet + Auth | Migrations, RLS, login fonctionnel |
| S3 | Phase 1 | Tournament Engine — core | Création tournoi, groupes, draw |
| S4 | Phase 1 | Tournament Engine — draw | Bracket 32, seeding, codes matchs |
| S5 | Phase 1 | Live Scoring | Interface arbitre mobile, Realtime |
| S6 | Phase 1 | Rankings Engine | Algo FIP best-of-8, classements live |
| S7 | Phase 1 | Public Portal | Site tournoi public, SEO |
| S8 | Phase 1 | OBS Overlay | Scoreboard SSE, overlays HTML |
| S9 | Phase 1 | PDF Export + Polish | Draws PDF, corrections UX |
| S10 | Phase 1 | Billing + Launch | Stripe, onboarding, prod |

---

## SEMAINE 1 — Setup & Fondations

### Objectif
Repo initialisé, Supabase local qui tourne, design system MPL en place.

### Session 1.1 — Initialisation projet (2–3h)
```
Initialise le projet PadelOS selon la SPEC.md et le CLAUDE.md.

1. Crée le projet Next.js 15 avec TypeScript strict, Tailwind, App Router
2. Installe toutes les dépendances listées dans SPEC.md section 0.1
3. Configure shadcn/ui avec le thème dark
4. Crée tailwind.config.ts avec les tokens MPL (gold, court, border, fonts)
5. Initialise Supabase avec `supabase init` et configure supabase/config.toml
6. Crée la structure de dossiers src/ complète selon CLAUDE.md
7. Configure tsconfig.json avec paths alias @/*
8. Configure eslint avec règles strictes TypeScript
9. Crée .env.local.example avec toutes les variables nécessaires
10. Commit initial : "chore: initialize PadelOS Next.js 15 project"
```

### Session 1.2 — Design System (2h)
```
Mets en place le design system MPL dans le projet PadelOS.

1. Crée src/components/mpl/design-tokens.ts avec tous les tokens (couleurs, fonts, spacing)
2. Configure next/font pour charger Bebas Neue et Rajdhani (Google Fonts)
3. Crée app/globals.css avec les CSS variables MPL
4. Crée src/lib/utils.ts avec la fonction cn() (clsx + tailwind-merge)
5. Crée les composants de base MPL :
   - GoldDivider : ligne or décorative
   - SectionTitle : titre section avec style Bebas Neue
   - StatusBadge : badge coloré selon statut tournoi
   - CategoryBadge : badge M25/M500/M1000 avec couleur par tier
6. Crée src/components/mpl/layouts/DashboardLayout.tsx (sidebar + main)
7. Teste visuellement avec app/page.tsx (landing page temporaire)
8. Commit : "feat: add MPL design system and base components"
```

### Session 1.3 — Setup Supabase local (1h)
```
Configure Supabase local pour PadelOS.

1. Démarre supabase avec `supabase start` et vérifie que tout tourne
2. Crée src/lib/supabase/server.ts (createServerClient avec cookies Next.js)
3. Crée src/lib/supabase/client.ts (createBrowserClient)
4. Crée src/lib/supabase/admin.ts (service role, server-only)
5. Crée src/lib/supabase/middleware.ts (helper refresh session)
6. Crée middleware.ts à la racine pour protéger les routes dashboard
7. Teste la connexion Supabase avec un health check dans app/api/health/route.ts
8. Commit : "feat: configure Supabase clients and middleware"
```

---

## SEMAINE 2 — Schema BDD & Authentication

### Objectif
Toutes les tables Phase 1 créées avec RLS. Login/register fonctionnel.

### Session 2.1 — Migrations BDD Part 1 (3h)
```
Crée les migrations SQL pour les tables core de PadelOS.
Référence : SPEC.md sections MODULE 1 et MODULE 2.
Utilise le skill supabase-schema.

Crée dans supabase/migrations/ :
1. 20260101_organizations.sql — table organizations + org_members + RLS
2. 20260102_player_profiles.sql — table player_profiles + RLS
3. 20260103_tournaments.sql — table tournaments + tournament_entries + RLS
4. 20260104_qual_groups.sql — table qual_groups + matches + RLS
5. 20260105_live_scores.sql — table live_scores + activer Realtime
6. 20260106_rankings.sql — tables ranking_points + rankings_snapshots + RLS

Pour chaque table :
- UUID primary key, timestamps, contraintes CHECK explicites
- RLS activé + policies selon le rôle (lecture/écriture)
- Index sur org_id, tournament_id, user_id
- Commentaires SQL sur les colonnes importantes

Applique avec `supabase db reset` et vérifie 0 erreur.
Commit : "feat: create core database schema with RLS policies"
```

### Session 2.2 — Génération types + Seed (1h)
```
Génère les types TypeScript depuis le schema Supabase et crée les données de test.

1. Lance `npx supabase gen types typescript --local > src/types/database.ts`
2. Crée src/types/index.ts qui ré-exporte les types utilitaires :
   - Tournament, TournamentEntry, Match, PlayerProfile, Organization
   - Types dérivés : TournamentWithEntries, MatchWithEntries, etc.
3. Crée supabase/seed/01_organizations.sql :
   - Organisation MPL (slug: 'mpl', type: 'federation')
   - 2 clubs test (tamarin-club, rm-club)
4. Crée supabase/seed/02_players.sql :
   - 20 joueurs fictifs avec profils complets
   - Points de classement variés pour tester l'algo FIP
5. Crée npm script "db:seed" dans package.json
6. Commit : "feat: generate Supabase types and create seed data"
```

### Session 2.3 — Authentication (3h)
```
Implémente l'authentification complète pour PadelOS.
Utilise Supabase Auth avec magic link + OAuth Google.

1. Crée app/(auth)/login/page.tsx :
   - Formulaire email (magic link)
   - Bouton "Continuer avec Google" (OAuth)
   - Design MPL dark/gold
   - Validation Zod côté client
   
2. Crée app/(auth)/register/page.tsx :
   - Étape 1 : Email + nom
   - Étape 2 : Créer ou rejoindre une organisation
   - Étape 3 : Confirmation
   
3. Crée app/(auth)/callback/route.ts :
   - Exchange code pour session Supabase
   - Redirect vers dashboard après auth
   
4. Crée src/hooks/use-auth.ts :
   - useUser() — session courante
   - useSignOut() — déconnexion
   - useOrgMembership() — rôle dans l'org
   
5. Crée app/(dashboard)/layout.tsx :
   - Auth guard (redirect si non connecté)
   - Inject org context
   - Sidebar navigation MPL

6. Teste le flow complet : register → email → callback → dashboard
7. Commit : "feat: implement authentication with Supabase Auth"
```

---

## SEMAINE 3 — Tournament Engine (Core)

### Objectif
Créer un tournoi, ajouter des équipes, générer les groupes.

### Session 3.1 — Logique métier FIP (2h)
```
Implémente la logique métier tournament engine dans src/lib/tournament/.
Utilise le skill mpl-tournament-engine.

1. Crée src/lib/tournament/constants.ts :
   - TOURNAMENT_CATEGORY, MATCH_FORMAT, MATCH_ROUND enums
   - FORMAT_RULES avec toutes les règles par format
   - FIP_POINTS table complète M25→M1000
   - SEED_POSITIONS_32 array

2. Crée src/lib/tournament/draw-generator.ts :
   - snakeDistribute(items, nbGroups) — distribution équilibrée
   - generateGroups(entries, nbGroups) — groupes avec codes
   - generateRRMatchCodes(groupLabel, nbTeams) — codes matchs A1,A2...
   - generateBracket(seeds, drawSize, qualifiers) — bracket 32

3. Crée src/lib/tournament/rankings.ts :
   - calcGroupRanking(teams, results) — classement groupe FIP
   - tiebreak(a, b) — règles de départage

4. Crée src/lib/tournament/scoring.ts :
   - checkMatchComplete(score, format) — fin de match
   - determineWinner(score, e1Id, e2Id)
   - validateSuperTiebreak(score)

5. Crée src/lib/rankings/fip-calculator.ts :
   - calcFIPTotal(points) — best-of-8
   - getPointsForRound(category, round) — points FIP

6. Écris des tests unitaires complets dans src/lib/tournament/__tests__/
   Couvre : snake distribution, calcul ranking, tiebreak, fin de match
   
7. Lance vitest et vérifie 100% pass
8. Commit : "feat: implement FIP tournament engine core logic"
```

### Session 3.2 — CRUD Tournoi (3h)
```
Crée l'interface de gestion des tournois dans le dashboard.
Utilise les skills nextjs-conventions et mpl-tournament-engine.

1. Crée src/lib/validations/tournament.ts :
   - CreateTournamentSchema (Zod)
   - UpdateTournamentSchema
   - AddEntrySchema

2. Crée app/api/tournaments/route.ts :
   - GET : liste des tournois de l'org
   - POST : créer un tournoi (validation Zod + check plan Stripe)

3. Crée app/api/tournaments/[id]/route.ts :
   - GET : détail tournoi avec entries
   - PATCH : modifier tournoi
   - DELETE : supprimer (soft delete)

4. Crée src/hooks/use-tournaments.ts avec TanStack Query

5. Crée app/(dashboard)/[orgSlug]/tournaments/page.tsx :
   - Liste des tournois avec filtre statut
   - Card par tournoi (nom, date, catégorie, nb équipes, statut)
   - Bouton "Nouveau tournoi"

6. Crée app/(dashboard)/[orgSlug]/tournaments/new/page.tsx :
   - Formulaire en 3 étapes (React Hook Form)
   - Étape 1 : Infos générales (nom, catégorie, genre, dates, terrain)
   - Étape 2 : Format (nb courts, draw size, groupes, formats matchs)
   - Étape 3 : Confirmation + création
   - Validation temps réel avec Zod

7. Commit : "feat: tournament CRUD with multi-step form"
```

### Session 3.3 — Gestion des équipes (2h)
```
Ajoute la gestion des inscriptions et équipes dans un tournoi.

1. Crée app/(dashboard)/[orgSlug]/tournaments/[id]/page.tsx :
   - Overview tournoi (statut, dates, progression)
   - 4 onglets : Overview | Équipes | Groupes | Tableau
   
2. Crée app/(dashboard)/[orgSlug]/tournaments/[id]/entries/ :
   - Liste équipes inscrites avec seed et statut
   - Formulaire ajout équipe (2 joueurs, seed, direct entry toggle)
   - Drag & drop pour réordonner les seeds
   - Import CSV (optionnel, marquer TODO)

3. Crée app/api/tournaments/[id]/entries/route.ts :
   - GET, POST (ajouter équipe)
   - Validation : pas de doublon joueur dans le même tournoi

4. Bouton "Générer les groupes" (visible si status='registration' + min 4 équipes)
   - Appelle POST /api/tournaments/[id]/generate-groups
   - Utilise snakeDistribute de tournament-engine
   - Change status → 'active'

5. Commit : "feat: tournament entries management and group generation"
```

---

## SEMAINE 4 — Draw Principal

### Objectif
Bracket 32 généré automatiquement, visuel premium.

### Session 4.1 — API Draw Generation (2h)
```
Implémente l'API de génération du tableau principal.

1. Crée app/api/tournaments/[id]/generate-draw/route.ts :
   - POST : génère le bracket depuis seeds + qualifiers
   - Place les seeds aux positions SEED_POSITIONS_32
   - Place les qualifiers (QA, QB...) dans les slots restants
   - Insère les matchs en base (phase='main')
   - Retourne le bracket complet

2. Crée app/api/tournaments/[id]/bracket/route.ts :
   - GET : récupère le bracket actuel avec winners propagés
   
3. Crée src/lib/tournament/bracket-propagation.ts :
   - propagateWinner(matchId, winnerId) — avance le gagnant dans le tableau
   - getNextMatch(matchId) — trouve le prochain match
   
4. Commit : "feat: main draw generation with FIP seeding algorithm"
```

### Session 4.2 — Composant Bracket Visuel (3h)
```
Crée le composant visuel du tableau principal style MPL premium.
Utilise le skill nextjs-conventions et le design system MPL.

1. Crée src/components/mpl/tournament/BracketView.tsx :
   - Bracket symétrique gauche/droite pour 32 équipes
   - Connecteurs SVG entre les matchs
   - Couleurs : seed=or, qualifiés=bleu, BYE=grisé
   - Cases vides pour matchs futurs
   - Winner case finale avec animation
   - Responsive : scroll horizontal sur mobile

2. Crée src/components/mpl/tournament/BracketSlot.tsx :
   - Slot individuel (équipe + score si disponible)
   - Highlight si gagnant du match
   - Click → ouvre détail du match

3. Crée src/components/mpl/tournament/GroupsView.tsx :
   - 4 cartes groupe (A, B, C, D)
   - Tableau round-robin avec scores éditables (admin seulement)
   - Classement en temps réel avec tiebreak

4. Intègre dans app/(dashboard)/[orgSlug]/tournaments/[id]/page.tsx
   - Onglet "Tableau" → BracketView
   - Onglet "Groupes" → GroupsView

5. Commit : "feat: premium bracket and groups visual components"
```

---

## SEMAINE 5 — Live Scoring

### Objectif
Arbitre peut scorer un match depuis son téléphone en temps réel.

### Session 5.1 — Interface arbitre (3h)
```
Crée l'interface de scoring live pour les arbitres, mobile-first.
C'est la fonctionnalité terrain la plus critique du MVP.

1. Crée app/(dashboard)/[orgSlug]/referee/[matchId]/page.tsx :
   - Layout plein écran, fond sombre, grande typographie
   - ScoreBoard : score actuel (sets + super tiebreak)
   - 2 grands boutons + point (min 80px height, touch-friendly)
   - Bouton UNDO (annuler dernier point)
   - SetTracker : historique des sets
   - ServeIndicator : qui sert (toggle)
   - FormatBadge : rappel du format en cours
   - Alert automatique : super tiebreak si conditions remplies
   - Confirmation fin de match avec popup récap
   - NO BACK BUTTON sans confirmation

2. Crée src/hooks/use-live-scoring.ts :
   - useMatchScoring(matchId) — state local + sync Supabase
   - addPoint(player: 'e1'|'e2') — ajoute un point
   - undoLastPoint() — annule dernière action
   - subscribeToScore() — Supabase Realtime
   - Optimistic updates locaux, sync serveur

3. Crée app/api/tournaments/[id]/matches/[matchId]/score/route.ts :
   - PATCH : update score + validation règles FIP
   - Si match terminé → propagate winner dans bracket
   - RLS : referee seulement (ou club_admin)

4. Teste sur mobile (responsive, touch, etc.)
5. Commit : "feat: mobile referee scoring interface with live sync"
```

### Session 5.2 — Realtime broadcast (2h)
```
Implémente la diffusion temps réel des scores via Supabase Realtime.

1. Active Realtime sur la table live_scores dans Supabase
2. Crée src/hooks/use-realtime-match.ts :
   - Subscribe aux changements via supabase channel
   - Update TanStack Query cache automatiquement
   - Cleanup sur unmount

3. Crée src/components/mpl/scoring/LiveScoreCard.tsx :
   - Composant "spectateur" : affiche le score live
   - Badge LIVE animé si match en cours
   - Utilise useRealtimeMatch pour les updates

4. Intègre LiveScoreCard dans le portail public (Semaine 7)
   et dans le bracket (cases des matchs en cours)

5. Commit : "feat: Supabase Realtime score broadcast"
```

---

## SEMAINE 6 — Rankings Engine

### Objectif
Classements MPL calculés automatiquement après chaque tournoi.

### Session 6.1 — Calcul rankings (2h)
```
Implémente le moteur de classement FIP best-of-8.

1. Crée app/api/tournaments/[id]/finalize/route.ts :
   - POST : finalise le tournoi (status → 'completed')
   - Calcule les points FIP pour chaque équipe/joueur
   - Insère dans ranking_points
   - Déclenche recalcul snapshots classement

2. Crée src/lib/rankings/fip-calculator.ts :
   - calcFIPTotal(points) — best-of-8 avec filtre 52 semaines
   - getPointsForRound(category, round) — table FIP

3. Crée supabase/functions/recalc-rankings/index.ts :
   - Edge Function déclenchée après finalisation tournoi
   - Recalcule tous les rankings affectés
   - Met à jour rankings_snapshots
   - Met à jour player_profiles.ranking_pts

4. Commit : "feat: FIP rankings engine with best-of-8 calculation"
```

### Session 6.2 — UI Classements (2h)
```
Crée les pages de classement dans le dashboard et portail public.

1. Crée app/(dashboard)/[orgSlug]/rankings/page.tsx :
   - Tableau classement par catégorie
   - Filtre : catégorie, genre, date
   - Colonne : rang, joueur, points total, 8 meilleurs tournois
   - Click joueur → détail avec historique points
   
2. Crée src/components/mpl/rankings/RankingTable.tsx :
   - Tableau avec pagination (50 joueurs par page)
   - Médailles pour top 3 (or, argent, bronze)
   - Variation rang (↑↓ vs semaine précédente)

3. Crée app/(dashboard)/[orgSlug]/players/[playerId]/page.tsx :
   - Profil joueur complet
   - Historique tournois + points
   - Graphique progression classement (recharts)

4. Commit : "feat: rankings display with player profiles"
```

---

## SEMAINE 7 — Public Portal

### Objectif
N'importe qui peut suivre un tournoi sans compte.

### Session 7.1 — Site public tournoi (3h)
```
Crée le portail public de suivi de tournoi (sans authentification).

1. Crée app/t/[orgSlug]/[tournamentSlug]/layout.tsx :
   - Header public (logo org, nom tournoi, statut LIVE)
   - Nav : Overview | Groupes | Tableau | Planning | Résultats
   - Footer MPL

2. Crée app/t/[orgSlug]/[tournamentSlug]/page.tsx :
   - Card infos tournoi (dates, lieu, catégorie, nb équipes)
   - Classements groupes en cours (si phase qualification)
   - Prochains matchs (3 prochains)
   - Derniers résultats

3. Crée app/t/[orgSlug]/[tournamentSlug]/bracket/page.tsx :
   - BracketView en lecture seule
   - Scores en temps réel (useRealtimeMatch)
   - Badge LIVE sur matchs en cours

4. Crée app/t/[orgSlug]/[tournamentSlug]/schedule/page.tsx :
   - Planning par jour + court
   - Statuts matchs (pending / live / done)

5. generateMetadata() sur chaque page (SEO)
6. Commit : "feat: public tournament portal with live updates"
```

---

## SEMAINE 8 — OBS Overlay

### Objectif
Scoreboards et draws utilisables en broadcast direct dans OBS.

### Session 8.1 — API SSE + Overlays (3h)
```
Implémente les overlays OBS pour le broadcast.

1. Crée app/api/obs/[matchId]/score/route.ts :
   - GET : Server-Sent Events pour score temps réel
   - Subscribe Supabase Realtime → push SSE stream
   - Headers : Content-Type: text/event-stream

2. Crée public/obs/scoreboard.html :
   - Score match en cours (800×200px)
   - Design MPL premium (dark/gold)
   - Connecté via EventSource à /api/obs/[matchId]/score
   - Animation lors changement de score
   - Paramètre URL : ?matchId=xxx

3. Crée public/obs/bracket.html :
   - Draw 32 équipes (1920×1080)
   - Auto-refresh toutes les 30s
   - Style minimal, lisible en broadcast

4. Crée public/obs/lower-third.html :
   - Bannière joueurs (1920×200)
   - Nom équipe 1 vs équipe 2
   - Score actuel, format, round

5. Crée app/(dashboard)/[orgSlug]/tournaments/[id]/broadcast/page.tsx :
   - Dashboard OBS admin
   - Liste des URLs overlay à copier dans OBS
   - Preview des overlays
   - Sélecteur match actif

6. Commit : "feat: OBS broadcast overlays with SSE live updates"
```

---

## SEMAINE 9 — PDF Export & Polish

### Objectif
Exports PDF professionnels + corrections UX globales.

### Session 9.1 — PDF Export (2h)
```
Implémente les exports PDF pour les documents officiels MPL.

1. Install : npm install @react-pdf/renderer
2. Crée src/lib/pdf/tournament-draw.tsx :
   - Draw officiel (A4 paysage, style MPL dark/gold)
   - En-tête avec logos MPL + sponsor
   - Bracket complet avec noms équipes et scores
   - Footer avec date + numéro de page

3. Crée src/lib/pdf/results-sheet.tsx :
   - Feuille de résultats par groupe
   - Tableau avec scores de tous les matchs

4. Crée app/api/tournaments/[id]/export/draw/route.ts :
   - GET : génère et retourne le PDF
   - Cache 5 minutes (headers Cache-Control)

5. Crée app/api/tournaments/[id]/export/results/route.ts

6. Ajoute boutons "Exporter PDF" dans le dashboard tournoi

7. Commit : "feat: PDF export for official tournament documents"
```

### Session 9.2 — Polish & Bug Fix (2h)
```
Session de polish UX et corrections avant le billing.

1. Audit UX complet :
   - Teste tous les flows sur mobile (375px)
   - Vérifie les états loading/error sur chaque page
   - Ajoute skeletons manquants

2. Typecheck complet : `npm run typecheck` → 0 erreur
3. Lint : `npm run lint` → 0 warning
4. Tests : `npm run test` → 100% pass

5. Performance :
   - Lazy load composants lourds (BracketView, PDF)
   - Vérifier que les requêtes Supabase utilisent bien les index
   - Ajouter `loading.tsx` sur les routes lentes

6. Accessibilité :
   - aria-labels sur tous les boutons icon
   - Contraste couleurs (gold sur dark : ratio > 4.5)

7. Commit : "fix: UX polish, TypeScript strict, accessibility improvements"
```

---

## SEMAINE 10 — Billing & Launch

### Objectif
Stripe opérationnel, MPL onboardé, premier client payant.

### Session 10.1 — Stripe Integration (3h)
```
Implémente le système de billing avec Stripe.

1. Configure produits Stripe (Starter €29, Club Pro €89, Federation €299)

2. Crée app/api/billing/create-checkout/route.ts :
   - POST : crée session Stripe Checkout
   - Passe orgId en metadata
   - Retourne URL checkout

3. Crée app/api/webhooks/stripe/route.ts :
   - Écoute events : checkout.completed, subscription.updated, subscription.deleted
   - Met à jour table subscriptions en base
   - Vérifie signature webhook (STRIPE_WEBHOOK_SECRET)

4. Crée app/(dashboard)/[orgSlug]/settings/billing/page.tsx :
   - Plan actuel + date renouvellement
   - Bouton upgrade/downgrade
   - Historique factures (Stripe portal)

5. Crée src/hooks/use-subscription.ts :
   - Plan actuel
   - Limites selon plan (nb tournois, nb clubs)
   - canCreate(feature) — guard par plan

6. Ajoute guards dans les routes : check plan avant création tournoi

7. Commit : "feat: Stripe billing with plan enforcement"
```

### Session 10.2 — Onboarding MPL + Production (2h)
```
Deploy en production et onboarding du premier client MPL.

1. Deploy sur Vercel :
   - Configure variables d'environnement production
   - Configure domaine custom (padelOS.app ou padelleague.mu)
   - Vérifie toutes les env vars

2. Configure Supabase Cloud :
   - Applique toutes les migrations sur le projet production
   - Active Realtime sur live_scores
   - Configure auth providers (magic link + Google)

3. Crée le compte organisation MPL :
   - slug: 'mpl', type: 'federation'
   - Ajoute cbezandry@gmail.com et pascal@padelleague.mu comme super_admin
   - Configure les settings MPL (catégories, nb courts par défaut)

4. Seed données MPL :
   - Import les joueurs du classement MPL 2026
   - Import l'historique tournois M500 Tamarin (données référence)

5. Test end-to-end production :
   - Crée tournoi test → génère groupes → score 2 matchs → vérifie classement

6. README.md final avec setup en < 5 minutes
7. Commit final : "feat: production deployment and MPL onboarding"
```

---

## ⚡ PROMPTS BONUS — Sessions ponctuelles

### Débogage rapide
```
J'ai une erreur dans PadelOS : [COLLER L'ERREUR]
Contexte : [fichier/feature concernée]
Lis le CLAUDE.md pour les conventions du projet avant de corriger.
```

### Nouvelle feature urgente
```
Feature urgente pour PadelOS : [DESCRIPTION]
Contraintes : 
- Respecter le schema BDD existant (vérifier src/types/database.ts)
- Utiliser les skills mpl-tournament-engine et nextjs-conventions
- TypeScript strict, 0 any
- Tests unitaires si logique métier
Scope : [PÉRIMÈTRE EXACT]
```

### Review code
```
Fais une review du code suivant pour PadelOS.
Vérifie : TypeScript strict, conventions CLAUDE.md, sécurité RLS, performance, accessibilité.
[COLLER LE CODE]
```

### Refactoring
```
Refactor ce composant PadelOS (max 200 lignes, découper si besoin) :
[COLLER LE CODE]
Conserve exactement le même comportement.
```

---

## 📊 Métriques de succès MVP

| Métrique | Cible | Mesure |
|----------|-------|--------|
| TypeScript errors | 0 | `npm run typecheck` |
| Test coverage (logique métier) | > 80% | vitest coverage |
| Lighthouse performance | > 85 | Chrome DevTools |
| Lighthouse SEO | > 90 | Chrome DevTools |
| Setup local | < 5 min | Chrono README |
| Score live latence | < 500ms | DevTools Network |
| Tournoi créé end-to-end | < 3 min | User test MPL |
| Premier client payant | S10 | Stripe dashboard |
