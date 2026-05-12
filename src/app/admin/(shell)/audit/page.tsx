import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listAuditLogsAdmin } from '@/lib/server/promo/admin';

function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export default async function AdminAuditPage() {
    const logs = serialize(await listAuditLogsAdmin(100));

    return (
        <section className='space-y-6'>
            <div>
                <h1 className='text-2xl font-semibold'>审计日志</h1>
                <p className='mt-1 text-sm text-muted-foreground'>查看后台关键动作、登录和配置修改记录。</p>
            </div>
            <div className='space-y-3'>
                {logs.map((log) => (
                    <Card key={log.id}>
                        <CardHeader className='pb-2'>
                            <CardTitle className='text-sm font-medium'>
                                {log.action} / {log.targetType}
                            </CardTitle>
                            <CardDescription className='text-xs'>
                                {log.createdAt ? new Date(log.createdAt).toLocaleString() : ''} {log.actorUserId ? `· ${log.actorUserId}` : ''}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className='space-y-2 text-sm'>
                            <p className='text-muted-foreground'>目标 {log.targetId}</p>
                            <p className='text-muted-foreground'>IP {log.ip || '-'}</p>
                            <p className='overflow-x-auto rounded-md bg-muted/40 p-3 text-xs'>{log.metadataJson}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
    );
}
