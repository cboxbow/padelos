-- ============================================================
-- Migration 001 : Organizations & Members
-- ============================================================
-- Ordre correct (PostgreSQL valide les fonctions sql à la création) :
--   1. update_updated_at() trigger helper
--   2. Table organizations (sans policies admin pour l'instant)
--   3. Table org_members
--   4. SECURITY DEFINER helpers is_org_admin / is_org_member
--      (org_members doit exister avant)
--   5. Policies RLS organizations (admin) + org_members
-- ============================================================

-- ─── 1. Trigger function shared across all mutable tables ────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ─── 2. Table : organizations ─────────────────────────────────────────────────

CREATE TABLE organizations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  slug         TEXT        NOT NULL UNIQUE,
  type         TEXT        NOT NULL CHECK (type IN ('federation', 'club', 'association')),
  country      TEXT        NOT NULL DEFAULT 'MU',
  logo_url     TEXT,
  website      TEXT,
  settings     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_organizations_slug    ON organizations(slug);
CREATE INDEX idx_organizations_type    ON organizations(type);
CREATE INDEX idx_organizations_country ON organizations(country);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Policies sans dépendance sur is_org_admin (définie plus bas)
CREATE POLICY "organizations_public_read"
  ON organizations FOR SELECT
  USING (true);

CREATE POLICY "organizations_authenticated_insert"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 3. Table : org_members ───────────────────────────────────────────────────

CREATE TABLE org_members (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT        NOT NULL CHECK (role IN (
                             'super_admin', 'federation_admin',
                             'club_admin', 'referee', 'player'
                           )),
  invited_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (org_id, user_id)
);

CREATE INDEX idx_org_members_org_id  ON org_members(org_id);
CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_org_members_role    ON org_members(role);

ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- ─── 4. SECURITY DEFINER helpers ─────────────────────────────────────────────
-- Créés APRÈS org_members pour que PostgreSQL puisse les valider.
-- SECURITY DEFINER + search_path figé = pas de privilege escalation.

CREATE OR REPLACE FUNCTION is_org_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_members
    WHERE org_id  = p_org_id
      AND user_id = auth.uid()
      AND role IN ('super_admin', 'federation_admin', 'club_admin')
  );
$$;

CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_members
    WHERE org_id  = p_org_id
      AND user_id = auth.uid()
  );
$$;

-- ─── 5. Policies RLS dépendant des helpers ────────────────────────────────────

-- organizations — UPDATE/DELETE (admin)
CREATE POLICY "organizations_admin_update"
  ON organizations FOR UPDATE
  USING (is_org_admin(id));

CREATE POLICY "organizations_admin_delete"
  ON organizations FOR DELETE
  USING (is_org_admin(id));

-- org_members — toutes les policies
CREATE POLICY "org_members_member_read"
  ON org_members FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "org_members_admin_insert"
  ON org_members FOR INSERT
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "org_members_admin_update"
  ON org_members FOR UPDATE
  USING (is_org_admin(org_id));

CREATE POLICY "org_members_admin_delete"
  ON org_members FOR DELETE
  USING (is_org_admin(org_id) OR user_id = auth.uid());
