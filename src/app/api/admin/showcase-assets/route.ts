import { AdminApiError, adminJsonError, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { showcaseAssetProvenanceTypes, type ShowcaseAssetProvenanceType } from '@/lib/server/schema';
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

function optionalFormText(formData: FormData, key: string): string | undefined {
    const value = formData.get(key);
    return typeof value === 'string' && value.trim() ? value : undefined;
}

function optionalFormInteger(formData: FormData, key: string): number | undefined {
    const value = optionalFormText(formData, key);
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) throw new AdminApiError(`字段必须是整数：${key}`, 400);
    return parsed;
}

function formProvenanceType(formData: FormData): ShowcaseAssetProvenanceType {
    const value = optionalFormText(formData, 'provenanceType') ?? 'licensed-source';
    if (!showcaseAssetProvenanceTypes.includes(value as ShowcaseAssetProvenanceType)) {
        throw new AdminApiError('媒体来源类型不受支持。', 400);
    }
    return value as ShowcaseAssetProvenanceType;
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
                provenanceType: formProvenanceType(formData),
                generationModelId: optionalFormText(formData, 'generationModelId'),
                generationRecipeVersion: optionalFormInteger(formData, 'generationRecipeVersion'),
                generatedAt: optionalFormInteger(formData, 'generatedAt'),
                candidateCount: optionalFormInteger(formData, 'candidateCount'),
                reviewApproved: formData.get('reviewApproved') === 'true',
                reviewNote: optionalFormText(formData, 'reviewNote'),
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
