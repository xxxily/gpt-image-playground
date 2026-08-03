import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import {
    archiveShowcaseTopicAdmin,
    getShowcaseTopicAdmin,
    updateShowcaseTopicAdmin
} from '@/lib/server/showcase/admin';
import { showcaseTopicWriteSchema } from '@/lib/server/showcase/admin-schemas';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
    try {
        await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        const { id } = await params;
        const result = await getShowcaseTopicAdmin(id);
        if (!result) return NextResponse.json({ error: '专题不存在。' }, { status: 404 });
        return NextResponse.json(result);
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const { id } = await params;
        const input = await parseAdminJson(request, showcaseTopicWriteSchema);
        const topic = await updateShowcaseTopicAdmin(id, input, toPromoAdminActor(session, request));
        if (!topic) return NextResponse.json({ error: '专题不存在。' }, { status: 404 });
        return NextResponse.json({ topic });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const { id } = await params;
        const ok = await archiveShowcaseTopicAdmin(id, toPromoAdminActor(session, request));
        if (!ok) return NextResponse.json({ error: '专题不存在。' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return adminJsonError(error);
    }
}
