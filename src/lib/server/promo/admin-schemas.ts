import { z } from 'zod';
import { PROMO_MAX_ASPECT_RATIO_EDGE, PROMO_MIN_INTERVAL_MS } from '@/lib/promo';

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
export const promoAspectRatioSourceSchema = z.enum(['preset', 'custom', 'legacySlot']);
export const promoShareKeyStatusSchema = z.enum(['active', 'disabled', 'revoked']);
export const adminRoleSchema = z.enum(['owner', 'admin', 'viewer']);
export const adminStatusSchema = z.enum(['active', 'disabled']);

const aspectRatioNumberSchema = z.coerce.number().int().min(1).max(10000);

function validateAspectRatioBounds(value: { aspectRatioWidth?: number; aspectRatioHeight?: number }, ctx: z.RefinementCtx) {
    if (value.aspectRatioWidth === undefined && value.aspectRatioHeight === undefined) return;
    if (value.aspectRatioWidth === undefined || value.aspectRatioHeight === undefined) {
        ctx.addIssue({
            code: 'custom',
            message: '展示比例宽高必须同时填写。',
            path: value.aspectRatioWidth === undefined ? ['aspectRatioWidth'] : ['aspectRatioHeight']
        });
        return;
    }
    const edgeRatio =
        Math.max(value.aspectRatioWidth, value.aspectRatioHeight) /
        Math.min(value.aspectRatioWidth, value.aspectRatioHeight);
    if (edgeRatio > PROMO_MAX_ASPECT_RATIO_EDGE) {
        ctx.addIssue({
            code: 'custom',
            message: `展示比例长边不能超过短边的 ${PROMO_MAX_ASPECT_RATIO_EDGE} 倍。`,
            path: ['aspectRatioWidth']
        });
    }
}

function requireAspectRatio(value: { aspectRatioWidth?: number; aspectRatioHeight?: number }, ctx: z.RefinementCtx) {
    if (value.aspectRatioWidth !== undefined && value.aspectRatioHeight !== undefined) return;
    ctx.addIssue({
        code: 'custom',
        message: '展示比例为必填项。',
        path: value.aspectRatioWidth === undefined ? ['aspectRatioWidth'] : ['aspectRatioHeight']
    });
}

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

const promoConfigSchemaBase = z.object({
    name: z.string().trim().min(1).max(120),
    note: z.string().trim().max(500).nullable().optional(),
    slotId: z.string().trim().min(1),
    scope: promoScopeSchema,
    shareProfileId: z.string().trim().nullable().optional(),
    enabled: z.boolean().optional(),
    intervalMs: nullableNumber,
    transition: promoTransitionSchema.nullable().optional(),
    aspectRatioWidth: aspectRatioNumberSchema,
    aspectRatioHeight: aspectRatioNumberSchema,
    aspectRatioSource: promoAspectRatioSourceSchema,
    startsAt: nullableDate,
    endsAt: nullableDate
});

export const promoConfigCreateSchema = promoConfigSchemaBase
    .extend({
        scope: promoScopeSchema.default('global'),
        aspectRatioSource: promoAspectRatioSourceSchema.default('preset')
    })
    .superRefine((value, ctx) => {
        requireAspectRatio(value, ctx);
        validateAspectRatioBounds(value, ctx);
    });

export const promoConfigUpdateSchema = promoConfigSchemaBase.partial().superRefine(validateAspectRatioBounds);

const promoItemSchemaBase = z.object({
    configId: z.string().trim().min(1),
    title: z.string().trim().max(120).optional(),
    alt: z.string().trim().max(160).optional(),
    desktopImageUrl: z.string().trim().max(2048).optional(),
    mobileImageUrl: z.string().trim().max(2048).optional(),
    linkUrl: z.string().trim().max(2048).optional(),
    device: promoDeviceSchema.optional(),
    enabled: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
    weight: z.coerce.number().int().min(0).optional(),
    startsAt: nullableDate,
    endsAt: nullableDate
});

export const promoItemCreateSchema = promoItemSchemaBase;

export const promoItemUpdateSchema = promoItemSchemaBase.partial();

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
