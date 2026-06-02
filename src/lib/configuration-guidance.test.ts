import {
    CONFIGURATION_REQUIRED_MESSAGE,
    getConfigurationGuidanceKindFromMessage,
    getConfigurationGuidanceTarget,
    getConfigurationGuidanceTargetForMessage,
    isConfigurationRequiredMessage
} from '@/lib/configuration-guidance';
import { describe, expect, it } from 'vitest';

describe('configuration guidance helpers', () => {
    it('maps default task kinds to the shortest settings targets', () => {
        expect(getConfigurationGuidanceTarget('image')).toMatchObject({
            view: 'image-endpoints',
            intent: 'add-endpoint',
            taskCapability: 'image.generate'
        });
        expect(getConfigurationGuidanceTarget('visionText')).toMatchObject({
            view: 'vision-text',
            intent: 'select-task-model',
            taskCapability: 'vision.text'
        });
        expect(getConfigurationGuidanceTarget('polish')).toMatchObject({
            view: 'polish-prompts',
            intent: 'select-task-model',
            taskCapability: 'prompt.polish'
        });
        expect(getConfigurationGuidanceTarget('batch')).toMatchObject({
            view: 'batch-config',
            intent: 'select-task-model',
            taskCapability: 'prompt.batchPlan'
        });
        expect(getConfigurationGuidanceTarget('video')).toMatchObject({
            view: 'video-endpoints',
            intent: 'add-endpoint',
            taskCapability: 'video.generate'
        });
    });

    it('recognizes legacy missing-configuration messages', () => {
        expect(isConfigurationRequiredMessage('服务器中转模式需要配置 API Key。请在系统设置中填写 API Key')).toBe(true);
        expect(isConfigurationRequiredMessage('OPENAI_API_KEY is not set. UI: none, Env: none')).toBe(true);
        expect(isConfigurationRequiredMessage(`${CONFIGURATION_REQUIRED_MESSAGE} (code: configuration_required)`)).toBe(
            true
        );
        expect(
            isConfigurationRequiredMessage(
                'Gemini Nano Banana 2 requires GEMINI_API_KEY or a Gemini API Key in settings.'
            )
        ).toBe(true);
        expect(isConfigurationRequiredMessage('无效的令牌')).toBe(false);
    });

    it('infers the task kind from legacy messages when possible', () => {
        expect(getConfigurationGuidanceKindFromMessage('请先在图生文与多模态设置中选择端点和模型。')).toBe(
            'visionText'
        );
        expect(getConfigurationGuidanceKindFromMessage('提示词润色需要先选择可用模型。')).toBe('polish');
        expect(getConfigurationGuidanceKindFromMessage('批量规划需要配置 API Key。')).toBe('batch');
        expect(getConfigurationGuidanceKindFromMessage('请选择一个视频模型')).toBe('video');
        expect(getConfigurationGuidanceKindFromMessage('直连模式需要配置 API Key，请在系统设置中填写。')).toBe('image');
    });

    it('uses the caller fallback when the shared short message has no task context', () => {
        expect(getConfigurationGuidanceTargetForMessage(CONFIGURATION_REQUIRED_MESSAGE, 'batch')).toMatchObject({
            view: 'batch-config',
            taskCapability: 'prompt.batchPlan'
        });
        expect(
            getConfigurationGuidanceTargetForMessage(
                `${CONFIGURATION_REQUIRED_MESSAGE} (code: configuration_required)`,
                'visionText'
            )
        ).toMatchObject({
            view: 'vision-text',
            taskCapability: 'vision.text'
        });
    });
});
