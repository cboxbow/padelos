---
name: supabase-schema
description: Architecture base de données Supabase pour PadelOS. Utiliser pour créer des migrations SQL, configurer RLS policies, définir des Edge Functions, générer des types TypeScript, ou résoudre des problèmes de schema. Déclencher quand l'utilisateur mentionne "table", "migration", "RLS", "policy", "types Supabase", "schema", ou travaille sur une nouvelle entité métier.
---

# Supabase Schema — PadelOS

## Principes inviolables
1. **RLS TOUJOURS activé** — `ALTER TABLE x ENABLE ROW LEVEL SECURITY` sur chaque table
2. **UUID partout** — `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Timestamps** — `created_at TIMESTAMPTZ DEFAULT NOW()` + `updated_at` si mutable
4. **Migrations numérotées** — `supabase/migrations/YYYYMMDD_description.sql`
5. **Types générés** — `npx supabase gen types typescript --local > src/types/database.ts`

## Pattern RLS standard

```sql
-- Lecture publique
CREATE POLICY "Public read" ON table_name
  FOR SELECT USING (true);

-- Lecture membres org
CREATE POLICY "Org member read" ON table_name
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- Écriture admin
CREATE POLICY "Admin write" ON table_name
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = table_name.org_id
      AND user_id = auth.uid()
      AND role IN ('super_admin','federation_admin','club_admin')
    )
  );

-- Écriture propriétaire
CREATE POLICY "Owner write" ON table_name
  FOR ALL USING (user_id = auth.uid());
```

## Helpers Supabase côté Next.js

```typescript
// src/lib/supabase/server.ts — Server Components / Route Handlers
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() },
                 setAll(c) { c.forEach(({name,value,options}) => cookieStore.set(name,value,options)) } } }
  )
}

// src/lib/supabase/client.ts — Client Components
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// src/lib/supabase/admin.ts — Server-side uniquement (service role)
// JAMAIS exposer côté client
import { createClient } from '@supabase/supabase-js'
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

## Realtime (Live Scoring)

```typescript
// Subscribe à une table en temps réel
const channel = supabase
  .channel('live-scores')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'live_scores',
    filter: `match_id=eq.${matchId}`
  }, (payload) => {
    // handle update
  })
  .subscribe()

// Cleanup obligatoire
return () => { supabase.removeChannel(channel) }
```

## Checklist migration

Avant de créer une migration :
1. La table a-t-elle `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` ?
2. RLS activé + au moins 1 policy définie ?
3. FK avec `ON DELETE CASCADE` ou `SET NULL` explicite ?
4. Index sur les colonnes fréquemment filtrées (org_id, tournament_id, user_id) ?
5. Enum ou CHECK constraint sur les champs status/type ?

```sql
-- Index standard à ajouter systématiquement
CREATE INDEX ON table_name(org_id);
CREATE INDEX ON table_name(created_at DESC);
```
