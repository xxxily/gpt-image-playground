import { loadConfig, type AppConfig } from './config';
import { loadImageFormPreferences, type ImageFormPreferences } from './form-preferences';
import { getImageReferenceConstraints } from './image-reference-limits';
import { getAllImageModels, getImageModel } from './model-registry';
import { getProviderCredentialConfig } from './provider-config';
import { getProviderInstance } from './provider-instances';
import { isExecutableShowcaseCase } from './showcase';
import type { ShowcaseCatalog, ShowcaseTopic } from './showcase';
import { getShowcaseCases } from './showcase-client';
import { evaluateShowcaseModelCompatibility } from './showcase-recipe';

export type ShowcaseTopicAvailability = 'ready' | 'compatible-unconfigured' | 'needs-compatible-model' | 'read-only';

function resolveProviderInstanceId(config: AppConfig, modelId: string, providerInstanceId?: string): string {
    const model = getImageModel(modelId, config.customImageModels);
    if (model.instanceId) return model.instanceId;
    const preferredInstance = config.providerInstances.find(
        (instance) => instance.id === providerInstanceId && instance.type === model.provider
    );
    if (preferredInstance) return preferredInstance.id;
    const configuredInstance = config.providerInstances.find(
        (instance) => instance.id === config.selectedProviderInstanceId && instance.type === model.provider
    );
    return configuredInstance?.id ?? getProviderInstance(config.providerInstances, model.provider).id;
}

function hasCredentials(config: AppConfig, modelId: string, providerInstanceId?: string): boolean {
    const model = getImageModel(modelId, config.customImageModels);
    return Boolean(
        getProviderCredentialConfig(
            config,
            model.provider,
            resolveProviderInstanceId(config, modelId, providerInstanceId)
        ).apiKey
    );
}

function hasAnyCredentials(config: AppConfig, modelId: string): boolean {
    const model = getImageModel(modelId, config.customImageModels);
    if (model.instanceId) return hasCredentials(config, modelId, model.instanceId);
    return config.providerInstances
        .filter((instance) => instance.type === model.provider)
        .some((instance) => Boolean(getProviderCredentialConfig(config, model.provider, instance.id).apiKey));
}

function isRecipeCompatible(
    config: AppConfig,
    modelId: string,
    catalog: ShowcaseCatalog,
    topic: ShowcaseTopic
): boolean {
    const model = getImageModel(modelId, config.customImageModels);
    return getShowcaseCases(catalog, topic)
        .filter(isExecutableShowcaseCase)
        .some((showcaseCase) => {
            const constraints = getImageReferenceConstraints(model.id, {
                customImageModels: config.customImageModels,
                outputCount: showcaseCase.recipe.output?.n ?? 1
            });
            return evaluateShowcaseModelCompatibility(showcaseCase.recipe, {
                id: model.id,
                label: model.label,
                supportsEditing: model.supportsEditing,
                supportsMask: model.supportsMask,
                supportsCustomSize: model.supportsCustomSize,
                maxReferenceImages: constraints.maxImages
            }).compatible;
        });
}

export function getShowcaseTopicAvailability(
    catalog: ShowcaseCatalog,
    topic: ShowcaseTopic,
    config: AppConfig,
    preferences: ImageFormPreferences
): ShowcaseTopicAvailability {
    const executableCases = getShowcaseCases(catalog, topic).filter(isExecutableShowcaseCase);
    if (executableCases.length === 0) return 'read-only';

    const currentModelId = String(preferences.model);
    if (
        isRecipeCompatible(config, currentModelId, catalog, topic) &&
        hasCredentials(config, currentModelId, preferences.providerInstanceId)
    ) {
        return 'ready';
    }

    const compatibleModels = getAllImageModels(config.customImageModels).filter((model) =>
        isRecipeCompatible(config, model.id, catalog, topic)
    );
    return compatibleModels.some((model) => hasAnyCredentials(config, model.id))
        ? 'compatible-unconfigured'
        : 'needs-compatible-model';
}

export function readShowcaseTopicAvailability(
    catalog: ShowcaseCatalog,
    topic: ShowcaseTopic
): ShowcaseTopicAvailability {
    return getShowcaseTopicAvailability(catalog, topic, loadConfig(), loadImageFormPreferences());
}
