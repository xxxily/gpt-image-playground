import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { batchCreatePromoShareKeysAdmin } from '@/lib/server/promo/admin';
import { promoShareKeyCreateSchema } from '@/lib/server/promo/admin-schemas';

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, promoShareKeyCreateSchema);
        const results = await batchCreatePromoShareKeysAdmin(input, toPromoAdminActor(session, request));
        return NextResponse.json(
            {
                keys: results.map(({ record, token }) => {
                    const { tokenHash, ...safeRecord } = record;
                    return { key: safeRecord, token };
                })
            },
            { status: 201 }
        );
    } catch (error) {
        return adminJsonError(error);
    }
}
