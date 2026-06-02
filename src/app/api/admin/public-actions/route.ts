import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { createPublicActionConfigAdmin, listPublicActionConfigsAdmin } from '@/lib/server/public-action-configs';
import { publicActionConfigCreateSchema } from '@/lib/server/public-action-schemas';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        const configs = await listPublicActionConfigsAdmin();
        return NextResponse.json({ configs });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, publicActionConfigCreateSchema);
        const config = await createPublicActionConfigAdmin(input, toPromoAdminActor(session, request));
        return NextResponse.json({ config });
    } catch (error) {
        return adminJsonError(error);
    }
}
