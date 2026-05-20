import { describe, expect, it } from 'vitest';
import {
    buildBatchPlanPrompt,
    normalizeBatchPlan,
    parseBatchPlanText,
    type BuildBatchPlanPromptParams
} from './batch-plan-core';

const fallback: BuildBatchPlanPromptParams = {
    sourceText: '围绕新品咖啡做一组社媒海报',
    sourceImageCount: 2,
    planningMode: 'auto',
    countMode: 'auto',
    maxCount: 8
};

describe('batch plan core', () => {
    it('parses fenced JSON and normalizes source image inheritance', () => {
        const plan = parseBatchPlanText(
            `\`\`\`json
{
  "batchId": "batch_1",
  "sourceText": "围绕新品咖啡做一组社媒海报",
  "sourceImageCount": 2,
  "planningMode": "auto",
  "resolvedIntent": "reference-variant",
  "countMode": "auto",
  "recommendedCount": 2,
  "summary": "生成 2 个方向",
  "strategyReason": "有参考图，做多版本探索",
  "warnings": [],
  "tasks": [
    { "id": "", "order": 2, "enabled": true, "title": "暖色", "sourceExcerpt": "新品咖啡", "variationAxis": "暖色生活方式", "prompt": "参考源图，生成暖色咖啡海报" },
    { "id": "", "order": 1, "enabled": true, "title": "极简", "sourceExcerpt": "新品咖啡", "variationAxis": "极简商业", "prompt": "参考源图，生成极简咖啡海报", "sourceImagePolicy": "inherit-all" }
  ]
}
\`\`\``,
            fallback
        );

        expect(plan.batchId).toBe('batch_1');
        expect(plan.resolvedIntent).toBe('reference-variant');
        expect(plan.tasks).toHaveLength(2);
        expect(plan.tasks[0].order).toBe(1);
        expect(plan.tasks[0].sourceImagePolicy).toBe('inherit-all');
        expect(plan.tasks[1].sourceImagePolicy).toBe('inherit-all');
    });

    it('creates fallback items when model returns no valid tasks', () => {
        const plan = normalizeBatchPlan({ tasks: [] }, { ...fallback, targetCount: 3, countMode: 'fixed' });

        expect(plan.tasks).toHaveLength(3);
        expect(plan.tasks.every((task) => task.prompt === fallback.sourceText)).toBe(true);
        expect(plan.tasks.every((task) => task.sourceImagePolicy === 'inherit-all')).toBe(true);
    });

    it('builds prompt with fixed count and source image context', () => {
        const prompt = buildBatchPlanPrompt({ ...fallback, countMode: 'fixed', targetCount: 5 });

        expect(prompt).toContain('固定数量：请生成 5 条任务。');
        expect(prompt).toContain('当前有 2 张源图片');
        expect(prompt).toContain('BatchPlan JSON');
    });
});
