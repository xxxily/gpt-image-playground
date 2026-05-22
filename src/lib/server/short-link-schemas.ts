import { z } from 'zod';

const nullableDate = z.preprocess((value) => {
    if (value === '' || value === undefined) return undefined;
    if (value === null) return null;
    return value;
}, z.coerce.date().nullable().optional());

const nullableNumber = z.preprocess((value) => {
    if (value === '' || value === undefined) return undefined;
    if (value === null) return null;
    return value;
}, z.coerce.number().int().positive().nullable().optional());

export const shortLinkPromoModeSchema = z.enum(['inherit', 'none', 'override']);
export const shortLinkStatusSchema = z.enum(['active', 'disabled', 'deleted']);
export const shortLinkCreationModeSchema = z.enum(['disabled', 'admin', 'passphrase', 'public']);

export const publicShortLinkCreateSchema = z.object({
    targetUrl: z.string().trim().min(1).max(32768),
    clientRequestId: z.string().trim().max(160).nullable().optional(),
    creationPassphrase: z.string().max(500).nullable().optional(),
    requestedCode: z.string().trim().max(64).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
    expiresAt: nullableDate
});

export const adminShortLinkCreateSchema = publicShortLinkCreateSchema.extend({
    requestedCode: z.string().trim().max(64).nullable().optional(),
    promoMode: shortLinkPromoModeSchema.optional(),
    promoProfileId: z.string().trim().nullable().optional(),
    maxVisits: nullableNumber
});

export const adminShortLinkUpdateSchema = z.object({
    note: z.string().trim().max(500).nullable().optional(),
    status: shortLinkStatusSchema.optional(),
    expiresAt: nullableDate,
    maxVisits: nullableNumber,
    promoMode: shortLinkPromoModeSchema.optional(),
    promoProfileId: z.string().trim().nullable().optional(),
    targetUrl: z.string().trim().max(32768).nullable().optional()
});

export const adminShortLinkSettingsUpdateSchema = z.object({
    enabled: z.boolean().optional(),
    creationMode: shortLinkCreationModeSchema.optional(),
    passphrase: z.string().max(500).nullable().optional(),
    codeLength: z.coerce.number().int().min(8).max(32).optional(),
    defaultExpiresInDays: z.coerce.number().int().min(0).max(3650).optional(),
    maxTargetUrlLength: z.coerce.number().int().min(512).max(32768).optional(),
    allowSensitiveTargets: z.boolean().optional(),
    allowInlineSecurePassword: z.boolean().optional(),
    allowedOrigins: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
    visitRetentionDays: z.coerce.number().int().min(1).max(3650).optional()
});
