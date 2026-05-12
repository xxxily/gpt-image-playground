import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { createAdminUserAdmin, listAdminUsersAdmin } from '@/lib/server/promo/admin';
import { adminUserCreateSchema } from '@/lib/server/promo/admin-schemas';

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request);
        return NextResponse.json({ users: await listAdminUsersAdmin() });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner'] });
        const input = await parseAdminJson(request, adminUserCreateSchema);
        const user = await createAdminUserAdmin(input, toPromoAdminActor(session, request));
        return NextResponse.json({ user }, { status: 201 });
    } catch (error) {
        return adminJsonError(error);
    }
}
