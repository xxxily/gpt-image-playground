import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkInMemoryRateLimit } from '@/lib/server/security';
import { validatePromoShareKey } from '@/lib/server/promo/share';

const validateShareKeySchema = z.object({
    shareKey: z.string().trim().min(1, '请输入权限 Key。'),
    slotKey: z.string().trim().min(1).max(80).nullable().optional()
});

function getClientKey(request: Request): string {
    return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'local';
}

function jsonError(error: unknown, status = 400): NextResponse {
    if (error instanceof Error) {
        return NextResponse.json({ error: error.message || '请求失败。' }, { status });
    }
    return NextResponse.json({ error: '请求失败。' }, { status });
}

export async function POST(request: NextRequest) {
    try {
        const throttle = checkInMemoryRateLimit(`promo-share-key-validate:${getClientKey(request)}`, 20, 10 * 60 * 1000);
        if (!throttle.ok) {
            return NextResponse.json({ error: '操作过于频繁，请稍后再试。' }, { status: 429 });
        }

        const parsed = validateShareKeySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || '请求参数无效。' }, { status: 400 });
        }

        const result = await validatePromoShareKey(parsed.data.shareKey, parsed.data.slotKey);
        return NextResponse.json(result);
    } catch (error) {
        return jsonError(error);
    }
}
