import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { deletePromoItemAdmin, updatePromoItemAdmin } from '@/lib/server/promo/admin';
import { promoItemUpdateSchema } from '@/lib/server/promo/admin-schemas';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, promoItemUpdateSchema);
        const item = await updatePromoItemAdmin(id, input, toPromoAdminActor(session, request));
        if (!item) return NextResponse.json({ error: '展示素材不存在。' }, { status: 404 });
        return NextResponse.json({ item });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const ok = await deletePromoItemAdmin(id, toPromoAdminActor(session, request));
        if (!ok) return NextResponse.json({ error: '展示素材不存在。' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return adminJsonError(error);
    }
}
