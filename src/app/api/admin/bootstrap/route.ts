import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminJsonError, assertAdminMutationOrigin } from '@/lib/server/admin-api';
import {
    bootstrapAdminOwner,
    getAdminBootstrapState,
    resetAdminPassword,
    validateAdminBootstrapSecret
} from '@/lib/server/auth';
import { checkInMemoryRateLimit } from '@/lib/server/security';

const bootstrapSchema = z.object({
    bootstrapSecret: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1),
    password: z.string().min(12),
    action: z.enum(['initialize', 'reset']).optional()
});

function getClientKey(request: Request): string {
    return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'local';
}

export async function POST(request: NextRequest) {
    try {
        assertAdminMutationOrigin(request);
        const throttle = checkInMemoryRateLimit(`admin-bootstrap:${getClientKey(request)}`, 5, 5 * 60 * 1000);
        if (!throttle.ok) {
            return NextResponse.json({ error: '操作过于频繁，请稍后再试。' }, { status: 429 });
        }

        const parsed = bootstrapSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || '请求参数无效。' }, { status: 400 });
        }

        const state = await getAdminBootstrapState();
        const secretOk = await validateAdminBootstrapSecret(parsed.data.bootstrapSecret);
        if (!secretOk) {
            return NextResponse.json({ error: '恢复密钥不正确。' }, { status: 401 });
        }

        if (!state.hasOwner) {
            return bootstrapAdminOwner({
                email: parsed.data.email,
                name: parsed.data.name,
                password: parsed.data.password,
                request
            });
        }

        return resetAdminPassword({
            email: parsed.data.email,
            name: parsed.data.name,
            password: parsed.data.password,
            request
        });
    } catch (error) {
        return adminJsonError(error);
    }
}
