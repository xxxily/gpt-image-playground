export type SettingsView =
    | 'main'
    | 'providers'
    | 'provider-endpoints'
    | 'image-endpoints'
    | 'video-endpoints'
    | 'vision-text'
    | 'model-catalog'
    | 'polish-prompts'
    | 'batch-config';

type SettingsViewMeta = {
    titleKey: string;
    descriptionKey: string;
};

export const SETTINGS_VIEW_META: Record<SettingsView, SettingsViewMeta> = {
    main: {
        titleKey: 'settings.title',
        descriptionKey: 'settings.description'
    },
    providers: {
        titleKey: 'settings.providersTitle',
        descriptionKey: 'settings.providersDescription'
    },
    'provider-endpoints': {
        titleKey: 'settings.providerEndpointsTitle',
        descriptionKey: 'settings.providerEndpointsDescription'
    },
    'image-endpoints': {
        titleKey: 'settings.imageEndpointsTitle',
        descriptionKey: 'settings.imageEndpointsDescription'
    },
    'video-endpoints': {
        titleKey: 'settings.videoEndpointsTitle',
        descriptionKey: 'settings.videoEndpointsDescription'
    },
    'vision-text': {
        titleKey: 'settings.visionTextTitle',
        descriptionKey: 'settings.visionTextDescription'
    },
    'model-catalog': {
        titleKey: 'settings.modelCatalogTitle',
        descriptionKey: 'settings.modelCatalogDescription'
    },
    'polish-prompts': {
        titleKey: 'settings.polishTitle',
        descriptionKey: 'settings.polishDescription'
    },
    'batch-config': {
        titleKey: 'settings.batch.title',
        descriptionKey: 'settings.batch.description'
    }
};

export function getSettingsViewMeta(view: SettingsView): SettingsViewMeta {
    return SETTINGS_VIEW_META[view] ?? SETTINGS_VIEW_META.main;
}
