import { z } from 'zod';

export const publicActionConfigCreateSchema = z.object({
    name: z.string().trim().min(1).max(120),
    buttonLabel: z.string().trim().min(1).max(64),
    targetUrl: z.string().trim().min(1).max(2048),
    enabled: z.boolean().optional(),
    active: z.boolean().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    sortOrder: z.coerce.number().int().min(-1_000_000).max(1_000_000).optional()
});

export const publicActionConfigUpdateSchema = publicActionConfigCreateSchema.partial();
