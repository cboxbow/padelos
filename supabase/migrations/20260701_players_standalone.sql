-- Migration: allow player profiles without Supabase auth accounts
-- Joueurs non-inscrits (pas de compte PadelOS) peuvent être gérés par l'admin
--
-- La contrainte FK player_profiles.id → auth.users est supprimée.
-- Les politiques RLS existantes (id = auth.uid()) restent valides :
--   - Un joueur avec un compte peut toujours accéder à son profil
--   - Les admins org peuvent créer des profils "managed" (id = gen_random_uuid())

ALTER TABLE player_profiles
  DROP CONSTRAINT IF EXISTS player_profiles_id_fkey;

-- Nouvelle colonne pour distinguer les profils liés à un compte auth
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS auth_uid UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS is_managed BOOLEAN NOT NULL DEFAULT FALSE;

-- Pour les profils existants liés à auth.users : auth_uid = id
-- (à exécuter manuellement si des profils existent déjà)
-- UPDATE player_profiles SET auth_uid = id, is_managed = FALSE WHERE auth_uid IS NULL;

-- Index
CREATE INDEX IF NOT EXISTS idx_pp_auth_uid ON player_profiles(auth_uid) WHERE auth_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pp_org_active ON player_profiles(org_id, is_active);
