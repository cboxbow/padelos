import { z } from 'zod'

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  'M25','M50','M100','M250','M500','M1000',
  'W25','W50','W100','W250','W500','W1000',
  'JUNIOR_U11','JUNIOR_U13','JUNIOR_U15',
] as const

const FORMATS = ['FORMAT_A','FORMAT_B','FORMAT_C','FORMAT_D'] as const

// ─── Schéma création ─────────────────────────────────────────────────────────

export const createTournamentSchema = z.object({
  name:              z.string().min(3, 'Minimum 3 caractères').max(100, 'Maximum 100 caractères'),
  category:          z.enum(CATEGORIES, { required_error: 'Catégorie requise' }),
  format:            z.enum(FORMATS, { required_error: 'Format requis' }),
  start_date:        z.string().min(1, 'Date de début requise'),
  end_date:          z.string().min(1, 'Date de fin requise'),
  registration_end:  z.string().optional(),
  max_pairs:         z.coerce.number().int().min(4, 'Minimum 4 paires').max(256).default(32),
  venue:             z.string().max(100).optional(),
  city:              z.string().max(100).optional(),
  description:       z.string().max(500).optional(),
  prize_money:       z.coerce.number().min(0).optional(),
}).refine(d => d.end_date >= d.start_date, {
  message: 'La date de fin doit être après la date de début',
  path: ['end_date'],
}).refine(d => !d.registration_end || d.registration_end <= d.start_date, {
  message: 'La clôture des inscriptions doit être avant le début du tournoi',
  path: ['registration_end'],
})

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>

// ─── Slug helper ──────────────────────────────────────────────────────────────

export function toTournamentSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}
