import { getShowcaseCorsHeaders } from '@/lib/server/showcase/cors';
import {
    SHOWCASE_ANALYTICS_MAX_BODY_BYTES,
    parseShowcaseAnalyticsBatch,
    recordShowcaseAnalyticsBatch
} from '@/lib/server/showcase/analytics';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const headers = getShowcaseCorsHeaders(request);
    headers.set('cache-control', 'no-store');
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > SHOWCASE_ANALYTICS_MAX_BODY_BYTES) {
        return NextResponse.json({ error: '事件请求超过大小限制。' }, { status: 413, headers });
    }
    let rawBody: string;
    try {
        rawBody = await request.text();
    } catch {
        return NextResponse.json({ error: '无法读取事件请求。' }, { status: 400, headers });
    }
    if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > SHOWCASE_ANALYTICS_MAX_BODY_BYTES) {
        return NextResponse.json({ error: '事件请求为空或超过大小限制。' }, { status: 413, headers });
    }
    try {
        const payload = JSON.parse(rawBody) as { events?: unknown };
        const events = parseShowcaseAnalyticsBatch(payload?.events);
        await recordShowcaseAnalyticsBatch(events);
        return NextResponse.json({ accepted: events.length }, { status: 202, headers });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '事件请求无效。' },
            { status: 400, headers }
        );
    }
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, { status: 204, headers: getShowcaseCorsHeaders(request) });
}
