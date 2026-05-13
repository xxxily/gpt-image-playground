import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getServerDatabasePath } from '@/lib/server/db';

export default async function AdminSettingsPage() {
    const databasePath = getServerDatabasePath();

    return (
        <section className='space-y-6'>
            <div>
                <h1 className='text-2xl font-semibold'>系统设置</h1>
                <p className='mt-1 text-sm text-muted-foreground'>查看后台运行配置和关键环境变量状态。</p>
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
                <Card>
                    <CardHeader>
                        <CardTitle>数据库</CardTitle>
                        <CardDescription>SQLite 文件路径</CardDescription>
                    </CardHeader>
                    <CardContent className='text-sm'>{databasePath}</CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>认证与开关</CardTitle>
                        <CardDescription>后台初始化与广告读取</CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-2 text-sm'>
                        <p>ADMIN_BOOTSTRAP_SECRET: {process.env.ADMIN_BOOTSTRAP_SECRET ? '已配置' : '未配置'}</p>
                        <p>BETTER_AUTH_SECRET: {process.env.BETTER_AUTH_SECRET ? '已配置' : '未配置'}</p>
                        <p>PROMO_SHARE_CONFIG_ENABLED: {process.env.PROMO_SHARE_CONFIG_ENABLED !== 'false' ? '开启' : '关闭'}</p>
                        <p>NEXT_PUBLIC_GENERATION_HEADER_AD_*: {process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_ENABLED || process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_IMAGE_URL ? '已配置兜底' : '未配置'}</p>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
