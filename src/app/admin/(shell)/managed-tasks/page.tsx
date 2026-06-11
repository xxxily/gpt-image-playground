import {
    ManagedTasksAdminClient,
    type AdminManagedTaskPolicy,
    type AdminManagedTaskService
} from '@/components/admin/managed-tasks-admin-client';
import { listManagedTaskPoliciesAdmin, listManagedTaskServicesAdmin } from '@/lib/server/managed-task-admin';

function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as unknown as T;
}

export default async function AdminManagedTasksPage() {
    const [services, policies] = await Promise.all([listManagedTaskServicesAdmin(), listManagedTaskPoliciesAdmin()]);

    return (
        <ManagedTasksAdminClient
            initialServices={serialize(services) as unknown as AdminManagedTaskService[]}
            initialPolicies={serialize(policies) as unknown as AdminManagedTaskPolicy[]}
        />
    );
}
