import { NextRequest } from 'next/server';
import { adminJsonError, requireAdminApi } from '@/lib/server/admin-api';
import { listAuditLogsAdmin } from '@/lib/server/promo/admin';
import { NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request);
        const logs = await listAuditLogsAdmin(100);
        return NextResponse.json({ logs });
    } catch (error) {
        return adminJsonError(error);
    }
}
