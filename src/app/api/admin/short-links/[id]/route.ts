import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { adminShortLinkUpdateSchema } from '@/lib/server/short-link-schemas';
import {
    deleteShortLinkAdmin,
    getShortLinkAdmin,
    getShortLinkTargetPreview,
    parseTargetSummary,
    updateShortLinkAdmin
} from '@/lib/server/short-links';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        const link = await getShortLinkAdmin(id);
        if (!link) return NextResponse.json({ error: '短链不存在。' }, { status: 404 });
        return NextResponse.json({
            link: {
                ...link,
                targetPreview: getShortLinkTargetPreview(link),
                targetSummary: parseTargetSummary(link.targetSummaryJson)
            }
        });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, adminShortLinkUpdateSchema);
        const link = await updateShortLinkAdmin(request, id, input, toPromoAdminActor(session, request));
        if (!link) return NextResponse.json({ error: '短链不存在。' }, { status: 404 });
        return NextResponse.json({
            link: {
                ...link,
                targetPreview: getShortLinkTargetPreview(link),
                targetSummary: parseTargetSummary(link.targetSummaryJson)
            }
        });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner'] });
        const ok = await deleteShortLinkAdmin(id, toPromoAdminActor(session, request));
        if (!ok) return NextResponse.json({ error: '短链不存在。' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return adminJsonError(error);
    }
}
