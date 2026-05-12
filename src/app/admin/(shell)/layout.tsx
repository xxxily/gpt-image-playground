import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AdminShell } from '@/components/admin/admin-shell';
import { getAdminBootstrapState, getAdminSession } from '@/lib/server/auth';

export default async function AdminShellLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const requestHeaders = await headers();
    const session = await getAdminSession(requestHeaders);
    if (!session) {
        const bootstrapState = await getAdminBootstrapState();
        redirect(bootstrapState.hasOwner ? '/admin/login' : '/admin/setup');
    }

    return <AdminShell>{children}</AdminShell>;
}
