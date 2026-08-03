import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { createShowcaseTopicAdmin, listShowcaseTopicsAdmin } from '@/lib/server/showcase/admin';
import { showcaseTopicWriteSchema } from '@/lib/server/showcase/admin-schemas';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        const topics = await listShowcaseTopicsAdmin();
        return NextResponse.json({ topics, actorRole: session.role });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, showcaseTopicWriteSchema);
        const topic = await createShowcaseTopicAdmin(input, toPromoAdminActor(session, request));
        return NextResponse.json({ topic }, { status: 201 });
    } catch (error) {
        return adminJsonError(error);
    }
}
