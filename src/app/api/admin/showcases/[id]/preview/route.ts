import { adminJsonError, requireAdminApi } from '@/lib/server/admin-api';
import { previewShowcaseTopicAdmin } from '@/lib/server/showcase/admin';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
    try {
        await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        const { id } = await params;
        const catalog = await previewShowcaseTopicAdmin(id);
        if (!catalog) return NextResponse.json({ error: '专题不存在。' }, { status: 404 });
        return NextResponse.json({ catalog, source: 'preview' });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function POST(request: NextRequest, context: Params) {
    try {
        await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const { id } = await context.params;
        const catalog = await previewShowcaseTopicAdmin(id);
        if (!catalog) return NextResponse.json({ error: '专题不存在。' }, { status: 404 });
        return NextResponse.json({ catalog, source: 'preview' });
    } catch (error) {
        return adminJsonError(error);
    }
}
