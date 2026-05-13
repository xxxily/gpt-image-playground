import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, readJsonBody, requireAdminApi } from '@/lib/server/admin-api';
import { deleteAuditLog, recordAuditLog, verifyAuditLogMaintenanceKey } from '@/lib/server/audit';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner'] });
        const body = (await readJsonBody(request)) as { maintenanceKey?: unknown } | null;
        const maintenanceKey = typeof body?.maintenanceKey === 'string' ? body.maintenanceKey : '';
        if (!verifyAuditLogMaintenanceKey(maintenanceKey)) {
            return NextResponse.json({ error: '审计维护密钥无效或未配置。' }, { status: 403 });
        }

        const ok = await deleteAuditLog(id);
        if (!ok) return NextResponse.json({ error: '审计记录不存在。' }, { status: 404 });

        await recordAuditLog({
            actorUserId: session.id,
            actorType: 'user',
            action: 'audit_log_delete',
            targetType: 'audit_log',
            targetId: id,
            ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
            userAgent: request.headers.get('user-agent'),
            metadata: { deletedId: id }
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        return adminJsonError(error);
    }
}
