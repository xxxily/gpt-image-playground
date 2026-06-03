import { LocalizedMessage } from '@/components/localized-message';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { getServerDatabasePath } from '@/lib/server/db';

export default async function AdminSettingsPage() {
    const databasePath = getServerDatabasePath();

    return (
        <section className='space-y-6'>
            <div>
                <Heading level={1} size='section'>
                    <LocalizedMessage id='phase4b.systemSettings' />
                </Heading>
                <p className='text-muted-foreground mt-1 text-sm'>
                    <LocalizedMessage id='phase4b.viewAdminRuntimeConfigurationAndKeyEnvironmentVariable' />
                </p>
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <LocalizedMessage id='phase4b.database' />
                        </CardTitle>
                        <CardDescription>
                            <LocalizedMessage id='phase4b.sqliteFilePath' />
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='text-sm'>{databasePath}</CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <LocalizedMessage id='phase4b.authenticationAndSwitches' />
                        </CardTitle>
                        <CardDescription>
                            <LocalizedMessage id='phase4b.adminBootstrapAndPromoContentReads' />
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-2 text-sm'>
                        <p>
                            ADMIN_BOOTSTRAP_SECRET:{' '}
                            <LocalizedMessage
                                id={process.env.ADMIN_BOOTSTRAP_SECRET ? 'phase4b.configured' : 'phase4b.notConfigured'}
                            />
                        </p>
                        <p>
                            AUDIT_LOG_MAINTENANCE_KEY:{' '}
                            <LocalizedMessage
                                id={
                                    process.env.AUDIT_LOG_MAINTENANCE_KEY
                                        ? 'phase4b.configured'
                                        : 'phase4b.notConfigured'
                                }
                            />
                        </p>
                        <p>AUDIT_LOG_MAX_ROWS: {process.env.AUDIT_LOG_MAX_ROWS || '5000'}</p>
                        <p>
                            BETTER_AUTH_SECRET:{' '}
                            <LocalizedMessage
                                id={process.env.BETTER_AUTH_SECRET ? 'phase4b.configured' : 'phase4b.notConfigured'}
                            />
                        </p>
                        <p>
                            PROMO_SHARE_CONFIG_ENABLED:{' '}
                            <LocalizedMessage
                                id={process.env.PROMO_SHARE_CONFIG_ENABLED !== 'false' ? 'phase4b.on' : 'phase4b.off'}
                            />
                        </p>
                        <p>
                            SHORT_LINK_ENABLED:{' '}
                            {process.env.SHORT_LINK_ENABLED
                                ? process.env.SHORT_LINK_ENABLED
                                : <LocalizedMessage id='phase4b.notConfiguredUseAdminSetting' />}
                        </p>
                        <p>
                            SHORT_LINK_TARGET_SECRET:{' '}
                            <LocalizedMessage
                                id={
                                    process.env.SHORT_LINK_TARGET_SECRET
                                        ? 'phase4b.configured'
                                        : 'phase4b.notConfiguredFallsBackToAdminSecret'
                                }
                            />
                        </p>
                        <p>
                            <LocalizedMessage id='phase4b.headerBannerConfig' />{' '}
                            {process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_ENABLED ||
                            process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_IMAGE_URL
                                ? <LocalizedMessage id='phase4b.configuredFallback' />
                                : <LocalizedMessage id='phase4b.notConfigured' />}
                        </p>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
