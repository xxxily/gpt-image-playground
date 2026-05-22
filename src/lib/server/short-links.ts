import crypto from 'node:crypto';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { getSecureSharePayload, parseUrlParams } from '@/lib/url-params';
import { validatePublicHttpBaseUrl } from '@/lib/server-url-safety';
import { recordAuditLog } from '@/lib/server/audit';
import { getServerDatabaseReady } from '@/lib/server/db';
import {
    promoShareProfiles,
    shortLinks,
    shortLinkSettings,
    shortLinkVisits,
    type ShortLinkCreationMode,
    type ShortLinkPromoMode,
    type ShortLinkStatus
} from '@/lib/server/schema';
import {
    checkInMemoryRateLimit,
    constantTimeEqual,
    hashSha256Hex,
    randomToken,
    sanitizePlainText
} from '@/lib/server/security';
import type { PromoAdminActor } from '@/lib/server/promo/admin';

const SETTINGS_ID = 'default';
const SHORT_CODE_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SHORT_CODE_RESERVED = new Set(['admin', 'api', 'assets', 'login', 'promo', 'settings', 's', '_next']);
const DEFAULT_CODE_LENGTH = 12;
const MIN_CODE_LENGTH = 8;
const MAX_CODE_LENGTH = 32;
const DEFAULT_MAX_TARGET_URL_LENGTH = 8192;
const MAX_TARGET_URL_LENGTH = 32768;
const DEFAULT_VISIT_RETENTION_DAYS = 90;
const DEFAULT_EXPIRES_IN_DAYS = 90;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 32 };

export type ShortLinkSettingsRecord = typeof shortLinkSettings.$inferSelect;
export type ShortLinkRecord = typeof shortLinks.$inferSelect;
export type ShortLinkVisitRecord = typeof shortLinkVisits.$inferSelect;
export type ShortLinkProfileRecord = Pick<typeof promoShareProfiles.$inferSelect, 'id' | 'publicId' | 'name' | 'status'>;

export type PublicShortLinkSettings = {
    enabled: boolean;
    creationMode: ShortLinkCreationMode;
    passphraseRequired: boolean;
    codeLength: number;
    minCodeLength: number;
    maxCodeLength: number;
    maxTargetUrlLength: number;
    allowSensitiveTargets: boolean;
    allowInlineSecurePassword: boolean;
};

export type ShortLinkTargetSummary = {
    origin: string;
    path: string;
    encryptedShare: boolean;
    hasInlinePassword: boolean;
    hasApiKey: boolean;
    hasSyncConfig: boolean;
    hasPrompt: boolean;
    hasModel: boolean;
    hasBaseUrl: boolean;
    hasPromoProfileId: boolean;
    hasAutostart: boolean;
};

export type ShortLinkCreateInput = {
    targetUrl: string;
    clientRequestId?: string | null;
    creationPassphrase?: string | null;
    requestedCode?: string | null;
    note?: string | null;
    expiresAt?: Date | string | number | null;
    promoMode?: ShortLinkPromoMode;
    promoProfileId?: string | null;
    maxVisits?: number | null;
};

export type ShortLinkUpdateInput = {
    note?: string | null;
    status?: ShortLinkStatus;
    expiresAt?: Date | string | number | null;
    maxVisits?: number | null;
    promoMode?: ShortLinkPromoMode;
    promoProfileId?: string | null;
    targetUrl?: string | null;
};

export type ShortLinkSettingsUpdateInput = {
    enabled?: boolean;
    creationMode?: ShortLinkCreationMode;
    passphrase?: string | null;
    codeLength?: number;
    defaultExpiresInDays?: number;
    maxTargetUrlLength?: number;
    allowSensitiveTargets?: boolean;
    allowInlineSecurePassword?: boolean;
    allowedOrigins?: string[];
    visitRetentionDays?: number;
};

export type ShortLinkListItem = ShortLinkRecord & {
    promoProfile: ShortLinkProfileRecord | null;
};

export type ShortLinkStats = {
    totalVisits: number;
    uniqueVisitors: number;
    todayVisits: number;
    sevenDayVisits: number;
    thirtyDayVisits: number;
    lastVisitedAt: Date | null;
    referers: Array<{ refererHost: string; count: number }>;
    devices: Array<{ deviceType: string; count: number }>;
    recentVisits: ShortLinkVisitRecord[];
};

type ValidatedTarget = {
    normalizedUrl: string;
    summary: ShortLinkTargetSummary;
    warnings: string[];
};

type RedirectResult =
    | { ok: true; url: string; link: ShortLinkRecord }
    | { ok: false; status: 404 | 410; reason: 'not_found' | 'disabled' | 'expired' | 'limit_exceeded' };

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
    if (!value) return fallback;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
}

function parseNumber(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function parseNullableDate(value: Date | string | number | null | undefined): Date | null {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeNullableText(value: string | null | undefined, max = 500): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return sanitizePlainText(trimmed).slice(0, max);
}

function parseJsonArray(value: string | null | undefined): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    } catch {
        return [];
    }
}

function normalizeOrigin(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    try {
        return new URL(trimmed).origin;
    } catch {
        try {
            return new URL(`https://${trimmed}`).origin;
        } catch {
            return null;
        }
    }
}

function getConfiguredOrigins(): string[] {
    return [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_APP_URL, process.env.AUTH_BASE_URL].flatMap(
        (value) => {
            const origin = normalizeOrigin(value);
            return origin ? [origin] : [];
        }
    );
}

function firstHeaderValue(value: string | null): string {
    return value?.split(',')[0]?.trim() || '';
}

function getRequestIp(request: Request): string {
    return (
        firstHeaderValue(request.headers.get('x-forwarded-for')) ||
        firstHeaderValue(request.headers.get('x-real-ip')) ||
        firstHeaderValue(request.headers.get('cf-connecting-ip')) ||
        'unknown'
    );
}

function getRequestOrigin(request: NextRequest): string {
    return request.nextUrl.origin;
}

function getPublicSiteOrigin(request: NextRequest): string {
    return normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) || normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) || request.nextUrl.origin;
}

function normalizeCreationMode(value: string | null | undefined): ShortLinkCreationMode {
    return value === 'admin' || value === 'passphrase' || value === 'public' || value === 'disabled'
        ? value
        : 'disabled';
}

function normalizePromoMode(value: string | null | undefined): ShortLinkPromoMode {
    return value === 'none' || value === 'override' || value === 'inherit' ? value : 'inherit';
}

function normalizeStatus(value: string | null | undefined): ShortLinkStatus {
    return value === 'active' || value === 'disabled' || value === 'deleted' ? value : 'active';
}

function serializeAllowedOrigins(origins: string[] | null | undefined): string {
    const normalized = Array.from(
        new Set((origins || []).flatMap((value) => {
            const origin = normalizeOrigin(value);
            return origin ? [origin] : [];
        }))
    );
    return JSON.stringify(normalized.slice(0, 50));
}

function getDefaultSettingsValues(): typeof shortLinkSettings.$inferInsert {
    const codeLength = parseNumber(process.env.SHORT_LINK_CODE_LENGTH, DEFAULT_CODE_LENGTH, MIN_CODE_LENGTH, MAX_CODE_LENGTH);
    const creationMode = normalizeCreationMode(process.env.SHORT_LINK_CREATION_MODE);
    const enabled = parseBooleanEnv(process.env.SHORT_LINK_ENABLED, false);
    return {
        id: SETTINGS_ID,
        enabled,
        creationMode: enabled ? creationMode : 'disabled',
        codeLength,
        defaultExpiresInDays: parseNumber(process.env.SHORT_LINK_DEFAULT_EXPIRES_DAYS, DEFAULT_EXPIRES_IN_DAYS, 0, 3650),
        maxTargetUrlLength: parseNumber(
            process.env.SHORT_LINK_MAX_TARGET_URL_LENGTH,
            DEFAULT_MAX_TARGET_URL_LENGTH,
            512,
            MAX_TARGET_URL_LENGTH
        ),
        allowSensitiveTargets: parseBooleanEnv(process.env.SHORT_LINK_ALLOW_SENSITIVE_TARGETS, false),
        allowInlineSecurePassword: parseBooleanEnv(process.env.SHORT_LINK_ALLOW_INLINE_PASSWORD, false),
        allowedOriginsJson: serializeAllowedOrigins(getConfiguredOrigins()),
        visitRetentionDays: parseNumber(process.env.SHORT_LINK_VISIT_RETENTION_DAYS, DEFAULT_VISIT_RETENTION_DAYS, 1, 3650)
    };
}

export async function ensureShortLinkSettings(): Promise<ShortLinkSettingsRecord> {
    const db = await getServerDatabaseReady();
    const [existing] = await db.select().from(shortLinkSettings).where(eq(shortLinkSettings.id, SETTINGS_ID)).limit(1);
    if (existing) return existing;
    const [created] = await db.insert(shortLinkSettings).values(getDefaultSettingsValues()).returning();
    return created;
}

export async function getPublicShortLinkSettings(): Promise<PublicShortLinkSettings> {
    const settings = await ensureShortLinkSettings();
    return {
        enabled: settings.enabled,
        creationMode: settings.creationMode,
        passphraseRequired: settings.enabled && settings.creationMode === 'passphrase',
        codeLength: settings.codeLength,
        minCodeLength: MIN_CODE_LENGTH,
        maxCodeLength: MAX_CODE_LENGTH,
        maxTargetUrlLength: settings.maxTargetUrlLength,
        allowSensitiveTargets: settings.allowSensitiveTargets,
        allowInlineSecurePassword: settings.allowInlineSecurePassword
    };
}

export async function getShortLinkSettingsAdmin(): Promise<ShortLinkSettingsRecord & { passphraseConfigured: boolean; allowedOrigins: string[] }> {
    const settings = await ensureShortLinkSettings();
    return {
        ...settings,
        passphraseConfigured: Boolean(settings.passphraseHash),
        allowedOrigins: parseJsonArray(settings.allowedOriginsJson)
    };
}

function getPassphrasePepper(): string {
    return process.env.SHORT_LINK_PASSPHRASE_PEPPER || process.env.BETTER_AUTH_SECRET || process.env.ADMIN_BOOTSTRAP_SECRET || 'gpt-image-playground-short-link-dev';
}

function hashPassphrase(passphrase: string): string {
    const salt = crypto.randomBytes(16).toString('base64url');
    const peppered = `${passphrase}\0${getPassphrasePepper()}`;
    const hash = crypto
        .scryptSync(peppered, salt, SCRYPT_PARAMS.keylen, {
            N: SCRYPT_PARAMS.N,
            r: SCRYPT_PARAMS.r,
            p: SCRYPT_PARAMS.p
        })
        .toString('base64url');
    return `scrypt:v1:${salt}:${hash}`;
}

function verifyPassphrase(stored: string | null, passphrase: string | null | undefined): boolean {
    const provided = passphrase?.trim();
    if (!stored || !provided) return false;
    const parts = stored.split(':');
    if (parts.length !== 4 || parts[0] !== 'scrypt' || parts[1] !== 'v1') return false;
    const [, , salt, expectedHash] = parts;
    const peppered = `${provided}\0${getPassphrasePepper()}`;
    const actualHash = crypto
        .scryptSync(peppered, salt, SCRYPT_PARAMS.keylen, {
            N: SCRYPT_PARAMS.N,
            r: SCRYPT_PARAMS.r,
            p: SCRYPT_PARAMS.p
        })
        .toString('base64url');
    return constantTimeEqual(actualHash, expectedHash);
}

function getTargetEncryptionSecret(): string | null {
    return (
        process.env.SHORT_LINK_TARGET_SECRET?.trim() ||
        process.env.BETTER_AUTH_SECRET?.trim() ||
        process.env.ADMIN_BOOTSTRAP_SECRET?.trim() ||
        null
    );
}

function encryptTargetUrl(targetUrl: string): string {
    const secret = getTargetEncryptionSecret();
    if (!secret) return `plain:${Buffer.from(targetUrl, 'utf8').toString('base64url')}`;
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(targetUrl, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

function decryptTargetUrl(storedTargetUrl: string): string {
    if (storedTargetUrl.startsWith('plain:')) {
        return Buffer.from(storedTargetUrl.slice('plain:'.length), 'base64url').toString('utf8');
    }
    if (!storedTargetUrl.startsWith('enc:v1:')) return storedTargetUrl;
    const secret = getTargetEncryptionSecret();
    if (!secret) throw new Error('短链目标加密密钥未配置，无法读取目标 URL。');
    const [, , ivRaw, tagRaw, ciphertextRaw] = storedTargetUrl.split(':');
    if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error('短链目标 URL 存储格式无效。');
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, 'base64url')), decipher.final()]).toString('utf8');
}

function generateShortCode(length: number): string {
    const maxFairByte = Math.floor(256 / SHORT_CODE_ALPHABET.length) * SHORT_CODE_ALPHABET.length;
    let result = '';
    while (result.length < length) {
        const bytes = crypto.randomBytes(length);
        for (const byte of bytes) {
            if (byte >= maxFairByte) continue;
            result += SHORT_CODE_ALPHABET[byte % SHORT_CODE_ALPHABET.length];
            if (result.length === length) break;
        }
    }
    return result;
}

export function normalizeShortCode(value: string | null | undefined): string {
    return value?.trim() || '';
}

export function isValidShortCode(value: string): boolean {
    return /^[A-Za-z0-9_-]{4,64}$/u.test(value) && !SHORT_CODE_RESERVED.has(value.toLowerCase());
}

function normalizeRequestedCode(value: string | null | undefined): string | null {
    const code = normalizeShortCode(value);
    if (!code) return null;
    if (!isValidShortCode(code)) {
        throw new Error('自定义短码只能包含字母、数字、下划线或短横线，且不能使用保留路径。');
    }
    return code;
}

function getAllowedTargetOrigins(settings: ShortLinkSettingsRecord, request: NextRequest): Set<string> {
    return new Set([getRequestOrigin(request), ...getConfiguredOrigins(), ...parseJsonArray(settings.allowedOriginsJson)]);
}

function hasQueryParam(searchParams: URLSearchParams, keys: string[]): boolean {
    return keys.some((key) => searchParams.has(key));
}

function hasShareSignal(url: URL): boolean {
    const { parsed, consumed } = parseUrlParams(url.search);
    return Boolean(
        getSecureSharePayload(url.search) ||
            parsed.promoProfileId ||
            consumed.prompt ||
            consumed.apiKey ||
            consumed.baseUrl ||
            consumed.model ||
            consumed.providerInstanceId ||
            consumed.syncConfig ||
            (consumed.autostart && parsed.prompt)
    );
}

function summarizeTarget(url: URL): ShortLinkTargetSummary {
    const { parsed, consumed } = parseUrlParams(url.search);
    const encryptedShare = Boolean(getSecureSharePayload(url.search));
    return {
        origin: url.origin,
        path: url.pathname || '/',
        encryptedShare,
        hasInlinePassword: hasQueryParam(new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash), ['key']),
        hasApiKey: consumed.apiKey,
        hasSyncConfig: Boolean(consumed.syncConfig),
        hasPrompt: consumed.prompt,
        hasModel: consumed.model,
        hasBaseUrl: consumed.baseUrl,
        hasPromoProfileId: Boolean(parsed.promoProfileId),
        hasAutostart: consumed.autostart
    };
}

export function parseTargetSummary(value: string): ShortLinkTargetSummary | null {
    try {
        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed as ShortLinkTargetSummary;
    } catch {
        return null;
    }
}

function validateTargetUrlForShortLink(
    inputTargetUrl: string,
    settings: ShortLinkSettingsRecord,
    request: NextRequest
): ValidatedTarget {
    const trimmed = inputTargetUrl.trim();
    if (!trimmed) throw new Error('目标分享链接不能为空。');
    if (trimmed.length > settings.maxTargetUrlLength) {
        throw new Error(`目标分享链接不能超过 ${settings.maxTargetUrlLength} 个字符。`);
    }

    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        throw new Error('目标分享链接格式无效。');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('短链目标只支持 http 或 https 链接。');
    }
    if (url.username || url.password) {
        throw new Error('短链目标不允许包含用户名或密码。');
    }

    const allowedOrigins = getAllowedTargetOrigins(settings, request);
    if (!allowedOrigins.has(url.origin)) {
        throw new Error('只能为当前站点或后台允许域名的分享链接创建短链。');
    }

    if (/^\/s\/[^/]+/u.test(url.pathname)) {
        throw new Error('短链不能指向另一个短链。');
    }

    if (!hasShareSignal(url)) {
        throw new Error('目标链接不是可识别的分享链接。');
    }

    const { parsed } = parseUrlParams(url.search);
    if (parsed.baseUrl) {
        const safety = validatePublicHttpBaseUrl(parsed.baseUrl);
        if (!safety.ok) throw new Error(safety.reason);
    }

    const summary = summarizeTarget(url);
    const warnings: string[] = [];

    if (summary.encryptedShare) warnings.push('encrypted-share');
    if (summary.hasApiKey || summary.hasSyncConfig) {
        warnings.push('sensitive-target');
        if (!settings.allowSensitiveTargets) {
            throw new Error('短链默认不保存明文 API Key 或云存储配置，请改用密码加密分享。');
        }
    }
    if (summary.hasInlinePassword) {
        warnings.push('inline-password-stored');
    }

    return { normalizedUrl: url.toString(), summary, warnings };
}

function getDefaultExpiresAt(settings: ShortLinkSettingsRecord, requested: Date | string | number | null | undefined): Date | null {
    const explicit = parseNullableDate(requested);
    if (explicit) return explicit;
    if (settings.defaultExpiresInDays <= 0) return null;
    return new Date(Date.now() + settings.defaultExpiresInDays * 24 * 60 * 60 * 1000);
}

async function generateAvailableCode(length: number): Promise<string> {
    const db = await getServerDatabaseReady();
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = generateShortCode(length);
        const [existing] = await db.select({ id: shortLinks.id }).from(shortLinks).where(eq(shortLinks.code, code)).limit(1);
        if (!existing) return code;
    }
    return generateShortCode(length + 2);
}

function getShortUrl(request: NextRequest, code: string): string {
    const origin = getPublicSiteOrigin(request);
    return `${origin}/s/${encodeURIComponent(code)}`;
}

function getClientRateLimitKey(request: NextRequest, scope: string): string {
    return `${scope}:${getRequestIp(request)}:${request.headers.get('user-agent') || ''}`;
}

function getCreationKeyHash(passphrase: string | null | undefined): string | null {
    const trimmed = passphrase?.trim();
    return trimmed ? hashSha256Hex(`${trimmed}\0${getPassphrasePepper()}`) : null;
}

async function insertShortLink(
    request: NextRequest,
    input: ShortLinkCreateInput,
    settings: ShortLinkSettingsRecord,
    createdByType: 'admin' | 'passphrase' | 'public',
    actor?: PromoAdminActor
): Promise<{ link: ShortLinkRecord; shortUrl: string; warnings: string[] }> {
    const db = await getServerDatabaseReady();
    const validated = validateTargetUrlForShortLink(input.targetUrl, settings, request);
    const targetUrlHash = hashSha256Hex(validated.normalizedUrl);
    const clientRequestId = normalizeNullableText(input.clientRequestId, 160);

    if (clientRequestId) {
        const [existing] = await db.select().from(shortLinks).where(eq(shortLinks.clientRequestId, clientRequestId)).limit(1);
        if (existing) {
            return { link: existing, shortUrl: getShortUrl(request, existing.code), warnings: validated.warnings };
        }
    }

    const requestedCode = actor ? normalizeRequestedCode(input.requestedCode) : null;
    const codeLength = parseNumber(settings.codeLength, DEFAULT_CODE_LENGTH, MIN_CODE_LENGTH, MAX_CODE_LENGTH);
    const code = requestedCode || (await generateAvailableCode(codeLength));
    const [existingCode] = await db.select({ id: shortLinks.id }).from(shortLinks).where(eq(shortLinks.code, code)).limit(1);
    if (existingCode) throw new Error('短码已被占用。');

    const promoMode = normalizePromoMode(input.promoMode);
    const promoProfileId = promoMode === 'override' ? input.promoProfileId?.trim() || null : null;
    if (promoMode === 'override' && !promoProfileId) throw new Error('绑定推荐内容时必须选择分享 Profile。');

    const [created] = await db
        .insert(shortLinks)
        .values({
            id: randomToken(16),
            code,
            targetUrl: encryptTargetUrl(validated.normalizedUrl),
            targetUrlHash,
            targetSummaryJson: JSON.stringify(validated.summary),
            status: 'active',
            promoMode,
            promoProfileId,
            note: normalizeNullableText(input.note),
            createdByUserId: actor?.userId || null,
            createdByType,
            creationKeyHash: createdByType === 'passphrase' ? getCreationKeyHash(input.creationPassphrase) : null,
            expiresAt: getDefaultExpiresAt(settings, input.expiresAt),
            maxVisits: input.maxVisits && input.maxVisits > 0 ? Math.floor(input.maxVisits) : null,
            clientRequestId
        })
        .returning();

    await recordAuditLog({
        actorUserId: actor?.userId || null,
        actorType: actor ? 'user' : createdByType,
        action: 'short_link_create',
        targetType: 'short_link',
        targetId: created.id,
        ip: getRequestIp(request),
        userAgent: request.headers.get('user-agent'),
        metadata: {
            code: created.code,
            createdByType,
            warnings: validated.warnings,
            targetSummary: validated.summary
        }
    });

    return { link: created, shortUrl: getShortUrl(request, created.code), warnings: validated.warnings };
}

export async function createPublicShortLink(
    request: NextRequest,
    input: ShortLinkCreateInput
): Promise<{ link: ShortLinkRecord; shortUrl: string; warnings: string[] }> {
    const settings = await ensureShortLinkSettings();
    if (!settings.enabled || settings.creationMode === 'disabled' || settings.creationMode === 'admin') {
        throw new Error('短链功能当前未开放创建。');
    }

    const rateLimit = checkInMemoryRateLimit(getClientRateLimitKey(request, 'short-link-create'), 10, 60 * 60 * 1000);
    if (!rateLimit.ok) throw new Error('创建短链过于频繁，请稍后再试。');

    if (settings.creationMode === 'passphrase' && !verifyPassphrase(settings.passphraseHash, input.creationPassphrase)) {
        checkInMemoryRateLimit(getClientRateLimitKey(request, 'short-link-passphrase-failed'), 5, 10 * 60 * 1000);
        throw new Error('无法创建短链，请检查口令或稍后再试。');
    }

    return insertShortLink(request, input, settings, settings.creationMode === 'public' ? 'public' : 'passphrase');
}

export async function createAdminShortLink(
    request: NextRequest,
    input: ShortLinkCreateInput,
    actor: PromoAdminActor
): Promise<{ link: ShortLinkRecord; shortUrl: string; warnings: string[] }> {
    const settings = await ensureShortLinkSettings();
    return insertShortLink(request, input, settings, 'admin', actor);
}

export async function updateShortLinkSettingsAdmin(
    input: ShortLinkSettingsUpdateInput,
    actor: PromoAdminActor
): Promise<ShortLinkSettingsRecord & { passphraseConfigured: boolean; allowedOrigins: string[] }> {
    const db = await getServerDatabaseReady();
    await ensureShortLinkSettings();
    const patch: Partial<typeof shortLinkSettings.$inferInsert> = {
        updatedAt: new Date()
    };
    if (input.enabled !== undefined) patch.enabled = input.enabled;
    if (input.creationMode !== undefined) patch.creationMode = input.creationMode;
    if (input.passphrase !== undefined) {
        const passphrase = input.passphrase?.trim();
        patch.passphraseHash = passphrase ? hashPassphrase(passphrase) : null;
    }
    if (input.codeLength !== undefined) {
        patch.codeLength = parseNumber(input.codeLength, DEFAULT_CODE_LENGTH, MIN_CODE_LENGTH, MAX_CODE_LENGTH);
    }
    if (input.defaultExpiresInDays !== undefined) {
        patch.defaultExpiresInDays = parseNumber(input.defaultExpiresInDays, DEFAULT_EXPIRES_IN_DAYS, 0, 3650);
    }
    if (input.maxTargetUrlLength !== undefined) {
        patch.maxTargetUrlLength = parseNumber(input.maxTargetUrlLength, DEFAULT_MAX_TARGET_URL_LENGTH, 512, MAX_TARGET_URL_LENGTH);
    }
    if (input.allowSensitiveTargets !== undefined) patch.allowSensitiveTargets = input.allowSensitiveTargets;
    if (input.allowInlineSecurePassword !== undefined) patch.allowInlineSecurePassword = input.allowInlineSecurePassword;
    if (input.allowedOrigins !== undefined) patch.allowedOriginsJson = serializeAllowedOrigins(input.allowedOrigins);
    if (input.visitRetentionDays !== undefined) {
        patch.visitRetentionDays = parseNumber(input.visitRetentionDays, DEFAULT_VISIT_RETENTION_DAYS, 1, 3650);
    }

    const [updated] = await db
        .update(shortLinkSettings)
        .set(patch)
        .where(eq(shortLinkSettings.id, SETTINGS_ID))
        .returning();

    await recordAuditLog({
        actorUserId: actor.userId,
        actorType: 'user',
        action: 'short_link_settings_update',
        targetType: 'short_link_settings',
        targetId: SETTINGS_ID,
        ip: getRequestIp(actor.request),
        userAgent: actor.request.headers.get('user-agent'),
        metadata: {
            enabled: updated.enabled,
            creationMode: updated.creationMode,
            codeLength: updated.codeLength
        }
    });

    return getShortLinkSettingsAdmin();
}

export async function listShortLinksAdmin(): Promise<ShortLinkListItem[]> {
    const db = await getServerDatabaseReady();
    const [links, profiles] = await Promise.all([
        db.select().from(shortLinks).orderBy(desc(shortLinks.createdAt)),
        db.select().from(promoShareProfiles)
    ]);
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    return links.map((link) => ({
        ...link,
        promoProfile: link.promoProfileId ? profileById.get(link.promoProfileId) || null : null
    }));
}

export async function getShortLinkAdmin(id: string): Promise<ShortLinkListItem | null> {
    const db = await getServerDatabaseReady();
    const [link] = await db.select().from(shortLinks).where(eq(shortLinks.id, sanitizePlainText(id))).limit(1);
    if (!link) return null;
    const [profile] = link.promoProfileId
        ? await db.select().from(promoShareProfiles).where(eq(promoShareProfiles.id, link.promoProfileId)).limit(1)
        : [];
    return { ...link, promoProfile: profile || null };
}

export function getShortLinkTargetPreview(link: ShortLinkRecord): string {
    const targetUrl = decryptTargetUrl(link.targetUrl);
    const url = new URL(targetUrl);
    for (const key of ['apiKey', 'apikey', 'syncConfig', 'sync']) {
        if (url.searchParams.has(key)) url.searchParams.set(key, '***');
    }
    if (url.hash) {
        const hashParams = new URLSearchParams(url.hash.slice(1));
        if (hashParams.has('key')) {
            hashParams.set('key', '***');
            url.hash = hashParams.toString();
        }
    }
    return url.toString();
}

export async function updateShortLinkAdmin(
    request: NextRequest,
    id: string,
    input: ShortLinkUpdateInput,
    actor: PromoAdminActor
): Promise<ShortLinkRecord | null> {
    const db = await getServerDatabaseReady();
    const [current] = await db.select().from(shortLinks).where(eq(shortLinks.id, sanitizePlainText(id))).limit(1);
    if (!current) return null;

    const patch: Partial<typeof shortLinks.$inferInsert> = {
        updatedAt: new Date()
    };
    if (input.note !== undefined) patch.note = normalizeNullableText(input.note);
    if (input.status !== undefined) patch.status = normalizeStatus(input.status);
    if (input.expiresAt !== undefined) patch.expiresAt = parseNullableDate(input.expiresAt);
    if (input.maxVisits !== undefined) {
        patch.maxVisits = input.maxVisits && input.maxVisits > 0 ? Math.floor(input.maxVisits) : null;
    }
    if (input.promoMode !== undefined) {
        patch.promoMode = normalizePromoMode(input.promoMode);
        patch.promoProfileId = patch.promoMode === 'override' ? input.promoProfileId?.trim() || null : null;
    } else if (input.promoProfileId !== undefined) {
        patch.promoProfileId = current.promoMode === 'override' ? input.promoProfileId?.trim() || null : null;
    }

    if (input.targetUrl !== undefined && input.targetUrl !== null && input.targetUrl.trim()) {
        const settings = await ensureShortLinkSettings();
        const validated = validateTargetUrlForShortLink(input.targetUrl, settings, request);
        patch.targetUrl = encryptTargetUrl(validated.normalizedUrl);
        patch.targetUrlHash = hashSha256Hex(validated.normalizedUrl);
        patch.targetSummaryJson = JSON.stringify(validated.summary);
    }

    const [updated] = await db.update(shortLinks).set(patch).where(eq(shortLinks.id, current.id)).returning();

    await recordAuditLog({
        actorUserId: actor.userId,
        actorType: 'user',
        action: 'short_link_update',
        targetType: 'short_link',
        targetId: current.id,
        ip: getRequestIp(request),
        userAgent: request.headers.get('user-agent'),
        metadata: {
            code: current.code,
            status: updated.status,
            promoMode: updated.promoMode
        }
    });

    return updated;
}

export async function deleteShortLinkAdmin(id: string, actor: PromoAdminActor): Promise<boolean> {
    const db = await getServerDatabaseReady();
    const [current] = await db.select().from(shortLinks).where(eq(shortLinks.id, sanitizePlainText(id))).limit(1);
    if (!current) return false;
    await db
        .update(shortLinks)
        .set({ status: 'deleted', updatedAt: new Date() })
        .where(eq(shortLinks.id, current.id));
    await recordAuditLog({
        actorUserId: actor.userId,
        actorType: 'user',
        action: 'short_link_delete',
        targetType: 'short_link',
        targetId: current.id,
        ip: getRequestIp(actor.request),
        userAgent: actor.request.headers.get('user-agent'),
        metadata: { code: current.code }
    });
    return true;
}

function parseUserAgent(userAgent: string | null): { deviceType: string; browser: string | null; os: string | null } {
    const ua = userAgent || '';
    const isBot = /bot|crawl|spider|slurp|bingpreview/i.test(ua);
    const deviceType = isBot ? 'bot' : /ipad|tablet/i.test(ua) ? 'tablet' : /android|iphone|mobile/i.test(ua) ? 'mobile' : ua ? 'desktop' : 'unknown';
    const browser = /edg\//i.test(ua)
        ? 'Edge'
        : /chrome\//i.test(ua)
          ? 'Chrome'
          : /safari\//i.test(ua)
            ? 'Safari'
            : /firefox\//i.test(ua)
              ? 'Firefox'
              : null;
    const os = /windows/i.test(ua)
        ? 'Windows'
        : /mac os|macintosh/i.test(ua)
          ? 'macOS'
          : /android/i.test(ua)
            ? 'Android'
            : /iphone|ipad|ios/i.test(ua)
              ? 'iOS'
              : /linux/i.test(ua)
                ? 'Linux'
                : null;
    return { deviceType, browser, os };
}

function getRefererHost(request: NextRequest): string | null {
    const referer = request.headers.get('referer');
    if (!referer) return null;
    try {
        return new URL(referer).host.slice(0, 160);
    } catch {
        return null;
    }
}

function hashVisitorValue(value: string): string {
    const salt = process.env.SHORT_LINK_VISIT_SALT || process.env.BETTER_AUTH_SECRET || 'gpt-image-playground-short-link-visits';
    return hashSha256Hex(`${value}\0${salt}`);
}

async function recordShortLinkVisit(
    request: NextRequest,
    link: ShortLinkRecord,
    status: 'redirected' | 'expired' | 'disabled' | 'limit_exceeded',
    method = 'GET'
): Promise<void> {
    const db = await getServerDatabaseReady();
    const userAgent = request.headers.get('user-agent') || '';
    const ipHash = hashVisitorValue(getRequestIp(request));
    const userAgentHash = userAgent ? hashVisitorValue(userAgent) : null;
    const { deviceType, browser, os } = parseUserAgent(userAgent);
    const now = new Date();
    const [existingVisitor] = await db
        .select({ id: shortLinkVisits.id })
        .from(shortLinkVisits)
        .where(
            and(
                eq(shortLinkVisits.shortLinkId, link.id),
                eq(shortLinkVisits.ipHash, ipHash),
                userAgentHash ? eq(shortLinkVisits.userAgentHash, userAgentHash) : sql`${shortLinkVisits.userAgentHash} IS NULL`
            )
        )
        .limit(1);

    await db.insert(shortLinkVisits).values({
        id: randomToken(16),
        shortLinkId: link.id,
        visitedAt: now,
        ipHash,
        userAgentHash,
        refererHost: getRefererHost(request),
        deviceType,
        browser,
        os,
        method,
        status
    });

    await db
        .update(shortLinks)
        .set({
            visitCount: sql`${shortLinks.visitCount} + 1`,
            uniqueVisitorCount: existingVisitor ? sql`${shortLinks.uniqueVisitorCount}` : sql`${shortLinks.uniqueVisitorCount} + 1`,
            lastVisitedAt: now,
            updatedAt: new Date()
        })
        .where(eq(shortLinks.id, link.id));
}

async function applyPromoMode(targetUrl: string, link: ShortLinkRecord): Promise<string> {
    const url = new URL(targetUrl);
    if (link.promoMode === 'inherit') return url.toString();
    if (link.promoMode === 'none') {
        url.searchParams.delete('promoProfileId');
        return url.toString();
    }
    if (!link.promoProfileId) return url.toString();
    const db = await getServerDatabaseReady();
    const [profile] = await db.select().from(promoShareProfiles).where(eq(promoShareProfiles.id, link.promoProfileId)).limit(1);
    if (!profile || profile.status !== 'active') {
        url.searchParams.delete('promoProfileId');
        return url.toString();
    }
    url.searchParams.set('promoProfileId', profile.publicId);
    return url.toString();
}

export async function resolveShortLinkRedirect(
    request: NextRequest,
    code: string,
    method = 'GET'
): Promise<RedirectResult> {
    const normalizedCode = normalizeShortCode(code);
    if (!isValidShortCode(normalizedCode)) return { ok: false, status: 404, reason: 'not_found' };

    const rateLimit = checkInMemoryRateLimit(getClientRateLimitKey(request, 'short-link-open'), 300, 10 * 60 * 1000);
    if (!rateLimit.ok) return { ok: false, status: 404, reason: 'not_found' };

    const db = await getServerDatabaseReady();
    const [link] = await db.select().from(shortLinks).where(eq(shortLinks.code, normalizedCode)).limit(1);
    if (!link || link.status === 'deleted') return { ok: false, status: 404, reason: 'not_found' };

    if (link.status !== 'active') {
        await recordShortLinkVisit(request, link, 'disabled', method).catch(() => undefined);
        return { ok: false, status: 410, reason: 'disabled' };
    }
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
        await recordShortLinkVisit(request, link, 'expired', method).catch(() => undefined);
        return { ok: false, status: 410, reason: 'expired' };
    }
    if (link.maxVisits && link.visitCount >= link.maxVisits) {
        await recordShortLinkVisit(request, link, 'limit_exceeded', method).catch(() => undefined);
        return { ok: false, status: 410, reason: 'limit_exceeded' };
    }

    const targetUrl = await applyPromoMode(decryptTargetUrl(link.targetUrl), link);
    if (method !== 'HEAD') {
        await recordShortLinkVisit(request, link, 'redirected', method).catch(() => undefined);
    }
    return { ok: true, url: targetUrl, link };
}

function sinceDate(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getShortLinkStats(id: string): Promise<ShortLinkStats> {
    const db = await getServerDatabaseReady();
    const [link] = await db.select().from(shortLinks).where(eq(shortLinks.id, sanitizePlainText(id))).limit(1);
    if (!link) {
        return {
            totalVisits: 0,
            uniqueVisitors: 0,
            todayVisits: 0,
            sevenDayVisits: 0,
            thirtyDayVisits: 0,
            lastVisitedAt: null,
            referers: [],
            devices: [],
            recentVisits: []
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayRows, sevenRows, thirtyRows, recentVisits] = await Promise.all([
        db
            .select({ count: count() })
            .from(shortLinkVisits)
            .where(and(eq(shortLinkVisits.shortLinkId, link.id), gte(shortLinkVisits.visitedAt, today))),
        db
            .select({ count: count() })
            .from(shortLinkVisits)
            .where(and(eq(shortLinkVisits.shortLinkId, link.id), gte(shortLinkVisits.visitedAt, sinceDate(7)))),
        db
            .select({ count: count() })
            .from(shortLinkVisits)
            .where(and(eq(shortLinkVisits.shortLinkId, link.id), gte(shortLinkVisits.visitedAt, sinceDate(30)))),
        db
            .select()
            .from(shortLinkVisits)
            .where(eq(shortLinkVisits.shortLinkId, link.id))
            .orderBy(desc(shortLinkVisits.visitedAt))
            .limit(50)
    ]);

    const refererCounts = new Map<string, number>();
    const deviceCounts = new Map<string, number>();
    for (const visit of recentVisits) {
        refererCounts.set(visit.refererHost || 'direct', (refererCounts.get(visit.refererHost || 'direct') || 0) + 1);
        deviceCounts.set(visit.deviceType || 'unknown', (deviceCounts.get(visit.deviceType || 'unknown') || 0) + 1);
    }

    return {
        totalVisits: link.visitCount,
        uniqueVisitors: link.uniqueVisitorCount,
        todayVisits: Number(todayRows[0]?.count || 0),
        sevenDayVisits: Number(sevenRows[0]?.count || 0),
        thirtyDayVisits: Number(thirtyRows[0]?.count || 0),
        lastVisitedAt: link.lastVisitedAt,
        referers: Array.from(refererCounts, ([refererHost, countValue]) => ({ refererHost, count: countValue })).sort(
            (a, b) => b.count - a.count
        ),
        devices: Array.from(deviceCounts, ([deviceType, countValue]) => ({ deviceType, count: countValue })).sort(
            (a, b) => b.count - a.count
        ),
        recentVisits
    };
}
