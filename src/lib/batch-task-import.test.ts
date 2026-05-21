import {
    BATCH_TASK_IMPORT_SCHEMA_VERSION,
    BatchTaskImportError,
    buildManualSplitBatchPlan,
    parseBatchTaskImportJson
} from './batch-task-import';
import { describe, expect, it } from 'vitest';

describe('batch task import helpers', () => {
    it('builds a manual split plan from non-empty lines without changing prompts', () => {
        const result = buildManualSplitBatchPlan({
            sourceText: 'Poster A\n\nPoster B\nPoster C',
            sourceImageCount: 0,
            splitMode: 'non-empty-lines',
            trimWhitespace: true,
            ignoreEmpty: true
        });

        expect(result.plan.planningMode).toBe('manual-split');
        expect(result.plan.tasks.map((task) => task.prompt)).toEqual(['Poster A', 'Poster B', 'Poster C']);
        expect(result.plan.tasks.every((task) => task.sourceImagePolicy === 'none')).toBe(true);
    });

    it('splits by a literal custom delimiter and reports truncation', () => {
        const result = buildManualSplitBatchPlan({
            sourceText: 'A---B---C',
            sourceImageCount: 2,
            splitMode: 'custom-delimiter',
            customDelimiter: '---',
            trimWhitespace: true,
            ignoreEmpty: true
        });

        expect(result.plan.tasks).toHaveLength(3);
        expect(result.plan.tasks.every((task) => task.sourceImagePolicy === 'inherit-all')).toBe(true);
        expect(result.plan.summary).toBe('已按自定义分隔符切分为 3 条批量任务。');
        expect(result.plan.strategyReason).toBe('未调用 AI；每个文本片段按原文生成一条任务。');
    });

    it('imports the minimal JSON schema', () => {
        const result = parseBatchTaskImportJson({
            currentSourceImageCount: 0,
            jsonText: JSON.stringify({
                schemaVersion: BATCH_TASK_IMPORT_SCHEMA_VERSION,
                tasks: [{ prompt: 'Prompt 1' }, { prompt: 'Prompt 2', enabled: false }]
            })
        });

        expect(result.plan.planningMode).toBe('json-import');
        expect(result.plan.tasks).toHaveLength(2);
        expect(result.plan.tasks[0].prompt).toBe('Prompt 1');
        expect(result.plan.tasks[1].enabled).toBe(false);
    });

    it('imports supported task fields and defaults', () => {
        const result = parseBatchTaskImportJson({
            currentSourceImageCount: 1,
            jsonText: JSON.stringify({
                schemaVersion: BATCH_TASK_IMPORT_SCHEMA_VERSION,
                batchId: 'external_1',
                batchLabel: 'Campaign',
                defaults: {
                    negativePrompt: 'blurry'
                },
                tasks: [
                    {
                        id: 'task_2',
                        order: 2,
                        title: 'Second',
                        prompt: 'Prompt 2',
                        variationAxis: 'B'
                    },
                    {
                        id: 'task_1',
                        order: 1,
                        title: 'First',
                        prompt: 'Prompt 1',
                        sourceImagePolicy: 'none'
                    }
                ]
            })
        });

        expect(result.plan.batchId).toBe('external_1');
        expect(result.plan.summary).toBe('Campaign');
        expect(result.plan.strategyReason).toBe('未调用 AI；按外部 JSON 规范导入并归一化为批量预览。');
        expect(result.plan.tasks.map((task) => task.title)).toEqual(['First', 'Second']);
        expect(result.plan.tasks.every((task) => task.sourceImagePolicy === 'inherit-all')).toBe(true);
        expect(result.plan.tasks[1].negativePrompt).toBe('blurry');
    });

    it('reports item-level JSON import errors', () => {
        expect(() =>
            parseBatchTaskImportJson({
                currentSourceImageCount: 0,
                jsonText: JSON.stringify({
                    schemaVersion: BATCH_TASK_IMPORT_SCHEMA_VERSION,
                    tasks: [{ title: 'Missing prompt' }]
                })
            })
        ).toThrow(BatchTaskImportError);

        try {
            parseBatchTaskImportJson({
                currentSourceImageCount: 0,
                jsonText: JSON.stringify({
                    schemaVersion: BATCH_TASK_IMPORT_SCHEMA_VERSION,
                    tasks: [{ title: 'Missing prompt' }]
                })
            });
        } catch (error) {
            expect(error).toBeInstanceOf(BatchTaskImportError);
            expect((error as BatchTaskImportError).issues).toContainEqual({
                path: '$.tasks[0].prompt',
                code: 'promptRequired'
            });
        }
    });

    it('reports sensitive and unsupported fields as warnings', () => {
        const result = parseBatchTaskImportJson({
            currentSourceImageCount: 0,
            jsonText: JSON.stringify({
                schemaVersion: BATCH_TASK_IMPORT_SCHEMA_VERSION,
                apiKey: 'secret',
                defaults: { overrides: { size: '1024x1024' } },
                tasks: [{ prompt: 'Prompt 1', overrides: { n: 2 } }]
            })
        });

        expect(result.warnings).toEqual([
            { code: 'json.sensitiveIgnored', fields: ['apiKey'] },
            { code: 'json.overridesApplied', count: 1 }
        ]);
        expect(result.plan.tasks[0].overrides).toEqual({
            size: '1024x1024',
            n: 2
        });
    });
});
