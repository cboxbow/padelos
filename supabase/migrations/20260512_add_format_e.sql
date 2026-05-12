-- Migration : ajout FORMAT_E (super tiebreak seul, 10 pts)
-- Étend les CHECK constraints des tables tournaments et matches.

-- ── tournaments ───────────────────────────────────────────────────────────────

ALTER TABLE tournaments
  DROP   CONSTRAINT IF EXISTS tournaments_format_check,
  ADD    CONSTRAINT tournaments_format_check
         CHECK (format IN ('FORMAT_A','FORMAT_B','FORMAT_C','FORMAT_D','FORMAT_E'));

-- ── matches ───────────────────────────────────────────────────────────────────

ALTER TABLE matches
  DROP   CONSTRAINT IF EXISTS matches_format_check,
  ADD    CONSTRAINT matches_format_check
         CHECK (format IN ('FORMAT_A','FORMAT_B','FORMAT_C','FORMAT_D','FORMAT_E'));
