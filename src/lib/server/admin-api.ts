import { NextResponse, type NextRequest } from 'next/server';
import type { z } from 'zod';
import { requireAdminSession } from '@/lib/server/auth';
import type { PromoAdminActor } from '@/lib/server/promo/admin';

export type AdminApiRole = 'owner' | 'admin' | 'viewer';

type AdminApiOptions = {
    roles?: AdminApiRole[];
    mutation?: boolean;
};

export class AdminApiError extends Error {
    constructor(
        message: string,
        public readonly status: number
    ) {
        super(message);
    }
}

function isAllowedRole(role: string, allowedRoles: AdminApiRole[]): boolean {
    return allowedRoles.includes(role as AdminApiRole);
}

export function assertAdminMutationOrigin(request: NextRequest): void {
    const origin = request.headers.get('origin');
    const requestOrigin = request.nextUrl.origin;
    if (origin && origin !== requestOrigin) {
        throw new AdminApiError('请求来源不合法。', 403);
    }

    const fetchSite = request.headers.get('sec-fetch-site');
    if (fetchSite === 'cross-site') {
        throw new AdminApiError('请求来源不合法。', 403);
    }
}

export async function requireAdminApi(request: NextRequest, options: AdminApiOptions = {}) {
    if (options.mutation) {
        assertAdminMutationOrigin(request);
    }

    try {
        const session = await requireAdminSession(request.headers);
        const allowedRoles = options.roles ?? ['owner', 'admin', 'viewer'];
        if (!isAllowedRole(session.role, allowedRoles)) {
            throw new AdminApiError('当前账号没有权限执行该操作。', 403);
        }
        return session;
    } catch (error) {
        if (error instanceof AdminApiError) throw error;
        if (error instanceof Error && error.message === 'ADMIN_SESSION_REQUIRED') {
            throw new AdminApiError('需要登录管理后台。', 401);
        }
        throw error;
    }
}

export function toPromoAdminActor(session: Awaited<ReturnType<typeof requireAdminApi>>, request: NextRequest): PromoAdminActor {
    return {
        userId: session.id,
        email: session.email,
        role: session.role,
        request
    };
}

export function adminJsonError(error: unknown): NextResponse {
    if (error instanceof AdminApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
        return NextResponse.json({ error: error.message || '操作失败。' }, { status: 400 });
    }
    return NextResponse.json({ error: '操作失败。' }, { status: 400 });
}

export async function readJsonBody(request: NextRequest): Promise<unknown> {
    return request.json().catch(() => null);
}

export async function parseAdminJson<TSchema extends z.ZodTypeAny>(
    request: NextRequest,
    schema: TSchema
): Promise<z.infer<TSchema>> {
    const parsed = schema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
        throw new AdminApiError(parsed.error.issues[0]?.message || '请求参数无效。', 400);
    }
    return parsed.data;
}
