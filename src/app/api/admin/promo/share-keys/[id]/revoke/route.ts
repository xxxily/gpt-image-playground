import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { setPromoShareKeyStatusAdmin } from '@/lib/server/promo/admin';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const record = await setPromoShareKeyStatusAdmin(id, 'revoked', toPromoAdminActor(session, request));
        if (!record) return NextResponse.json({ error: '权限 Key 不存在。' }, { status: 404 });
        return NextResponse.json({
            key: {
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
            }
        });
    } catch (error) {
        return adminJsonError(error);
    }
}
