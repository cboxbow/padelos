-- Migration: allow tournament entries with free-text player names
-- (pour l'instant — les joueurs sans compte PadelOS peuvent être inscrits par nom)
--
-- player1_id / player2_id deviennent nullable
-- player1_name / player2_name stockent les noms libres
-- CHECK : au moins un identifiant par slot

ALTER TABLE tournament_entries
  ALTER COLUMN player1_id DROP NOT NULL,
  ALTER COLUMN player2_id DROP NOT NULL,
  ADD COLUMN player1_name TEXT,
  ADD COLUMN player2_name TEXT;

-- Au moins un identifiant (FK ou nom) requis par slot joueur
ALTER TABLE tournament_entries
  ADD CONSTRAINT entry_player1_ident
    CHECK (player1_id IS NOT NULL OR player1_name IS NOT NULL),
  ADD CONSTRAINT entry_player2_ident
    CHECK (player2_id IS NOT NULL OR player2_name IS NOT NULL);

-- Index pour lookup par joueur (quand on relie à un profil)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_te_player1_id ON tournament_entries(player1_id) WHERE player1_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_te_player2_id ON tournament_entries(player2_id) WHERE player2_id IS NOT NULL;
