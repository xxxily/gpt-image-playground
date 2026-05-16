import { translateLegacyUiString } from './legacy-text';
import { describe, expect, it } from 'vitest';

describe('legacy UI text bridge', () => {
    it('translates exact legacy labels', () => {
        expect(translateLegacyUiString('系统配置')).toBe('System Settings');
        expect(translateLegacyUiString('开始生成')).toBe('Generate');
        expect(translateLegacyUiString('统一模型目录')).toBe('Unified Model Catalog');
        expect(translateLegacyUiString('图生文与多模态')).toBe('Image-to-Text and Multimodal');
        expect(translateLegacyUiString('图生文模型')).toBe('Image-to-Text Model');
        expect(translateLegacyUiString('搜索模型 ID、显示名、端点、厂商或能力')).toBe(
            'Search model ID, display name, endpoint, provider, or capability'
        );
        expect(translateLegacyUiString('添加模型')).toBe('Add Model');
        expect(translateLegacyUiString('刷新模型')).toBe('Refresh Models');
        expect(translateLegacyUiString('正在读取模型列表…')).toBe('Loading model list...');
        expect(translateLegacyUiString('提示词润色失败，请稍后重试。')).toBe(
            'Prompt polishing failed. Please try again later.'
        );
        expect(translateLegacyUiString('模型列表读取失败。')).toBe('Failed to load the model list.');
    });

    it('translates common dynamic legacy labels', () => {
        expect(translateLegacyUiString('查看源图片 2')).toBe('View source image 2');
        expect(translateLegacyUiString('提示词模板库')).toBe('Prompt Template Library');
        expect(translateLegacyUiString('图生文结果')).toBe('Image-to-Text Result');
        expect(translateLegacyUiString('最近 7 天图片')).toBe('Images from the last 7 days');
        expect(translateLegacyUiString('最近 12 小时图生文')).toBe('Image-to-text from the last 12 hours');
        expect(translateLegacyUiString('已发现 3 个模型。')).toBe('Discovered 3 models.');
        expect(translateLegacyUiString('openai / GPT Image 2 · 发现')).toBe('openai / GPT Image 2 · Discovered');
        expect(translateLegacyUiString('绑定 openai:relay')).toBe('Bound to openai:relay');
        expect(translateLegacyUiString('3 条图生文')).toBe('3 image-to-text items');
        expect(translateLegacyUiString('已删除 3 条图生文历史。')).toBe('Deleted 3 image-to-text history items.');
        expect(translateLegacyUiString('上传最近 7 天图片 1/2')).toBe('Uploading images from the last 7 days 1/2');
        expect(translateLegacyUiString('新版本 v2.10.0 可用（当前 v2.9.0），可直接下载并安装。')).toBe(
            'New version v2.10.0 is available (current v2.9.0) and can be downloaded and installed directly.'
        );
        expect(translateLegacyUiString('（当前 ENV 格式：openai）')).toBe('(current ENV format: openai)');
    });

    it('leaves unknown strings to React resources', () => {
        expect(translateLegacyUiString('some provider value')).toBeNull();
    });
});
