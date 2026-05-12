import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { createPromoShareKeyAdmin, listPromoShareKeysAdmin } from '@/lib/server/promo/admin';
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

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request);
        const keys = (await listPromoShareKeysAdmin()).map(toPublicShareKey);
        return NextResponse.json({ keys });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, promoShareKeyCreateSchema);
        const result = await createPromoShareKeyAdmin(input, toPromoAdminActor(session, request));
        return NextResponse.json(
            {
                key: toPublicShareKey(result.record),
                token: result.token
            },
            { status: 201 }
        );
    } catch (error) {
        return adminJsonError(error);
    }
}
