import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, requireAdminApi } from '@/lib/server/admin-api';
import { listAuditLogsAdmin } from '@/lib/server/promo/admin';

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request);
        const limit = Number(request.nextUrl.searchParams.get('limit') || 100);
        const logs = await listAuditLogsAdmin(Math.max(1, Math.min(200, Number.isFinite(limit) ? limit : 100)));
        return NextResponse.json({ logs });
    } catch (error) {
        return adminJsonError(error);
    }
}
