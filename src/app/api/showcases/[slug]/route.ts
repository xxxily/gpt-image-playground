import { getShowcaseCorsHeaders } from '@/lib/server/showcase/cors';
import {
    etagForShowcaseCatalog,
    getPublicShowcaseTopic,
    toPublicShowcaseWireCatalog
} from '@/lib/server/showcase/public';
import { getRequestPublicOrigin } from '@/lib/server/request-origin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { slug } = await params;
        const result = await getPublicShowcaseTopic(slug);
        if (!result) return NextResponse.json({ error: '专题不存在。' }, { status: 404 });
        const catalog = toPublicShowcaseWireCatalog(result.catalog, getRequestPublicOrigin(request), {
            supportsExtendedCases: request.headers.get('x-showcase-client-version') === '2'
        });
        const etag = etagForShowcaseCatalog(catalog);
        const responseHeaders = getShowcaseCorsHeaders(request);
        responseHeaders.set('cache-control', 'public, max-age=60, stale-while-revalidate=300');
        responseHeaders.set('etag', etag);
        if (request.headers.get('if-none-match')?.trim() === etag) {
            return new NextResponse(null, { status: 304, headers: responseHeaders });
        }
        return NextResponse.json({ catalog, source: result.source }, { headers: responseHeaders });
    } catch {
        return NextResponse.json({ error: '专题暂时不可用。' }, { status: 503 });
    }
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, { status: 204, headers: getShowcaseCorsHeaders(request) });
}
