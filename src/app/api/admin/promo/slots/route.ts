import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { createPromoSlotAdmin, listPromoSlotsAdmin } from '@/lib/server/promo/admin';
import { promoSlotCreateSchema } from '@/lib/server/promo/admin-schemas';

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request);
        return NextResponse.json({ slots: await listPromoSlotsAdmin() });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, promoSlotCreateSchema);
        const slot = await createPromoSlotAdmin(input, toPromoAdminActor(session, request));
        return NextResponse.json({ slot }, { status: 201 });
    } catch (error) {
        return adminJsonError(error);
    }
}
