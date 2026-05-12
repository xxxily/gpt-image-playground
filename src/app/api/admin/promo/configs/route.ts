import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { createPromoConfigAdmin, listPromoConfigsAdmin } from '@/lib/server/promo/admin';
import { promoConfigCreateSchema } from '@/lib/server/promo/admin-schemas';

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request);
        return NextResponse.json({ configs: await listPromoConfigsAdmin() });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, promoConfigCreateSchema);
        const config = await createPromoConfigAdmin(input, toPromoAdminActor(session, request));
        return NextResponse.json({ config }, { status: 201 });
    } catch (error) {
        return adminJsonError(error);
    }
}
