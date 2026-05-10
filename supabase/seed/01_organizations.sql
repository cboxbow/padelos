-- ============================================================
-- Seed 01 : Organizations
-- ============================================================
-- UUIDs fixes pour pouvoir les référencer dans les seeds suivants.
-- Exécuter via Supabase SQL Editor (connecté en tant que postgres).
-- ============================================================

-- MPL : Mauritius Padel League (fédération nationale)
INSERT INTO organizations (id, name, slug, type, country, website, settings)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Mauritius Padel League',
  'mpl',
  'federation',
  'MU',
  'https://padelleague.mu',
  '{
    "primaryColor": "#C9A84C",
    "categories": ["M1000","M500","M250","M100","M50","M25","W1000","W500","W250","W100","W50","W25","JUNIOR_U15","JUNIOR_U13","JUNIOR_U11"],
    "defaultFormat": "FORMAT_B",
    "rankingWindow": 52
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name     = EXCLUDED.name,
  website  = EXCLUDED.website,
  settings = EXCLUDED.settings;

-- Tamarin Padel Club
INSERT INTO organizations (id, name, slug, type, country, settings)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'Tamarin Padel Club',
  'tamarin-club',
  'club',
  'MU',
  '{"region": "West"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name     = EXCLUDED.name,
  settings = EXCLUDED.settings;

-- Royal Mount Club
INSERT INTO organizations (id, name, slug, type, country, settings)
VALUES (
  'a0000000-0000-0000-0000-000000000003',
  'Royal Mount Padel Club',
  'rm-club',
  'club',
  'MU',
  '{"region": "Central"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name     = EXCLUDED.name,
  settings = EXCLUDED.settings;
