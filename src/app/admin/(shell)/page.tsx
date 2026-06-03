import { LocalizedMessage } from '@/components/localized-message';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { getServerDatabaseReady } from '@/lib/server/db';
import { auditLogs, promoConfigs, promoItems, promoSlots, promoShareProfiles, shortLinks } from '@/lib/server/schema';
import { count } from 'drizzle-orm';

async function getCounts() {
    const db = await getServerDatabaseReady();
    const [slotRow, configRow, itemRow, profileRow, shortLinkRow, auditRow] = await Promise.all([
        db.select({ count: count() }).from(promoSlots),
        db.select({ count: count() }).from(promoConfigs),
        db.select({ count: count() }).from(promoItems),
        db.select({ count: count() }).from(promoShareProfiles),
        db.select({ count: count() }).from(shortLinks),
        db.select({ count: count() }).from(auditLogs)
    ]);
    return {
        slots: Number(slotRow[0]?.count || 0),
        configs: Number(configRow[0]?.count || 0),
        items: Number(itemRow[0]?.count || 0),
        profiles: Number(profileRow[0]?.count || 0),
        shortLinks: Number(shortLinkRow[0]?.count || 0),
        audits: Number(auditRow[0]?.count || 0)
    };
}

export default async function AdminHomePage() {
    const counts = await getCounts();

    return (
        <section className='space-y-6'>
            <div>
                <Heading level={1} size='section'>
                    <LocalizedMessage id='phase4b.adminOverview' />
                </Heading>
                <p className='text-muted-foreground mt-1 text-sm'>
                    <LocalizedMessage id='phase4b.managePlacementsDisplayGroupsShareProfilesAndAudit' />
                </p>
            </div>
            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                {[
                    ['admin.nav.promo', counts.slots],
                    ['phase4b.displayGroup', counts.configs],
                    ['phase4b.promoAssetCount', counts.items],
                    ['phase4b.shareProfile', counts.profiles],
                    ['admin.nav.shortLinks', counts.shortLinks],
                    ['phase4b.auditRecords', counts.audits]
                ].map(([labelId, value]) => (
                    <Card key={labelId}>
                        <CardHeader className='pb-2'>
                            <CardTitle className='text-sm font-medium'>
                                <LocalizedMessage id={labelId as string} />
                            </CardTitle>
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
