import { z } from 'zod'

export const addPlayerSchema = z.object({
  first_name:   z.string().min(2, 'Minimum 2 caractères').max(50),
  last_name:    z.string().min(2, 'Minimum 2 caractères').max(50),
  display_name: z.string().max(80).optional(),
  gender:       z.enum(['M', 'F']),
  nationality:  z.string().length(2).default('MU'),
})

export type AddPlayerInput = z.infer<typeof addPlayerSchema>
