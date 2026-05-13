import { AuditLogsAdminClient } from '@/components/admin/audit-logs-admin-client';
import type { AuditLogPagePayload } from '@/components/admin/audit-logs-admin-client';
import { getAuditLogMaxRows, isAuditLogMaintenanceKeyConfigured, listAuditLogsPage } from '@/lib/server/audit';

function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export default async function AdminAuditPage() {
    const payload = serialize({
        ...(await listAuditLogsPage({ page: 1, pageSize: 25 })),
        maintenance: {
            keyConfigured: isAuditLogMaintenanceKeyConfigured(),
            maxRows: getAuditLogMaxRows()
        }
    }) as unknown as AuditLogPagePayload;

    return <AuditLogsAdminClient initialPayload={payload} />;
}
