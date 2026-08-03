import { adminJsonError, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { publishShowcaseTopicAdmin } from '@/lib/server/showcase/admin';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const { id } = await params;
        const publication = await publishShowcaseTopicAdmin(id, toPromoAdminActor(session, request));
        if (!publication) return NextResponse.json({ error: '专题不存在。' }, { status: 404 });
        return NextResponse.json({ publication });
    } catch (error) {
        return adminJsonError(error);
    }
}
