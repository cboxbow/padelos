-- ============================================================
-- Seed 02 : Player Profiles (10 joueurs fictifs MPL)
-- ============================================================
-- IMPORTANT : player_profiles.id est une FK vers auth.users(id).
-- Pour le seed, on désactive temporairement les FK constraints
-- puis on les réactive (opération safe en développement).
--
-- Exécuter APRÈS 01_organizations.sql via Supabase SQL Editor.
-- ============================================================

-- Désactivation temporaire des FK pour le seed
SET session_replication_role = replica;

-- UUIDs fixes joueurs (b0000000-0000-0000-0000-0000000000XX)
-- org_id = MPL (a0000000-0000-0000-0000-000000000001)
-- Points variés de 120 à 1480 pour tester l'algo best-of-8 FIP

INSERT INTO player_profiles (id, org_id, display_name, first_name, last_name, gender, nationality, ranking_points, is_active)
VALUES
  -- Hommes (M)
  ('b0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'Alexandre Moreau', 'Alexandre', 'Moreau', 'M', 'MU', 1480, true),

  ('b0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'Maxime Dupont', 'Maxime', 'Dupont', 'M', 'MU', 1250, true),

  ('b0000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000001',
   'Kevin Larose', 'Kevin', 'Larose', 'M', 'MU', 980, true),

  ('b0000000-0000-0000-0000-000000000004',
   'a0000000-0000-0000-0000-000000000001',
   'Thomas Rivière', 'Thomas', 'Rivière', 'M', 'MU', 760, true),

  ('b0000000-0000-0000-0000-000000000005',
   'a0000000-0000-0000-0000-000000000002',
   'Julien Bonnet', 'Julien', 'Bonnet', 'M', 'MU', 540, true),

  ('b0000000-0000-0000-0000-000000000006',
   'a0000000-0000-0000-0000-000000000002',
   'Nicolas Petit', 'Nicolas', 'Petit', 'M', 'MU', 320, true),

  -- Femmes (F)
  ('b0000000-0000-0000-0000-000000000007',
   'a0000000-0000-0000-0000-000000000001',
   'Sophie Laurent', 'Sophie', 'Laurent', 'F', 'MU', 1380, true),

  ('b0000000-0000-0000-0000-000000000008',
   'a0000000-0000-0000-0000-000000000001',
   'Camille Martin', 'Camille', 'Martin', 'F', 'MU', 1100, true),

  ('b0000000-0000-0000-0000-000000000009',
   'a0000000-0000-0000-0000-000000000003',
   'Léa Bernard', 'Léa', 'Bernard', 'F', 'MU', 680, true),

  ('b0000000-0000-0000-0000-000000000010',
   'a0000000-0000-0000-0000-000000000003',
   'Emma Girard', 'Emma', 'Girard', 'F', 'MU', 120, true)

ON CONFLICT (id) DO UPDATE SET
  display_name    = EXCLUDED.display_name,
  ranking_points  = EXCLUDED.ranking_points,
  is_active       = EXCLUDED.is_active;

-- Réactivation des FK
SET session_replication_role = DEFAULT;

-- ─── Vérification ──────────────────────────────────────────────────────────
-- SELECT display_name, gender, ranking_points
-- FROM player_profiles
-- ORDER BY ranking_points DESC;
