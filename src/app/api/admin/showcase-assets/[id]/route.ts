import { adminJsonError, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { ShowcaseAssetInUseError, deleteShowcaseManagedAsset } from '@/lib/server/showcase/media';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const { id } = await params;
        const deleted = await deleteShowcaseManagedAsset(id, toPromoAdminActor(session, request));
        if (!deleted) return NextResponse.json({ error: '专题媒体不存在。' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (error) {
        if (error instanceof ShowcaseAssetInUseError) {
            return NextResponse.json(
                { error: error.message, code: error.code, references: error.references },
                { status: 409 }
            );
        }
        return adminJsonError(error);
    }
}
