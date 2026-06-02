import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { deletePublicActionConfigAdmin, updatePublicActionConfigAdmin } from '@/lib/server/public-action-configs';
import { publicActionConfigUpdateSchema } from '@/lib/server/public-action-schemas';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, publicActionConfigUpdateSchema);
        const config = await updatePublicActionConfigAdmin(id, input, toPromoAdminActor(session, request));
        if (!config) return NextResponse.json({ error: '购买入口不存在。' }, { status: 404 });
        return NextResponse.json({ config });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const ok = await deletePublicActionConfigAdmin(id, toPromoAdminActor(session, request));
        if (!ok) return NextResponse.json({ error: '购买入口不存在。' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return adminJsonError(error);
    }
}
