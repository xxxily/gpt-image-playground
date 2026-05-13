import { count } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getServerDatabaseReady } from '@/lib/server/db';
import { auditLogs, promoConfigs, promoItems, promoSlots, promoShareProfiles } from '@/lib/server/schema';

async function getCounts() {
    const db = await getServerDatabaseReady();
    const [slotRow, configRow, itemRow, profileRow, auditRow] = await Promise.all([
        db.select({ count: count() }).from(promoSlots),
        db.select({ count: count() }).from(promoConfigs),
        db.select({ count: count() }).from(promoItems),
        db.select({ count: count() }).from(promoShareProfiles),
        db.select({ count: count() }).from(auditLogs)
    ]);
    return {
        slots: Number(slotRow[0]?.count || 0),
        configs: Number(configRow[0]?.count || 0),
        items: Number(itemRow[0]?.count || 0),
        profiles: Number(profileRow[0]?.count || 0),
        audits: Number(auditRow[0]?.count || 0)
    };
}

export default async function AdminHomePage() {
    const counts = await getCounts();

    return (
        <section className='space-y-6'>
            <div>
                <h1 className='text-2xl font-semibold'>后台总览</h1>
                <p className='text-muted-foreground mt-1 text-sm'>管理广告位、广告组、分享 Profile 与审计记录。</p>
            </div>
            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                {[
                    ['广告位', counts.slots],
                    ['广告组', counts.configs],
                    ['广告素材', counts.items],
                    ['分享 Profile', counts.profiles],
                    ['审计记录', counts.audits]
                ].map(([label, value]) => (
                    <Card key={label}>
                        <CardHeader className='pb-2'>
                            <CardTitle className='text-sm font-medium'>{label}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className='text-3xl font-semibold'>{value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
    );
}
