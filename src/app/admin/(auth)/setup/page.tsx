import { redirect } from 'next/navigation';
import { AdminAuthForm } from '@/components/admin/admin-auth-form';
import { getAdminBootstrapState, getAdminSession } from '@/lib/server/auth';
import { headers } from 'next/headers';

export default async function AdminSetupPage() {
    const session = await getAdminSession(await headers());
    if (session) redirect('/admin');

    const bootstrapState = await getAdminBootstrapState();
    if (bootstrapState.hasOwner) redirect('/admin/login');

    return (
        <main className='min-h-screen bg-background px-4 py-10'>
            <div className='mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg flex-col justify-center'>
                <h1 className='text-2xl font-semibold'>初始化管理后台</h1>
                <p className='text-muted-foreground mt-2 text-sm'>首次安装时使用恢复密钥创建第一个 owner 账号。</p>
                <AdminAuthForm
                    mode='setup'
                    actionUrl='/api/admin/bootstrap'
                    submitLabel='创建 owner'
                    hint='恢复密钥只在服务端校验。密码至少 12 位。'
                    className='mt-8'
                />
            </div>
        </main>
    );
}

