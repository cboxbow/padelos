import { z } from 'zod'

// ─── Login ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
})

export type LoginInput = z.infer<typeof loginSchema>

// ─── Register ─────────────────────────────────────────────────────────────────

export const registerStep1Schema = z.object({
  email:      z.string().email('Adresse email invalide'),
  first_name: z.string().min(2, 'Minimum 2 caractères').max(50),
  last_name:  z.string().min(2, 'Minimum 2 caractères').max(50),
})

export type RegisterStep1Input = z.infer<typeof registerStep1Schema>

export const registerStep2Schema = z.object({
  org_name: z.string().min(3, 'Minimum 3 caractères').max(100),
  org_type: z.enum(['federation', 'club', 'association'], {
    required_error: 'Sélectionnez un type',
  }),
  org_slug: z
    .string()
    .min(3, 'Minimum 3 caractères')
    .max(50, 'Maximum 50 caractères')
    .regex(/^[a-z0-9-]+$/, 'Minuscules, chiffres et tirets uniquement'),
})

export type RegisterStep2Input = z.infer<typeof registerStep2Schema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convertit un nom en slug URL-safe */
export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // supprime les accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
}
