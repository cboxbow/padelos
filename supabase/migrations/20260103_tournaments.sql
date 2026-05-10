-- ============================================================
-- Migration 003 : Tournaments & Entries
-- ============================================================
-- Contenu :
--   1. Table tournaments
--   2. Table tournament_entries
-- ============================================================

-- ─── 1. Table : tournaments ───────────────────────────────────────────────────

CREATE TABLE tournaments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  slug              TEXT        NOT NULL,
  category          TEXT        NOT NULL CHECK (category IN (
                                  'M1000', 'M500', 'M250', 'M100', 'M50', 'M25',
                                  'W1000', 'W500', 'W250', 'W100', 'W50', 'W25',
                                  'JUNIOR_U15', 'JUNIOR_U13', 'JUNIOR_U11'
                                )),
  status            TEXT        NOT NULL DEFAULT 'draft'
                                CHECK (status IN (
                                  'draft', 'registration', 'active',
                                  'completed', 'cancelled'
                                )),
  format            TEXT        NOT NULL DEFAULT 'FORMAT_B'
                                CHECK (format IN (
                                  'FORMAT_A', 'FORMAT_B', 'FORMAT_C', 'FORMAT_D'
                                )),
  start_date        DATE        NOT NULL,
  end_date          DATE        NOT NULL,
  registration_end  TIMESTAMPTZ,
  venue             TEXT,
  city              TEXT,
  country           TEXT        NOT NULL DEFAULT 'MU',
  max_pairs         INTEGER     NOT NULL DEFAULT 32 CHECK (max_pairs > 0),
  prize_money       NUMERIC(12, 2) DEFAULT 0,
  currency          TEXT        NOT NULL DEFAULT 'MUR',
  description       TEXT,
  rules             TEXT,
  settings          JSONB       NOT NULL DEFAULT '{}',
  created_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (end_date >= start_date),
  UNIQUE (org_id, slug)
);

CREATE TRIGGER trg_tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_tournaments_org_id     ON tournaments(org_id);
CREATE INDEX idx_tournaments_category   ON tournaments(category);
CREATE INDEX idx_tournaments_status     ON tournaments(status);
CREATE INDEX idx_tournaments_start_date ON tournaments(start_date DESC);
CREATE INDEX idx_tournaments_slug       ON tournaments(org_id, slug);

-- RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- Lecture publique (tournois actifs et passés visibles par tous)
CREATE POLICY "tournaments_public_read"
  ON tournaments FOR SELECT
  USING (status != 'draft' OR is_org_member(org_id));

-- Création : admins de l'org
CREATE POLICY "tournaments_admin_insert"
  ON tournaments FOR INSERT
  WITH CHECK (is_org_admin(org_id));

-- Mise à jour : admins de l'org
CREATE POLICY "tournaments_admin_update"
  ON tournaments FOR UPDATE
  USING (is_org_admin(org_id));

-- Suppression : admins de l'org (seulement si draft)
CREATE POLICY "tournaments_admin_delete"
  ON tournaments FOR DELETE
  USING (is_org_admin(org_id) AND status = 'draft');

-- ─── 2. Table : tournament_entries ────────────────────────────────────────────

CREATE TABLE tournament_entries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player1_id      UUID        NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  player2_id      UUID        NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN (
                                'pending', 'confirmed', 'waitlist',
                                'withdrawn', 'disqualified'
                              )),
  seed            INTEGER     CHECK (seed > 0),
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un joueur ne peut pas être dans deux paires du même tournoi
  UNIQUE (tournament_id, player1_id),
  UNIQUE (tournament_id, player2_id),
  -- Les deux joueurs d'une paire doivent être différents
  CHECK (player1_id != player2_id)
);

CREATE TRIGGER trg_tournament_entries_updated_at
  BEFORE UPDATE ON tournament_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_tournament_entries_tournament_id ON tournament_entries(tournament_id);
CREATE INDEX idx_tournament_entries_player1_id    ON tournament_entries(player1_id);
CREATE INDEX idx_tournament_entries_player2_id    ON tournament_entries(player2_id);
CREATE INDEX idx_tournament_entries_status        ON tournament_entries(status);
CREATE INDEX idx_tournament_entries_seed          ON tournament_entries(tournament_id, seed) WHERE seed IS NOT NULL;

-- RLS
ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY;

-- Lecture : membres de l'org (ou entrées confirmées publiques via join tournaments)
CREATE POLICY "tournament_entries_member_read"
  ON tournament_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id
        AND (t.status != 'draft' OR is_org_member(t.org_id))
    )
  );

-- Inscription : joueur s'inscrit lui-même (player1_id ou player2_id = auth.uid())
CREATE POLICY "tournament_entries_player_insert"
  ON tournament_entries FOR INSERT
  WITH CHECK (
    player1_id = auth.uid() OR player2_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND is_org_admin(t.org_id)
    )
  );

-- Mise à jour : admin de l'org (seed, status)
CREATE POLICY "tournament_entries_admin_update"
  ON tournament_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND is_org_admin(t.org_id)
    )
  );

-- Retrait : joueur se retire ou admin
CREATE POLICY "tournament_entries_player_or_admin_delete"
  ON tournament_entries FOR DELETE
  USING (
    player1_id = auth.uid()
    OR player2_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND is_org_admin(t.org_id)
    )
  );
