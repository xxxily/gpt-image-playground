import { describe, expect, it } from 'vitest';
import {
    PROJECT_HEALTH_ADMIN_SETTINGS_FIXTURE,
    PROJECT_HEALTH_LEGACY_CONFIG_V1_FIXTURE,
    PROJECT_HEALTH_WORKBENCH_REGRESSION_FIXTURE
} from './project-health-regression-fixtures';

describe('project health regression fixtures', () => {
    it('keeps a serializable legacy config fixture for schema migration tests', () => {
        const cloned = JSON.parse(
            JSON.stringify(PROJECT_HEALTH_LEGACY_CONFIG_V1_FIXTURE)
        ) as typeof PROJECT_HEALTH_LEGACY_CONFIG_V1_FIXTURE;

        expect(cloned.openaiApiKey).toBe('sk-legacy-openai');
        expect(cloned.providerEndpoints).toEqual([]);
        expect(cloned.providerInstances?.[0]?.id).toBe('openai:default');
        expect(cloned.visionTextProviderInstances?.[0]?.id).toBe('vision:default');
    });

    it('separates backend settings by visibility and secret risk', () => {
        expect(PROJECT_HEALTH_ADMIN_SETTINGS_FIXTURE.publicRuntimeConfig.exposesSecrets).toBe(false);
        expect(PROJECT_HEALTH_ADMIN_SETTINGS_FIXTURE.serverSecretConfig.betterAuthSecretConfigured).toBe(false);
        expect(PROJECT_HEALTH_ADMIN_SETTINGS_FIXTURE.deploymentOnlyConfig.nodeEnv).toBe('production');
    });

    it('covers the Phase 2 workbench boundaries without depending on browser state', () => {
        expect(PROJECT_HEALTH_WORKBENCH_REGRESSION_FIXTURE.expectedBoundaries).toEqual(
            expect.arrayContaining([
                'submission',
                'history',
                'share',
                'sync',
                'desktop-assets',
                'video-boundary',
                'vision-text'
            ])
        );
        expect(PROJECT_HEALTH_WORKBENCH_REGRESSION_FIXTURE.expectedStorageGroups).toEqual(
            expect.arrayContaining(['config', 'history', 'sync', 'assets'])
        );
    });
});
