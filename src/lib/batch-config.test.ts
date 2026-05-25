import {
    DEFAULT_BATCH_FEATURE_CONFIG,
    getBatchPlanningSystemPrompt,
    normalizeBatchFeatureConfig
} from './batch-config';
import { DEFAULT_BATCH_PLAN_SYSTEM_PROMPT } from './batch-plan-core';
import { describe, expect, it } from 'vitest';

describe('batch feature config', () => {
    it('fills defaults for missing config', () => {
        const config = normalizeBatchFeatureConfig(undefined);

        expect(config.defaultStrategyId).toBe('auto');
        expect(config.maxAutoTaskCount).toBe(8);
        expect(config.defaultFixedTaskCount).toBe(4);
        expect(config.strategies.map((strategy) => strategy.id)).toContain('json-import');
        expect(getBatchPlanningSystemPrompt(config, 'auto')).toBe(DEFAULT_BATCH_PLAN_SYSTEM_PROMPT);
    });

    it('keeps AI auto enabled and falls back when default strategy is disabled', () => {
        const config = normalizeBatchFeatureConfig({
            defaultStrategyId: 'json-import',
            strategies: [
                { id: 'auto', enabled: false, order: 2 },
                { id: 'json-import', enabled: false, order: 1 }
            ]
        });

        expect(config.strategies.find((strategy) => strategy.id === 'auto')?.enabled).toBe(true);
        expect(config.defaultStrategyId).toBe('auto');
    });

    it('preserves custom auto prompt without overwriting built-in prompt', () => {
        const customPrompt = 'Return only BatchPlan JSON.';
        const config = normalizeBatchFeatureConfig({
            promptTemplates: [
                {
                    id: DEFAULT_BATCH_FEATURE_CONFIG.promptTemplates[0].id,
                    customPrompt,
                    updatedAt: 123
                }
            ]
        });

        expect(getBatchPlanningSystemPrompt(config, 'auto')).toBe(customPrompt);
        expect(config.promptTemplates[0].builtInPrompt).toBe(DEFAULT_BATCH_PLAN_SYSTEM_PROMPT);
        expect(config.promptTemplates[0].updatedAt).toBe(123);
    });
});
