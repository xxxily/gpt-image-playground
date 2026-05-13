import { z } from 'zod';
import { PROMO_MIN_INTERVAL_MS } from '@/lib/promo';

const nullableDate = z.preprocess((value) => {
    if (value === '' || value === undefined) return undefined;
    if (value === null) return null;
    return value;
}, z.coerce.date().nullable().optional());

const nullableNumber = z.preprocess((value) => {
    if (value === '' || value === undefined) return undefined;
    if (value === null) return null;
    return value;
}, z.coerce.number().int().min(PROMO_MIN_INTERVAL_MS).nullable().optional());

export const promoTransitionSchema = z.enum(['fade', 'slide', 'none']);
export const promoDeviceSchema = z.enum(['all', 'desktop', 'mobile']);
export const promoScopeSchema = z.enum(['global', 'share']);
export const promoShareKeyStatusSchema = z.enum(['active', 'disabled', 'revoked']);
export const adminRoleSchema = z.enum(['owner', 'admin', 'viewer']);
export const adminStatusSchema = z.enum(['active', 'disabled']);

export const promoSlotCreateSchema = z.object({
    key: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .regex(/^[a-z0-9][a-z0-9_:-]*$/u, '展示位 Key 只能包含小写字母、数字、下划线、冒号或短横线。'),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(240).nullable().optional(),
    enabled: z.boolean().optional(),
    defaultIntervalMs: z.coerce.number().int().min(PROMO_MIN_INTERVAL_MS).optional(),
    defaultTransition: promoTransitionSchema.optional()
});

export const promoSlotUpdateSchema = promoSlotCreateSchema.omit({ key: true }).partial();

export const promoConfigCreateSchema = z.object({
    name: z.string().trim().min(1).max(120),
    note: z.string().trim().max(500).nullable().optional(),
    slotId: z.string().trim().min(1),
    scope: promoScopeSchema.default('global'),
    shareProfileId: z.string().trim().nullable().optional(),
    enabled: z.boolean().optional(),
    intervalMs: nullableNumber,
    transition: promoTransitionSchema.nullable().optional(),
    startsAt: nullableDate,
    endsAt: nullableDate
});

export const promoConfigUpdateSchema = promoConfigCreateSchema.partial();

export const promoItemCreateSchema = z.object({
    configId: z.string().trim().min(1),
    title: z.string().trim().min(1).max(120),
    alt: z.string().trim().min(1).max(160),
    desktopImageUrl: z.string().trim().min(1).max(2048),
    mobileImageUrl: z.string().trim().min(1).max(2048),
    linkUrl: z.string().trim().min(1).max(2048),
    device: promoDeviceSchema.default('all'),
    enabled: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
    weight: z.coerce.number().int().min(0).optional(),
    startsAt: nullableDate,
    endsAt: nullableDate
});

export const promoItemUpdateSchema = promoItemCreateSchema.partial();

export const promoShareKeyCreateSchema = z.object({
    name: z.string().trim().min(1).max(120),
    note: z.string().trim().max(500).nullable().optional(),
    expiresAt: nullableDate,
    allowedSlots: z.array(z.string().trim().min(1)).default([]),
    count: z.coerce.number().int().min(1).max(20).optional()
});

export const promoShareKeyUpdateSchema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    note: z.string().trim().max(500).nullable().optional(),
    expiresAt: nullableDate,
    allowedSlots: z.array(z.string().trim().min(1)).optional(),
    status: promoShareKeyStatusSchema.optional()
});

export const adminUserCreateSchema = z.object({
    email: z.string().trim().email(),
    name: z.string().trim().min(1).max(120),
    password: z.string().min(12),
    role: adminRoleSchema.default('viewer'),
    status: adminStatusSchema.default('active')
});

export const adminUserUpdateSchema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    password: z.string().min(12).optional(),
    role: adminRoleSchema.optional(),
    status: adminStatusSchema.optional()
});
