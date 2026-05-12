import { redirect } from 'next/navigation';
import { AdminAuthForm } from '@/components/admin/admin-auth-form';
import { getAdminBootstrapState, getAdminSession } from '@/lib/server/auth';
import { headers } from 'next/headers';

export default async function AdminLoginPage() {
    const session = await getAdminSession(await headers());
    if (session) redirect('/admin');

    const bootstrapState = await getAdminBootstrapState();
    if (!bootstrapState.hasOwner) redirect('/admin/setup');

    return (
        <main className='min-h-screen bg-background px-4 py-10'>
            <div className='mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg flex-col justify-center'>
                <h1 className='text-2xl font-semibold'>管理后台登录</h1>
                <p className='text-muted-foreground mt-2 text-sm'>使用独立管理员账号登录，不依赖 `APP_PASSWORD`。</p>
                <AdminAuthForm
                    mode='login'
                    actionUrl='/api/admin/login'
                    submitLabel='登录'
                    hint='输入管理员邮箱和密码后进入后台。'
                    className='mt-8'
                />
            </div>
        </main>
    );
}

