import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, readJsonBody, requireAdminApi } from '@/lib/server/admin-api';
import {
    clearAuditLogs,
    getAuditLogMaxRows,
    isAuditLogMaintenanceKeyConfigured,
    listAuditLogsPage,
    recordAuditLog,
    verifyAuditLogMaintenanceKey
} from '@/lib/server/audit';

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request);
        const page = Number(request.nextUrl.searchParams.get('page') || 1);
        const pageSize = Number(request.nextUrl.searchParams.get('pageSize') || 25);
        const action = request.nextUrl.searchParams.get('action');
        const targetType = request.nextUrl.searchParams.get('targetType');
        const result = await listAuditLogsPage({ page, pageSize, action, targetType });
        return NextResponse.json({
            ...result,
            maintenance: {
                keyConfigured: isAuditLogMaintenanceKeyConfigured(),
                maxRows: getAuditLogMaxRows()
            }
        });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner'] });
        const body = (await readJsonBody(request)) as { maintenanceKey?: unknown } | null;
        const maintenanceKey = typeof body?.maintenanceKey === 'string' ? body.maintenanceKey : '';
        if (!verifyAuditLogMaintenanceKey(maintenanceKey)) {
            return NextResponse.json({ error: '审计维护密钥无效或未配置。' }, { status: 403 });
        }

        const deletedCount = await clearAuditLogs();
        await recordAuditLog({
            actorUserId: session.id,
            actorType: 'user',
            action: 'audit_log_clear',
            targetType: 'audit_log',
            targetId: 'all',
            ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
            userAgent: request.headers.get('user-agent'),
            metadata: { deletedCount }
        });

        return NextResponse.json({ ok: true, deletedCount });
    } catch (error) {
        return adminJsonError(error);
    }
}
