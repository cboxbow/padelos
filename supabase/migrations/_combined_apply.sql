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
