import { UsersAdminClient, type AdminUser } from '@/components/admin/users-admin-client';
import { listAdminUsersAdmin } from '@/lib/server/promo/admin';

function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as unknown as T;
}

export default async function AdminUsersPage() {
    const users = await listAdminUsersAdmin();
    return <UsersAdminClient initialUsers={serialize(users) as unknown as AdminUser[]} />;
}
