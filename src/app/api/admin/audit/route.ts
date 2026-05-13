import { NextRequest } from 'next/server';
import { adminJsonError, requireAdminApi } from '@/lib/server/admin-api';
import { listAuditLogsPage } from '@/lib/server/audit';
import { NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request);
        const page = Number(request.nextUrl.searchParams.get('page') || 1);
        const pageSize = Number(request.nextUrl.searchParams.get('pageSize') || 25);
        return NextResponse.json(await listAuditLogsPage({ page, pageSize }));
    } catch (error) {
        return adminJsonError(error);
    }
}
