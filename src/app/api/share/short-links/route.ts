import { NextRequest, NextResponse } from 'next/server';
import { publicShortLinkCreateSchema } from '@/lib/server/short-link-schemas';
import { createPublicShortLink } from '@/lib/server/short-links';

async function readBody(request: NextRequest): Promise<unknown> {
    return request.json().catch(() => null);
}

export async function POST(request: NextRequest) {
    try {
        const parsed = publicShortLinkCreateSchema.safeParse(await readBody(request));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || '请求参数无效。' }, { status: 400 });
        }

        const result = await createPublicShortLink(request, parsed.data);
        return NextResponse.json({
            shortUrl: result.shortUrl,
            code: result.link.code,
            expiresAt: result.link.expiresAt?.toISOString() || null,
            warnings: result.warnings
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '创建短链失败。';
        const status = message.includes('未开放') || message.includes('无法创建短链') ? 403 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
