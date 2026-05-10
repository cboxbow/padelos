-- ============================================================
-- Migration 005 : Live Scores (Realtime)
-- ============================================================
-- Contenu :
--   1. Table live_scores
--   2. Activation Supabase Realtime
-- ============================================================

CREATE TABLE live_scores (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID        NOT NULL REFERENCES matches(id) ON DELETE CASCADE UNIQUE,
  tournament_id   UUID        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  set_number      INTEGER     NOT NULL DEFAULT 1 CHECK (set_number BETWEEN 1 AND 3),
  score_entry1    INTEGER     NOT NULL DEFAULT 0 CHECK (score_entry1 >= 0),
  score_entry2    INTEGER     NOT NULL DEFAULT 0 CHECK (score_entry2 >= 0),
  -- Super tiebreak (set décisif first to 10)
  tiebreak_entry1 INTEGER     CHECK (tiebreak_entry1 >= 0),
  tiebreak_entry2 INTEGER     CHECK (tiebreak_entry2 >= 0),
  -- Scores de jeux dans le set courant
  game_entry1     INTEGER     NOT NULL DEFAULT 0 CHECK (game_entry1 BETWEEN 0 AND 50),
  game_entry2     INTEGER     NOT NULL DEFAULT 0 CHECK (game_entry2 BETWEEN 0 AND 50),
  -- Historique JSON des sets complétés : [{set:1,e1:6,e2:3},{set:2,e1:4,e2:6}]
  sets_history    JSONB       NOT NULL DEFAULT '[]',
  is_tiebreak     BOOLEAN     NOT NULL DEFAULT false,
  serving         TEXT        CHECK (serving IN ('entry1', 'entry2')),
  -- Méta affichage OBS
  court_name      TEXT,
  player1_name    TEXT,       -- dénormalisé pour perf Realtime
  player2_name    TEXT,
  player3_name    TEXT,
  player4_name    TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_live_scores_updated_at
  BEFORE UPDATE ON live_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_live_scores_tournament_id ON live_scores(tournament_id);
CREATE INDEX idx_live_scores_updated_at    ON live_scores(updated_at DESC);

-- RLS
ALTER TABLE live_scores ENABLE ROW LEVEL SECURITY;

-- Lecture publique (OBS overlay + spectateurs)
CREATE POLICY "live_scores_public_read"
  ON live_scores FOR SELECT
  USING (true);

-- Création : arbitres et admins de l'org du tournoi
CREATE POLICY "live_scores_referee_insert"
  ON live_scores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN tournaments t ON t.id = m.tournament_id
      WHERE m.id = match_id
        AND (m.referee_id = auth.uid() OR is_org_admin(t.org_id))
    )
  );

-- Mise à jour : arbitres du match et admins de l'org
CREATE POLICY "live_scores_referee_update"
  ON live_scores FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN tournaments t ON t.id = m.tournament_id
      WHERE m.id = match_id
        AND (m.referee_id = auth.uid() OR is_org_admin(t.org_id))
    )
  );

-- Suppression : admins uniquement
CREATE POLICY "live_scores_admin_delete"
  ON live_scores FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN tournaments t ON t.id = m.tournament_id
      WHERE m.id = match_id AND is_org_admin(t.org_id)
    )
  );

-- ─── Activer Realtime ─────────────────────────────────────────────────────────
-- Permet aux clients Supabase de s'abonner aux changements en temps réel.

ALTER PUBLICATION supabase_realtime ADD TABLE live_scores;
