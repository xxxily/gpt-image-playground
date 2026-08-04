import { AdminApiError, requireAdminApi } from '@/lib/server/admin-api';
import { getShowcaseCorsHeaders } from '@/lib/server/showcase/cors';
import {
    getShowcaseManagedAsset,
    getShowcaseManagedAssetFilePath,
    isShowcaseManagedAssetPublic
} from '@/lib/server/showcase/media';
import fs from 'node:fs/promises';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

async function canReadAdminPreview(request: NextRequest): Promise<boolean> {
    try {
        await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        return true;
    } catch (error) {
        if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) return false;
        throw error;
    }
}

export async function GET(request: NextRequest, { params }: Params) {
    const { id } = await params;
    const asset = await getShowcaseManagedAsset(id);
    if (!asset) return NextResponse.json({ error: '媒体不存在。' }, { status: 404 });
    const isPublic = await isShowcaseManagedAssetPublic(id);
    if (!isPublic && !(await canReadAdminPreview(request))) {
        return NextResponse.json({ error: '媒体不存在。' }, { status: 404 });
    }

    const thumbnail = request.nextUrl.searchParams.get('variant') === 'thumbnail';
    if (request.nextUrl.searchParams.has('variant') && !thumbnail) {
        return NextResponse.json({ error: '媒体变体不存在。' }, { status: 404 });
    }
    let contents: Buffer;
    try {
        contents = await fs.readFile(getShowcaseManagedAssetFilePath(asset, thumbnail));
    } catch {
        return NextResponse.json({ error: '媒体文件不可用。' }, { status: 404 });
    }

    const headers = getShowcaseCorsHeaders(request);
    headers.set('content-type', 'image/webp');
    headers.set('content-length', String(contents.byteLength));
    headers.set('content-disposition', `inline; filename=\"${asset.id}${thumbnail ? '.thumbnail' : ''}.webp\"`);
    headers.set('x-content-type-options', 'nosniff');
    headers.set('etag', `\"${asset.checksum}${thumbnail ? '-thumbnail' : ''}\"`);
    headers.set('cache-control', isPublic ? 'public, max-age=31536000, immutable' : 'private, no-store');
    if (request.headers.get('if-none-match') === headers.get('etag')) {
        return new NextResponse(null, { status: 304, headers });
    }
    return new NextResponse(new Uint8Array(contents), { headers });
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, { status: 204, headers: getShowcaseCorsHeaders(request) });
}
