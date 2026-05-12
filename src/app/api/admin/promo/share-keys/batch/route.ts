import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { batchCreatePromoShareKeysAdmin, listPromoShareKeysAdmin } from '@/lib/server/promo/admin';
import { promoShareKeyCreateSchema } from '@/lib/server/promo/admin-schemas';

function toPublicShareKey(record: Awaited<ReturnType<typeof listPromoShareKeysAdmin>>[number]) {
    return {
        id: record.id,
        name: record.name,
        note: record.note,
        tokenPrefix: record.tokenPrefix,
        status: record.status,
        expiresAt: record.expiresAt,
        allowedSlotsJson: record.allowedSlotsJson,
        createdByUserId: record.createdByUserId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        lastUsedAt: record.lastUsedAt
    };
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, promoShareKeyCreateSchema);
        const results = await batchCreatePromoShareKeysAdmin(input, toPromoAdminActor(session, request));
        return NextResponse.json(
            {
                keys: results.map(({ record, token }) => ({ key: toPublicShareKey(record), token }))
            },
            { status: 201 }
        );
    } catch (error) {
        return adminJsonError(error);
    }
}
