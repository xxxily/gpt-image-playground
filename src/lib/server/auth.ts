import { and, count, eq, sql } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { hashPassword } from 'better-auth/crypto';
import { authAccounts, authSessions, authUsers, serverSchema } from '@/lib/server/schema';
import { ensureServerSchema, getServerDatabase } from '@/lib/server/db';
import { constantTimeEqual, hashSha256Hex, isValidAdminPassword, sanitizePlainText } from '@/lib/server/security';
import { recordAuditLog } from '@/lib/server/audit';
import {
    firstHeaderValue,
    getHeadersPublicOrigin,
    getRequestPublicOrigin,
    normalizeOrigin
} from '@/lib/server/request-origin';

type AdminUserRecord = {
    id: string;
    email: string;
    name: string;
    status?: string;
    role?: string;
    lastLoginAt?: Date | null;
};

type AdminAuth = {
    handler: (request: Request) => Promise<Response>;
    api: {
        getSession: (input: { headers: Headers }) => Promise<{ user?: AdminUserRecord | null } | null>;
    };
};

type AdminAuthBootstrapState = {
    hasOwner: boolean;
    ownerCount: number;
};

type AdminIdentity = {
    id: string;
    email: string;
    role: string;
    status: string;
    name: string;
};

const adminAuthSingleton = globalThis as typeof globalThis & {
    __adminAuthByOrigin?: Map<string, AdminAuth>;
};
const MAX_AUTH_ORIGIN_CACHE_SIZE = 20;

function getOriginHost(origin: string): string | null {
    try {
        return new URL(origin).host;
    } catch {
        return null;
    }
}

function getConfiguredAuthFallbackOrigin(): string {
    return (
        normalizeOrigin(process.env.AUTH_BASE_URL) ||
        normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
        normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
        'http://localhost:3000'
    );
}

function getAuthOrigin(source?: Request | Headers): string {
    if (source instanceof Request) return getRequestPublicOrigin(source);
    if (source instanceof Headers) return getHeadersPublicOrigin(source, getConfiguredAuthFallbackOrigin());
    return getConfiguredAuthFallbackOrigin();
}

function getTrustedAdminOrigins(authOrigin: string): (request?: Request) => string[] {
    return (request?: Request) => {
        const requestOrigin = request ? getRequestPublicOrigin(request) : null;
        return Array.from(new Set([authOrigin, requestOrigin].filter((origin): origin is string => Boolean(origin))));
    };
}

function getBootstrapSecret(): string {
    return process.env.ADMIN_BOOTSTRAP_SECRET || '';
}

async function getAuthUserByEmail(email: string): Promise<AdminIdentity | null> {
    await ensureServerSchema();
    const db = getServerDatabase();
    const normalizedEmail = email.trim();
    const [user] = await db
        .select()
        .from(authUsers)
        .where(sql`LOWER(${authUsers.email}) = LOWER(${normalizedEmail})`)
        .limit(1);
    if (!user) return null;
    return {
        id: user.id,
        email: user.email,
        role: String(user.role || 'viewer'),
        status: String(user.status || 'active'),
        name: user.name
    };
}

async function getOwnerCount(): Promise<number> {
    await ensureServerSchema();
    const db = getServerDatabase();
    const rows = await db.select({ count: count() }).from(authUsers).where(eq(authUsers.role, 'owner'));
    return Number(rows[0]?.count || 0);
}

async function touchLoginAt(userId: string): Promise<void> {
    await ensureServerSchema();
    const db = getServerDatabase();
    await db
        .update(authUsers)
        .set({ lastLoginAt: new Date() })
        .where(eq(authUsers.id, userId));
}

async function revokeUserSessions(userId: string): Promise<void> {
    await ensureServerSchema();
    const db = getServerDatabase();
    await db.delete(authSessions).where(eq(authSessions.userId, userId));
}

async function setAdminPassword(userId: string, password: string): Promise<void> {
    await ensureServerSchema();
    const db = getServerDatabase();
    const passwordHash = await hashPassword(password);
    await db
        .update(authAccounts)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, 'credential')));
}

function createAdminAuth(authOrigin: string): AdminAuth {
    return betterAuth({
        baseURL: authOrigin,
        trustedOrigins: getTrustedAdminOrigins(authOrigin),
        advanced: {
            trustedProxyHeaders: true
        },
        database: drizzleAdapter(getServerDatabase(), { provider: 'sqlite', schema: serverSchema, usePlural: false }),
        plugins: [nextCookies()],
        emailAndPassword: {
            enabled: true,
            minPasswordLength: 12
        },
        user: {
            additionalFields: {
                role: {
                    type: 'string',
                    defaultValue: 'viewer',
                    input: false
                },
                status: {
                    type: 'string',
                    defaultValue: 'active',
                    input: false
                },
                lastLoginAt: {
                    type: 'date',
                    input: false,
                    required: false
                }
            }
        },
        databaseHooks: {
            session: {
                create: {
                    after: async (session) => {
                        await touchLoginAt(session.userId);
                    }
                }
            }
        }
    });
}

export async function getAdminAuth(source?: Request | Headers): Promise<AdminAuth> {
    await ensureServerSchema();
    const authOrigin = getAuthOrigin(source);
    if (!adminAuthSingleton.__adminAuthByOrigin) {
        adminAuthSingleton.__adminAuthByOrigin = new Map();
    }
    const cached = adminAuthSingleton.__adminAuthByOrigin.get(authOrigin);
    if (cached) return cached;
    if (adminAuthSingleton.__adminAuthByOrigin.size >= MAX_AUTH_ORIGIN_CACHE_SIZE) {
        const oldestOrigin = adminAuthSingleton.__adminAuthByOrigin.keys().next().value;
        if (oldestOrigin) adminAuthSingleton.__adminAuthByOrigin.delete(oldestOrigin);
    }
    const auth = createAdminAuth(authOrigin);
    adminAuthSingleton.__adminAuthByOrigin.set(authOrigin, auth);
    return auth;
}

function withAuthHostFallback(headers: Headers): Headers {
    const nextHeaders = new Headers(headers);
    if (nextHeaders.has('host') || nextHeaders.has('x-forwarded-host')) return nextHeaders;

    const origin = getHeadersPublicOrigin(nextHeaders, getConfiguredAuthFallbackOrigin());
    const host = getOriginHost(origin);
    if (host) {
        nextHeaders.set('host', host);
        nextHeaders.set('x-forwarded-host', host);
    }
    if (!nextHeaders.has('x-forwarded-proto')) {
        const proto = firstHeaderValue(origin.split(':')[0] || '');
        nextHeaders.set('x-forwarded-proto', proto === 'http' ? 'http' : 'https');
    }
    return nextHeaders;
}

export async function getAdminSession(headers: Headers): Promise<AdminIdentity | null> {
    const authHeaders = withAuthHostFallback(headers);
    const auth = await getAdminAuth(authHeaders);
    const result = await auth.api.getSession({ headers: authHeaders });
    const user = result?.user;
    if (!user) return null;
    if (String(user.status || 'active') !== 'active') return null;
    return {
        id: user.id,
        email: user.email,
        role: String(user.role || 'viewer'),
        status: String(user.status || 'active'),
        name: user.name
    };
}

export async function requireAdminSession(headers: Headers): Promise<AdminIdentity> {
    const session = await getAdminSession(headers);
    if (!session) {
        throw new Error('ADMIN_SESSION_REQUIRED');
    }
    return session;
}

export async function getAdminBootstrapState(): Promise<AdminAuthBootstrapState> {
    const ownerCount = await getOwnerCount();
    return { hasOwner: ownerCount > 0, ownerCount };
}

export async function validateAdminBootstrapSecret(secret: string): Promise<boolean> {
    const configuredSecret = getBootstrapSecret();
    if (!configuredSecret) return false;
    return constantTimeEqual(hashSha256Hex(secret), hashSha256Hex(configuredSecret));
}

export async function bootstrapAdminOwner(input: {
    email: string;
    name: string;
    password: string;
    request: Request;
}): Promise<Response> {
    const auth = await getAdminAuth(input.request);
    const request = new Request(new URL('/api/auth/sign-up/email', input.request.url), {
        method: 'POST',
        headers: input.request.headers,
        body: JSON.stringify({
            email: input.email,
            name: input.name,
            password: input.password
        })
    });
    const response = await auth.handler(request);
    const payload = await response.clone().json().catch(() => null);
    const userId = payload?.user?.id;
    if (userId) {
        await ensureServerSchema();
        const db = getServerDatabase();
        await db
            .update(authUsers)
            .set({
                role: 'owner',
                status: 'active',
                lastLoginAt: new Date()
            })
            .where(eq(authUsers.id, userId));
        await recordAuditLog({
            actorUserId: userId,
            actorType: 'user',
            action: 'bootstrap_owner_create',
            targetType: 'user',
            targetId: userId,
            ip: input.request.headers.get('x-forwarded-for'),
            userAgent: input.request.headers.get('user-agent'),
            metadata: { email: sanitizePlainText(input.email) }
        });
    }
    return response;
}

export async function resetAdminPassword(input: {
    email: string;
    name?: string;
    password: string;
    request: Request;
}): Promise<Response> {
    const user = await getAuthUserByEmail(input.email);
    if (!user || user.role !== 'owner') {
        return Response.json({ error: '未找到可重置的 owner 账号。' }, { status: 404 });
    }
    if (!isValidAdminPassword(input.password)) {
        return Response.json({ error: '管理员密码至少需要 12 位。' }, { status: 400 });
    }

    await setAdminPassword(user.id, input.password);
    await revokeUserSessions(user.id);
    await ensureServerSchema();
    const db = getServerDatabase();
    await db
        .update(authUsers)
        .set({
            name: sanitizePlainText(input.name || user.name),
            status: 'active',
            lastLoginAt: new Date()
        })
        .where(eq(authUsers.id, user.id));
    await recordAuditLog({
        actorUserId: user.id,
        actorType: 'user',
        action: 'bootstrap_owner_reset_password',
        targetType: 'user',
        targetId: user.id,
        ip: input.request.headers.get('x-forwarded-for'),
        userAgent: input.request.headers.get('user-agent'),
        metadata: { email: sanitizePlainText(input.email) }
    });
    return Response.json({ ok: true });
}

export async function loginAdmin(input: {
    email: string;
    password: string;
    request: Request;
}): Promise<Response> {
    const user = await getAuthUserByEmail(input.email);
    if (!user) {
        return Response.json({ error: '账号或密码不正确。' }, { status: 401 });
    }
    if (user.status !== 'active') {
        return Response.json({ error: '管理员账号已被禁用。' }, { status: 403 });
    }

    const auth = await getAdminAuth(input.request);
    const request = new Request(new URL('/api/auth/sign-in/email', input.request.url), {
        method: 'POST',
        headers: input.request.headers,
        body: JSON.stringify({
            email: input.email,
            password: input.password,
            rememberMe: true
        })
    });
    const response = await auth.handler(request);
    const payload = await response.clone().json().catch(() => null);
    if (response.ok && payload?.user?.id) {
        await touchLoginAt(payload.user.id);
        await recordAuditLog({
            actorUserId: payload.user.id,
            actorType: 'user',
            action: 'admin_login',
            targetType: 'session',
            targetId: payload.token || payload.user.id,
            ip: input.request.headers.get('x-forwarded-for'),
            userAgent: input.request.headers.get('user-agent'),
            metadata: { email: sanitizePlainText(input.email) }
        });
    }
    return response;
}

export async function logoutAdmin(request: Request): Promise<Response> {
    const auth = await getAdminAuth(request);
    const logoutRequest = new Request(new URL('/api/auth/sign-out', request.url), {
        method: 'POST',
        headers: request.headers
    });
    return auth.handler(logoutRequest);
}

export async function getOwnerUserCount(): Promise<number> {
    return getOwnerCount();
}
