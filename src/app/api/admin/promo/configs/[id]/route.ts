import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { deletePromoConfigAdmin, updatePromoConfigAdmin } from '@/lib/server/promo/admin';
import { promoConfigUpdateSchema } from '@/lib/server/promo/admin-schemas';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, promoConfigUpdateSchema);
        const config = await updatePromoConfigAdmin(id, input, toPromoAdminActor(session, request));
        if (!config) return NextResponse.json({ error: '广告配置不存在。' }, { status: 404 });
        return NextResponse.json({ config });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const ok = await deletePromoConfigAdmin(id, toPromoAdminActor(session, request));
        if (!ok) return NextResponse.json({ error: '广告配置不存在。' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return adminJsonError(error);
    }
}
