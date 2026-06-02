import { PublicActionsAdminClient, type AdminPublicActionConfig } from '@/components/admin/public-actions-admin-client';
import { listPublicActionConfigsAdmin } from '@/lib/server/public-action-configs';

function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as unknown as T;
}

export default async function AdminPublicActionsPage() {
    const configs = await listPublicActionConfigsAdmin();

    return <PublicActionsAdminClient initialConfigs={serialize(configs) as unknown as AdminPublicActionConfig[]} />;
}
