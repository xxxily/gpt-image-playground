import { adminJsonError, requireAdminApi } from '@/lib/server/admin-api';
import { getShowcaseAnalyticsSummary } from '@/lib/server/showcase/analytics';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        const daysValue = Number(request.nextUrl.searchParams.get('days') || 30);
        const days = Number.isFinite(daysValue) ? Math.max(1, Math.min(180, Math.floor(daysValue))) : 30;
        const to = Date.now();
        const summary = await getShowcaseAnalyticsSummary(to - days * 86_400_000, to);
        return NextResponse.json({ summary, days });
    } catch (error) {
        return adminJsonError(error);
    }
}
