import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { createPromoItemAdmin, listPromoItemsAdmin } from '@/lib/server/promo/admin';
import { promoItemCreateSchema } from '@/lib/server/promo/admin-schemas';

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request);
        return NextResponse.json({ items: await listPromoItemsAdmin() });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, promoItemCreateSchema);
        const item = await createPromoItemAdmin(input, toPromoAdminActor(session, request));
        return NextResponse.json({ item }, { status: 201 });
    } catch (error) {
        return adminJsonError(error);
    }
}
