import { AdminAuthForm } from '@/components/admin/admin-auth-form';
import { LocalizedMessage } from '@/components/localized-message';
import { Heading } from '@/components/ui/heading';
import { getAdminBootstrapState, getAdminSession } from '@/lib/server/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AdminLoginPage() {
    const session = await getAdminSession(await headers());
    if (session) redirect('/admin');

    const bootstrapState = await getAdminBootstrapState();
    if (!bootstrapState.hasOwner) redirect('/admin/setup');

    return (
        <main className='bg-background min-h-screen px-4 py-10'>
            <div className='mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg flex-col justify-center'>
                <Heading level={1} size='section'>
                    <LocalizedMessage id='phase4b.adminLogin' />
                </Heading>
                <p className='text-muted-foreground mt-2 text-sm'>
                    <LocalizedMessage id='phase4b.signInWithADedicatedAdminAccountThis' />
                </p>
                <AdminAuthForm
                    mode='login'
                    actionUrl='/api/admin/login'
                    submitLabelId='phase4b.adminLoginSubmit'
                    hintId='phase4b.adminLoginHint'
                    className='mt-8'
                />
            </div>
        </main>
    );
}
