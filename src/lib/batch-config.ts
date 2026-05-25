import {
    DEFAULT_BATCH_PLAN_MAX_COUNT,
    DEFAULT_BATCH_PLAN_SYSTEM_PROMPT,
    MAX_BATCH_PLAN_COUNT,
    normalizeBatchPlanCount,
    type BatchPlanningMode
} from '@/lib/batch-plan-core';

export type BatchPlanningStrategyId =
    | 'auto'
    | 'content-split'
    | 'variant-exploration'
    | 'reference-variant'
    | 'manual-split'
    | 'json-import';

export type BatchPlanningStrategyExecutionType = 'ai-plan' | 'local-split' | 'json-import';
export type BatchPromptTemplateOutputContract = 'batch-plan-json';
export type BatchParameterPolishScope = 'task-prompts' | 'task-prompts-and-negative-prompts';
export type BatchParameterPolishIntensity = 'light' | 'standard';

export type BatchPlanningStrategy = {
    id: BatchPlanningStrategyId;
    builtIn: boolean;
    enabled: boolean;
    order: number;
    labelKey: string;
    descriptionKey: string;
    executionType: BatchPlanningStrategyExecutionType;
    promptTemplateId?: string;
    defaultCountMode?: 'auto' | 'fixed';
    defaultMaxCount?: number;
    defaultTargetCount?: number;
};

export type BatchPromptTemplate = {
    id: string;
    strategyId: BatchPlanningStrategyId;
    version: number;
    builtInPrompt: string;
    customPrompt?: string;
    updatedAt?: number;
    outputContract: BatchPromptTemplateOutputContract;
};

export type BatchParameterPolishConfig = {
    enabled: boolean;
    scope: BatchParameterPolishScope;
    intensity: BatchParameterPolishIntensity;
    preserveLockedItems: boolean;
    preserveSourceExcerpt: boolean;
    preserveSourceImagePolicy: boolean;
};

export type BatchFeatureConfig = {
    defaultStrategyId: BatchPlanningStrategyId;
    strategies: BatchPlanningStrategy[];
    promptTemplates: BatchPromptTemplate[];
    maxAutoTaskCount: number;
    defaultFixedTaskCount: number;
    confirmLargeBatchThreshold: number;
    maxPreviewTaskCount: number;
    parameterPolish: BatchParameterPolishConfig;
};

const DEFAULT_MAX_AUTO_TASK_COUNT = 8;
const DEFAULT_FIXED_TASK_COUNT = 4;
const DEFAULT_CONFIRM_LARGE_BATCH_THRESHOLD = 12;

export const BATCH_AUTO_PROMPT_TEMPLATE_ID = 'batch.auto.default';
export const BATCH_CONTENT_SPLIT_PROMPT_TEMPLATE_ID = 'batch.contentSplit.default';
export const BATCH_VARIANT_EXPLORATION_PROMPT_TEMPLATE_ID = 'batch.variantExploration.default';
export const BATCH_REFERENCE_VARIANT_PROMPT_TEMPLATE_ID = 'batch.referenceVariant.default';

const BATCH_STRATEGY_IDS = new Set<BatchPlanningStrategyId>([
    'auto',
    'content-split',
    'variant-exploration',
    'reference-variant',
    'manual-split',
    'json-import'
]);

export const DEFAULT_BATCH_PARAMETER_POLISH_CONFIG: BatchParameterPolishConfig = {
    enabled: false,
    scope: 'task-prompts',
    intensity: 'light',
    preserveLockedItems: true,
    preserveSourceExcerpt: true,
    preserveSourceImagePolicy: true
};

export const DEFAULT_BATCH_PLANNING_STRATEGIES: BatchPlanningStrategy[] = [
    {
        id: 'auto',
        builtIn: true,
        enabled: true,
        order: 0,
        labelKey: 'batch.dialog.mode.auto',
        descriptionKey: 'settings.batch.strategy.auto.description',
        executionType: 'ai-plan',
        promptTemplateId: BATCH_AUTO_PROMPT_TEMPLATE_ID,
        defaultCountMode: 'auto',
        defaultMaxCount: DEFAULT_MAX_AUTO_TASK_COUNT
    },
    {
        id: 'content-split',
        builtIn: true,
        enabled: true,
        order: 1,
        labelKey: 'batch.dialog.mode.contentSplit',
        descriptionKey: 'settings.batch.strategy.contentSplit.description',
        executionType: 'ai-plan',
        promptTemplateId: BATCH_CONTENT_SPLIT_PROMPT_TEMPLATE_ID,
        defaultCountMode: 'auto',
        defaultMaxCount: DEFAULT_MAX_AUTO_TASK_COUNT
    },
    {
        id: 'variant-exploration',
        builtIn: true,
        enabled: true,
        order: 2,
        labelKey: 'batch.dialog.mode.variantExploration',
        descriptionKey: 'settings.batch.strategy.variantExploration.description',
        executionType: 'ai-plan',
        promptTemplateId: BATCH_VARIANT_EXPLORATION_PROMPT_TEMPLATE_ID,
        defaultCountMode: 'fixed',
        defaultTargetCount: DEFAULT_FIXED_TASK_COUNT
    },
    {
        id: 'reference-variant',
        builtIn: true,
        enabled: true,
        order: 3,
        labelKey: 'batch.dialog.mode.referenceVariant',
        descriptionKey: 'settings.batch.strategy.referenceVariant.description',
        executionType: 'ai-plan',
        promptTemplateId: BATCH_REFERENCE_VARIANT_PROMPT_TEMPLATE_ID,
        defaultCountMode: 'fixed',
        defaultTargetCount: DEFAULT_FIXED_TASK_COUNT
    },
    {
        id: 'manual-split',
        builtIn: true,
        enabled: true,
        order: 4,
        labelKey: 'batch.source.manual',
        descriptionKey: 'settings.batch.strategy.manualSplit.description',
        executionType: 'local-split'
    },
    {
        id: 'json-import',
        builtIn: true,
        enabled: true,
        order: 5,
        labelKey: 'batch.source.json',
        descriptionKey: 'settings.batch.strategy.jsonImport.description',
        executionType: 'json-import'
    }
];

export const DEFAULT_BATCH_PROMPT_TEMPLATES: BatchPromptTemplate[] = [
    {
        id: BATCH_AUTO_PROMPT_TEMPLATE_ID,
        strategyId: 'auto',
        version: 1,
        builtInPrompt: DEFAULT_BATCH_PLAN_SYSTEM_PROMPT,
        outputContract: 'batch-plan-json'
    },
    {
        id: BATCH_CONTENT_SPLIT_PROMPT_TEMPLATE_ID,
        strategyId: 'content-split',
        version: 1,
        builtInPrompt: DEFAULT_BATCH_PLAN_SYSTEM_PROMPT,
        outputContract: 'batch-plan-json'
    },
    {
        id: BATCH_VARIANT_EXPLORATION_PROMPT_TEMPLATE_ID,
        strategyId: 'variant-exploration',
        version: 1,
        builtInPrompt: DEFAULT_BATCH_PLAN_SYSTEM_PROMPT,
        outputContract: 'batch-plan-json'
    },
    {
        id: BATCH_REFERENCE_VARIANT_PROMPT_TEMPLATE_ID,
        strategyId: 'reference-variant',
        version: 1,
        builtInPrompt: DEFAULT_BATCH_PLAN_SYSTEM_PROMPT,
        outputContract: 'batch-plan-json'
    }
];

export const DEFAULT_BATCH_FEATURE_CONFIG: BatchFeatureConfig = {
    defaultStrategyId: 'auto',
    strategies: DEFAULT_BATCH_PLANNING_STRATEGIES,
    promptTemplates: DEFAULT_BATCH_PROMPT_TEMPLATES,
    maxAutoTaskCount: DEFAULT_MAX_AUTO_TASK_COUNT,
    defaultFixedTaskCount: DEFAULT_FIXED_TASK_COUNT,
    confirmLargeBatchThreshold: DEFAULT_CONFIRM_LARGE_BATCH_THRESHOLD,
    maxPreviewTaskCount: MAX_BATCH_PLAN_COUNT,
    parameterPolish: DEFAULT_BATCH_PARAMETER_POLISH_CONFIG
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeStrategyId(value: unknown, fallback: BatchPlanningStrategyId = 'auto'): BatchPlanningStrategyId {
    return typeof value === 'string' && BATCH_STRATEGY_IDS.has(value as BatchPlanningStrategyId)
        ? (value as BatchPlanningStrategyId)
        : fallback;
}

function normalizeBoundedCount(value: unknown, fallback: number): number {
    return normalizeBatchPlanCount(value, fallback);
}

function normalizeStrategy(
    value: unknown,
    defaultStrategy: BatchPlanningStrategy,
    index: number
): BatchPlanningStrategy {
    if (!isRecord(value)) return defaultStrategy;
    const id = normalizeStrategyId(value.id, defaultStrategy.id);
    if (id !== defaultStrategy.id) return defaultStrategy;
    const defaultCountMode = value.defaultCountMode === 'fixed' ? 'fixed' : value.defaultCountMode === 'auto' ? 'auto' : defaultStrategy.defaultCountMode;
    return {
        ...defaultStrategy,
        enabled: id === 'auto' ? true : typeof value.enabled === 'boolean' ? value.enabled : defaultStrategy.enabled,
        order:
            typeof value.order === 'number' && Number.isFinite(value.order)
                ? Math.max(0, Math.round(value.order))
                : index,
        ...(defaultCountMode ? { defaultCountMode } : {}),
        ...(value.defaultMaxCount !== undefined || defaultStrategy.defaultMaxCount !== undefined
            ? { defaultMaxCount: normalizeBoundedCount(value.defaultMaxCount, defaultStrategy.defaultMaxCount ?? DEFAULT_BATCH_PLAN_MAX_COUNT) }
            : {}),
        ...(value.defaultTargetCount !== undefined || defaultStrategy.defaultTargetCount !== undefined
            ? {
                  defaultTargetCount: normalizeBoundedCount(
                      value.defaultTargetCount,
                      defaultStrategy.defaultTargetCount ?? DEFAULT_FIXED_TASK_COUNT
                  )
              }
            : {})
    };
}

function normalizePromptTemplate(value: unknown, defaultTemplate: BatchPromptTemplate): BatchPromptTemplate {
    if (!isRecord(value)) return defaultTemplate;
    const customPrompt = trimString(value.customPrompt);
    const updatedAt = typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
        ? Math.max(0, Math.round(value.updatedAt))
        : undefined;
    return {
        ...defaultTemplate,
        ...(customPrompt ? { customPrompt } : {}),
        ...(updatedAt !== undefined ? { updatedAt } : {})
    };
}

function normalizeParameterPolishConfig(value: unknown): BatchParameterPolishConfig {
    if (!isRecord(value)) return DEFAULT_BATCH_PARAMETER_POLISH_CONFIG;
    return {
        enabled: value.enabled === true,
        scope:
            value.scope === 'task-prompts-and-negative-prompts'
                ? 'task-prompts-and-negative-prompts'
                : 'task-prompts',
        intensity: value.intensity === 'standard' ? 'standard' : 'light',
        preserveLockedItems: value.preserveLockedItems !== false,
        preserveSourceExcerpt: value.preserveSourceExcerpt !== false,
        preserveSourceImagePolicy: value.preserveSourceImagePolicy !== false
    };
}

export function normalizeBatchFeatureConfig(value: unknown): BatchFeatureConfig {
    const record = isRecord(value) ? value : {};
    const strategyRecords = Array.isArray(record.strategies) ? record.strategies : [];
    const strategyRecordById = new Map<string, unknown>();
    strategyRecords.forEach((item) => {
        if (isRecord(item) && typeof item.id === 'string') strategyRecordById.set(item.id, item);
    });
    const strategies = DEFAULT_BATCH_PLANNING_STRATEGIES.map((strategy, index) =>
        normalizeStrategy(strategyRecordById.get(strategy.id), strategy, index)
    ).sort((a, b) => a.order - b.order);

    const templateRecords = Array.isArray(record.promptTemplates) ? record.promptTemplates : [];
    const templateRecordById = new Map<string, unknown>();
    templateRecords.forEach((item) => {
        if (isRecord(item) && typeof item.id === 'string') templateRecordById.set(item.id, item);
    });
    const promptTemplates = DEFAULT_BATCH_PROMPT_TEMPLATES.map((template) =>
        normalizePromptTemplate(templateRecordById.get(template.id), template)
    );
    const enabledStrategyIds = new Set(strategies.filter((strategy) => strategy.enabled).map((strategy) => strategy.id));
    const defaultStrategyId = normalizeStrategyId(record.defaultStrategyId);

    return {
        defaultStrategyId: enabledStrategyIds.has(defaultStrategyId) ? defaultStrategyId : 'auto',
        strategies,
        promptTemplates,
        maxAutoTaskCount: normalizeBoundedCount(record.maxAutoTaskCount, DEFAULT_MAX_AUTO_TASK_COUNT),
        defaultFixedTaskCount: normalizeBoundedCount(record.defaultFixedTaskCount, DEFAULT_FIXED_TASK_COUNT),
        confirmLargeBatchThreshold: normalizeBoundedCount(
            record.confirmLargeBatchThreshold,
            DEFAULT_CONFIRM_LARGE_BATCH_THRESHOLD
        ),
        maxPreviewTaskCount: normalizeBoundedCount(record.maxPreviewTaskCount, MAX_BATCH_PLAN_COUNT),
        parameterPolish: normalizeParameterPolishConfig(record.parameterPolish)
    };
}

export function getBatchPromptTemplate(
    config: BatchFeatureConfig,
    strategyId: BatchPlanningStrategyId = 'auto'
): BatchPromptTemplate {
    const normalized = normalizeBatchFeatureConfig(config);
    const strategy = normalized.strategies.find((item) => item.id === strategyId);
    const templateId = strategy?.promptTemplateId || BATCH_AUTO_PROMPT_TEMPLATE_ID;
    return (
        normalized.promptTemplates.find((template) => template.id === templateId) ||
        normalized.promptTemplates.find((template) => template.id === BATCH_AUTO_PROMPT_TEMPLATE_ID) ||
        DEFAULT_BATCH_PROMPT_TEMPLATES[0]
    );
}

export function getBatchPlanningSystemPrompt(
    config: BatchFeatureConfig,
    strategyId: BatchPlanningStrategyId = 'auto'
): string {
    const template = getBatchPromptTemplate(config, strategyId);
    return template.customPrompt?.trim() || template.builtInPrompt;
}

export function batchStrategyIdToPlanningMode(strategyId: BatchPlanningStrategyId): BatchPlanningMode {
    if (strategyId === 'manual-split' || strategyId === 'json-import') return strategyId;
    return strategyId;
}

export function planningModeToBatchStrategyId(mode: BatchPlanningMode): BatchPlanningStrategyId {
    if (mode === 'mixed') return 'auto';
    return normalizeStrategyId(mode);
}
