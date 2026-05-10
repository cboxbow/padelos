-- ============================================================
-- Migration 006 : Rankings
-- ============================================================
-- Contenu :
--   1. Table ranking_points  (points par résultat, 52 semaines glissantes)
--   2. Table rankings_snapshots (classement calculé, best-of-8 FIP)
-- ============================================================

-- ─── 1. Table : ranking_points ────────────────────────────────────────────────
-- Un enregistrement par résultat FIP (W/SF/QF/R16/R32/R64/QG)
-- Fenêtre glissante 52 semaines ; l'algo best-of-8 garde les 8 meilleurs.

CREATE TABLE ranking_points (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID        NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  tournament_id   UUID        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id        UUID        REFERENCES matches(id) ON DELETE SET NULL,
  category        TEXT        NOT NULL CHECK (category IN (
                                'M1000', 'M500', 'M250', 'M100', 'M50', 'M25',
                                'W1000', 'W500', 'W250', 'W100', 'W50', 'W25',
                                'JUNIOR_U15', 'JUNIOR_U13', 'JUNIOR_U11'
                              )),
  round           TEXT        NOT NULL CHECK (round IN (
                                'W', 'SF', 'QF', 'R16', 'R32', 'R64', 'QG'
                              )),
  points          INTEGER     NOT NULL CHECK (points >= 0),
  tournament_date DATE        NOT NULL,  -- date utilisée pour la fenêtre 52 sem.
  expires_at      DATE        NOT NULL,  -- tournament_date + 364 jours
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (player_id, tournament_id, round)
);

-- Auto-calcul expires_at à la création
CREATE OR REPLACE FUNCTION set_ranking_points_expires_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.expires_at = NEW.tournament_date + INTERVAL '364 days';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ranking_points_expires_at
  BEFORE INSERT ON ranking_points
  FOR EACH ROW EXECUTE FUNCTION set_ranking_points_expires_at();

-- Indexes
CREATE INDEX idx_ranking_points_player_id       ON ranking_points(player_id);
CREATE INDEX idx_ranking_points_tournament_id   ON ranking_points(tournament_id);
CREATE INDEX idx_ranking_points_category        ON ranking_points(category);
CREATE INDEX idx_ranking_points_tournament_date ON ranking_points(tournament_date DESC);
CREATE INDEX idx_ranking_points_expires_at      ON ranking_points(expires_at);
-- Index pour la requête best-of-8 : tri par joueur + catégorie + points DESC
CREATE INDEX idx_ranking_points_best_of_8
  ON ranking_points(player_id, category, points DESC);

-- RLS
ALTER TABLE ranking_points ENABLE ROW LEVEL SECURITY;

-- Lecture publique
CREATE POLICY "ranking_points_public_read"
  ON ranking_points FOR SELECT
  USING (true);

-- Insertion : admins de l'org du tournoi (ou service role via Edge Function)
CREATE POLICY "ranking_points_admin_insert"
  ON ranking_points FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND is_org_admin(t.org_id)
    )
  );

-- Mise à jour : admins uniquement
CREATE POLICY "ranking_points_admin_update"
  ON ranking_points FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND is_org_admin(t.org_id)
    )
  );

-- Suppression : admins uniquement
CREATE POLICY "ranking_points_admin_delete"
  ON ranking_points FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND is_org_admin(t.org_id)
    )
  );

-- ─── 2. Table : rankings_snapshots ────────────────────────────────────────────
-- Classement pré-calculé (best-of-8 FIP sur 52 semaines glissantes).
-- Régénéré par Edge Function après chaque tournoi complété.

CREATE TABLE rankings_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_id       UUID        NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  category        TEXT        NOT NULL CHECK (category IN (
                                'M1000', 'M500', 'M250', 'M100', 'M50', 'M25',
                                'W1000', 'W500', 'W250', 'W100', 'W50', 'W25',
                                'JUNIOR_U15', 'JUNIOR_U13', 'JUNIOR_U11'
                              )),
  rank_position   INTEGER     NOT NULL CHECK (rank_position > 0),
  total_points    INTEGER     NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  -- Les 8 meilleurs résultats (JSON pour affichage détail)
  best_results    JSONB       NOT NULL DEFAULT '[]',
  tournaments_count INTEGER   NOT NULL DEFAULT 0 CHECK (tournaments_count >= 0),
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (org_id, player_id, category)
);

-- Indexes
CREATE INDEX idx_rankings_snapshots_org_id      ON rankings_snapshots(org_id);
CREATE INDEX idx_rankings_snapshots_player_id   ON rankings_snapshots(player_id);
CREATE INDEX idx_rankings_snapshots_category    ON rankings_snapshots(category);
CREATE INDEX idx_rankings_snapshots_rank        ON rankings_snapshots(org_id, category, rank_position);
CREATE INDEX idx_rankings_snapshots_computed_at ON rankings_snapshots(computed_at DESC);

-- RLS
ALTER TABLE rankings_snapshots ENABLE ROW LEVEL SECURITY;

-- Lecture publique
CREATE POLICY "rankings_snapshots_public_read"
  ON rankings_snapshots FOR SELECT
  USING (true);

-- Écriture : admins de l'org (ou service role via Edge Function)
CREATE POLICY "rankings_snapshots_admin_write"
  ON rankings_snapshots FOR ALL
  USING (is_org_admin(org_id));
