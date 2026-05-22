import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, requireAdminApi } from '@/lib/server/admin-api';
import { getShortLinkStats } from '@/lib/server/short-links';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        const stats = await getShortLinkStats(id);
        return NextResponse.json({ stats });
    } catch (error) {
        return adminJsonError(error);
    }
}
