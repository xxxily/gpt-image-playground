import { LocalizedMessage } from '@/components/localized-message';
import type { SettingsView } from '@/components/settings/settings-view-meta';
import { SettingsNavigationButton, statusBadge } from '@/components/settings/view-shared';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Cpu, Globe, Radio, Sparkles } from 'lucide-react';

type Translate = (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string;

type ProvidersViewProps = {
    t: Translate;
    endpointCount: number;
    imageEndpointCount: number;
    videoEndpointCount: number;
    modelCatalogCount: number;
    onViewChange: (view: SettingsView) => void;
};

export function ProvidersView({
    t,
    endpointCount,
    imageEndpointCount,
    videoEndpointCount,
    modelCatalogCount,
    onViewChange
}: ProvidersViewProps) {
    return (
        <div className='space-y-4'>
            <Button
                type='button'
                variant='ghost'
                onClick={() => onViewChange('main')}
                className='text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] rounded-xl px-3'>
                <ArrowLeft className='h-4 w-4' />
                <LocalizedMessage id='settings.backToMain' />
            </Button>
            <div className='rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-950 dark:text-violet-100'>
                {t('settings.providers.banner')}
            </div>

            <SettingsNavigationButton
                title={t('settings.providerEndpointsTitle')}
                description={t('settings.nav.providerEndpointsDescription')}
                icon={<Globe className='h-5 w-5' />}
                badge={statusBadge(t('settings.providers.endpointBadge', { count: String(endpointCount) }), 'blue')}
                onClick={() => onViewChange('provider-endpoints')}
            />

            <SettingsNavigationButton
                title={t('settings.imageEndpointsTitle')}
                description={t('settings.nav.imageEndpointsDescription')}
                icon={<Cpu className='h-5 w-5' />}
                badge={statusBadge(
                    t('settings.providers.endpointBadge', { count: String(imageEndpointCount) }),
                    'blue'
                )}
                onClick={() => onViewChange('image-endpoints')}
            />

            <SettingsNavigationButton
                title={t('settings.videoEndpointsTitle')}
                description={t('settings.nav.videoEndpointsDescription')}
                icon={<Radio className='h-5 w-5' />}
                badge={statusBadge(
                    t('settings.providers.endpointBadge', { count: String(videoEndpointCount) }),
                    'blue'
                )}
                onClick={() => onViewChange('video-endpoints')}
            />

            <SettingsNavigationButton
                title={t('settings.modelCatalogTitle')}
                description={t('settings.modelCatalogDescription')}
                icon={<Sparkles className='h-5 w-5' />}
                badge={statusBadge(t('settings.modelCatalog.itemBadge', { count: String(modelCatalogCount) }), 'blue')}
                onClick={() => onViewChange('model-catalog')}
            />
        </div>
    );
}
