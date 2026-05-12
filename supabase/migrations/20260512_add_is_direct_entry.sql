-- Ajout colonne is_direct_entry sur tournament_entries
-- true  = paire qualifiée directement dans le tableau principal (ne joue pas les qualifs)
-- false = paire en phase de qualification (défaut)

ALTER TABLE tournament_entries
  ADD COLUMN IF NOT EXISTS is_direct_entry BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tournament_entries_direct
  ON tournament_entries(tournament_id, is_direct_entry);
