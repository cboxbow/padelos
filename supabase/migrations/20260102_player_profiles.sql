-- ============================================================
-- Migration 002 : Player Profiles
-- ============================================================
-- Contenu :
--   1. Table player_profiles (1-to-1 avec auth.users)
-- ============================================================

CREATE TABLE player_profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  display_name    TEXT        NOT NULL,
  first_name      TEXT,
  last_name       TEXT,
  avatar_url      TEXT,
  phone           TEXT,
  date_of_birth   DATE,
  nationality     TEXT        NOT NULL DEFAULT 'MU',
  gender          TEXT        NOT NULL CHECK (gender IN ('M', 'F')),
  fip_id          TEXT        UNIQUE,
  ranking_points  INTEGER     NOT NULL DEFAULT 0 CHECK (ranking_points >= 0),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_player_profiles_updated_at
  BEFORE UPDATE ON player_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_player_profiles_org_id         ON player_profiles(org_id);
CREATE INDEX idx_player_profiles_gender         ON player_profiles(gender);
CREATE INDEX idx_player_profiles_ranking_points ON player_profiles(ranking_points DESC);
CREATE INDEX idx_player_profiles_fip_id         ON player_profiles(fip_id) WHERE fip_id IS NOT NULL;
CREATE INDEX idx_player_profiles_is_active      ON player_profiles(is_active);

-- RLS
ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;

-- Lecture publique (classements et profils visibles)
CREATE POLICY "player_profiles_public_read"
  ON player_profiles FOR SELECT
  USING (true);

-- Création : utilisateur authentifié créant son propre profil
CREATE POLICY "player_profiles_self_insert"
  ON player_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Mise à jour : soi-même ou admin de l'org
CREATE POLICY "player_profiles_self_or_admin_update"
  ON player_profiles FOR UPDATE
  USING (id = auth.uid() OR is_org_admin(org_id));

-- Suppression : admin de l'org uniquement
CREATE POLICY "player_profiles_admin_delete"
  ON player_profiles FOR DELETE
  USING (is_org_admin(org_id));
