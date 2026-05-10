-- ============================================================
-- Migration 004 : Qualification Groups & Matches
-- ============================================================
-- Contenu :
--   1. Table qual_groups
--   2. Table qual_group_entries
--   3. Table matches
-- ============================================================

-- ─── 1. Table : qual_groups ───────────────────────────────────────────────────

CREATE TABLE qual_groups (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,           -- ex. "Poule A", "Poule B"
  group_index     INTEGER     NOT NULL CHECK (group_index >= 0),
  phase           TEXT        NOT NULL DEFAULT 'qualification'
                              CHECK (phase IN ('qualification', 'consolation')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tournament_id, group_index, phase)
);

-- Indexes
CREATE INDEX idx_qual_groups_tournament_id ON qual_groups(tournament_id);
CREATE INDEX idx_qual_groups_phase         ON qual_groups(phase);

-- RLS
ALTER TABLE qual_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qual_groups_public_read"
  ON qual_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND t.status != 'draft'
    )
  );

CREATE POLICY "qual_groups_admin_write"
  ON qual_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND is_org_admin(t.org_id)
    )
  );

-- ─── 2. Table : qual_group_entries ────────────────────────────────────────────

CREATE TABLE qual_group_entries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID        NOT NULL REFERENCES qual_groups(id) ON DELETE CASCADE,
  entry_id        UUID        NOT NULL REFERENCES tournament_entries(id) ON DELETE CASCADE,
  position        INTEGER     CHECK (position >= 0),  -- classement final dans la poule
  points          INTEGER     NOT NULL DEFAULT 0 CHECK (points >= 0),
  games_won       INTEGER     NOT NULL DEFAULT 0 CHECK (games_won >= 0),
  games_lost      INTEGER     NOT NULL DEFAULT 0 CHECK (games_lost >= 0),
  matches_played  INTEGER     NOT NULL DEFAULT 0 CHECK (matches_played >= 0),
  matches_won     INTEGER     NOT NULL DEFAULT 0 CHECK (matches_won >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (group_id, entry_id)
);

-- Indexes
CREATE INDEX idx_qual_group_entries_group_id ON qual_group_entries(group_id);
CREATE INDEX idx_qual_group_entries_entry_id ON qual_group_entries(entry_id);

-- RLS
ALTER TABLE qual_group_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qual_group_entries_public_read"
  ON qual_group_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM qual_groups g
      JOIN tournaments t ON t.id = g.tournament_id
      WHERE g.id = group_id AND t.status != 'draft'
    )
  );

CREATE POLICY "qual_group_entries_admin_write"
  ON qual_group_entries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM qual_groups g
      JOIN tournaments t ON t.id = g.tournament_id
      WHERE g.id = group_id AND is_org_admin(t.org_id)
    )
  );

-- ─── 3. Table : matches ───────────────────────────────────────────────────────

CREATE TABLE matches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_id        UUID        REFERENCES qual_groups(id) ON DELETE SET NULL,
  phase           TEXT        NOT NULL CHECK (phase IN (
                                'qualification', 'consolation',
                                'round_of_32', 'round_of_16', 'quarter_final',
                                'semi_final', 'final', 'third_place'
                              )),
  round           INTEGER,    -- pour bracket : 1=R32, 2=R16, 3=QF, 4=SF, 5=F
  match_number    INTEGER,    -- numéro dans le bracket (position Seeding Draw)
  format          TEXT        NOT NULL DEFAULT 'FORMAT_B'
                              CHECK (format IN (
                                'FORMAT_A', 'FORMAT_B', 'FORMAT_C', 'FORMAT_D'
                              )),
  status          TEXT        NOT NULL DEFAULT 'scheduled'
                              CHECK (status IN (
                                'scheduled', 'live', 'completed',
                                'walkover', 'bye', 'cancelled'
                              )),
  entry1_id       UUID        REFERENCES tournament_entries(id) ON DELETE SET NULL,
  entry2_id       UUID        REFERENCES tournament_entries(id) ON DELETE SET NULL,
  winner_id       UUID        REFERENCES tournament_entries(id) ON DELETE SET NULL,
  score           JSONB,      -- { sets: [{e1:6,e2:3},{e1:4,e2:6}], tiebreak:{e1:10,e2:7} }
  court           TEXT,
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  referee_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX idx_matches_group_id      ON matches(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_matches_phase         ON matches(phase);
CREATE INDEX idx_matches_status        ON matches(status);
CREATE INDEX idx_matches_entry1_id     ON matches(entry1_id) WHERE entry1_id IS NOT NULL;
CREATE INDEX idx_matches_entry2_id     ON matches(entry2_id) WHERE entry2_id IS NOT NULL;
CREATE INDEX idx_matches_scheduled_at  ON matches(scheduled_at DESC);

-- RLS
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Lecture publique (sauf tournois en draft)
CREATE POLICY "matches_public_read"
  ON matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND t.status != 'draft'
    )
  );

-- Création : admins de l'org
CREATE POLICY "matches_admin_insert"
  ON matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND is_org_admin(t.org_id)
    )
  );

-- Mise à jour : admins + arbitres assignés
CREATE POLICY "matches_admin_or_referee_update"
  ON matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND is_org_admin(t.org_id)
    )
    OR referee_id = auth.uid()
  );

-- Suppression : admins uniquement
CREATE POLICY "matches_admin_delete"
  ON matches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND is_org_admin(t.org_id)
    )
  );
