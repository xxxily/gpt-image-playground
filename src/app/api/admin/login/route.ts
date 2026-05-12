import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loginAdmin } from '@/lib/server/auth';
import { checkInMemoryRateLimit } from '@/lib/server/security';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
});

function getClientKey(request: Request): string {
    return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'local';
}

export async function POST(request: Request) {
    const throttle = checkInMemoryRateLimit(`admin-login:${getClientKey(request)}`, 8, 10 * 60 * 1000);
    if (!throttle.ok) {
        return NextResponse.json({ error: '操作过于频繁，请稍后再试。' }, { status: 429 });
    }

    const parsed = loginSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || '请求参数无效。' }, { status: 400 });
    }

    return loginAdmin({
        email: parsed.data.email,
        password: parsed.data.password,
        request
    });
}

