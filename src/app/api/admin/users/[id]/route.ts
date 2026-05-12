import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { updateAdminUserAdmin } from '@/lib/server/promo/admin';
import { adminUserUpdateSchema } from '@/lib/server/promo/admin-schemas';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner'] });
        const input = await parseAdminJson(request, adminUserUpdateSchema);
        const user = await updateAdminUserAdmin(id, input, toPromoAdminActor(session, request));
        if (!user) return NextResponse.json({ error: '管理员账号不存在。' }, { status: 404 });
        return NextResponse.json({ user });
    } catch (error) {
        return adminJsonError(error);
    }
}
