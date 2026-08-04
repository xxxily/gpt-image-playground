import { AdminApiError, adminJsonError, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import {
    SHOWCASE_MEDIA_MAX_UPLOAD_BYTES,
    createShowcaseManagedAsset,
    listShowcaseManagedAssets
} from '@/lib/server/showcase/media';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function requiredFormText(formData: FormData, key: string): string {
    const value = formData.get(key);
    if (typeof value !== 'string') throw new AdminApiError(`缺少字段：${key}`, 400);
    return value;
}

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        return NextResponse.json({ assets: await listShowcaseManagedAssets() });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const contentLength = Number(request.headers.get('content-length') || 0);
        if (Number.isFinite(contentLength) && contentLength > SHOWCASE_MEDIA_MAX_UPLOAD_BYTES + 64 * 1024) {
            throw new AdminApiError('上传请求超过允许大小。', 413);
        }
        let formData: FormData;
        try {
            formData = await request.formData();
        } catch {
            throw new AdminApiError('无法解析 multipart 上传内容。', 400);
        }
        const file = formData.get('file');
        if (!(file instanceof File)) throw new AdminApiError('请选择需要上传的图片。', 400);
        const asset = await createShowcaseManagedAsset(
            {
                file,
                sourceLabel: requiredFormText(formData, 'sourceLabel'),
                licenseNote: requiredFormText(formData, 'licenseNote'),
                altZhCN: requiredFormText(formData, 'altZhCN'),
                altEnUS: requiredFormText(formData, 'altEnUS')
            },
            toPromoAdminActor(session, request)
        );
        return NextResponse.json({ asset }, { status: 201 });
    } catch (error) {
        return adminJsonError(error);
    }
}
