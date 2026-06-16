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
        expect(translateLegacyUiString('宽度和高度都需要是 16 的倍数。')).toBe(
            'Width and height must both be multiples of 16.'
        );
        expect(translateLegacyUiString('推荐可提交尺寸：')).toBe('Recommended valid size:');
        expect(translateLegacyUiString('模型列表读取失败。')).toBe('Failed to load the model list.');
        expect(translateLegacyUiString('重大操作：清空图生文历史')).toBe(
            'Destructive Action: Clear Image-to-Text History'
        );
        expect(translateLegacyUiString('添加所选')).toBe('Add Selected');
        expect(translateLegacyUiString('确认删除图生文历史')).toBe('Delete Image-to-Text History');
        expect(translateLegacyUiString('确认删除审计记录')).toBe('Delete Audit Log');
    });

    it('translates video provider onboarding labels', () => {
        expect(translateLegacyUiString('选择供应商模板')).toBe('Select Provider Template');
        expect(translateLegacyUiString('视频供应商端点')).toBe('Video Provider Endpoints');
        expect(translateLegacyUiString('真实视频模型已绑定')).toBe('Real Video Model Bound');
        expect(translateLegacyUiString('待补模型')).toBe('Models Needed');
        expect(translateLegacyUiString('读取并选择模型')).toBe('Load and Select Models');
        expect(translateLegacyUiString('全选当前结果')).toBe('Select Current Results');
        expect(translateLegacyUiString('清空选择')).toBe('Clear Selection');
        expect(translateLegacyUiString('已添加')).toBe('Added');
        expect(translateLegacyUiString('已发现')).toBe('Discovered');
        expect(translateLegacyUiString('手动模型 ID')).toBe('Manual Model ID');
        expect(translateLegacyUiString('显示名（可选）')).toBe('Display name (optional)');
        expect(translateLegacyUiString('厂商（可选）')).toBe('Provider (optional)');
        expect(translateLegacyUiString('端点已添加。请选择模型并保存。')).toBe(
            'Endpoint added. Select models and save.'
        );
    });

    it('translates common dynamic legacy labels', () => {
        expect(translateLegacyUiString('查看源图片 2')).toBe('View source image 2');
        expect(translateLegacyUiString('查看源图片 2，拖动可调整顺序')).toBe('View source image 2; drag to reorder');
        expect(translateLegacyUiString('提示词模板库')).toBe('Prompt Template Library');
        expect(translateLegacyUiString('图生文结果')).toBe('Image-to-Text Result');
        expect(translateLegacyUiString('最近 7 天图片')).toBe('Images from the last 7 days');
        expect(translateLegacyUiString('最近 12 小时图生文')).toBe('Image-to-text from the last 12 hours');
        expect(translateLegacyUiString('已发现 3 个模型。')).toBe('Discovered 3 models.');
        expect(translateLegacyUiString('openai / GPT Image 2 · 发现')).toBe('openai / GPT Image 2 · Discovered');
        expect(translateLegacyUiString('绑定 openai:relay')).toBe('Bound to openai:relay');
        expect(translateLegacyUiString('0 已配置')).toBe('0 configured');
        expect(translateLegacyUiString('2 可自动读取')).toBe('2 auto discoverable');
        expect(translateLegacyUiString('3 条图生文')).toBe('3 image-to-text items');
        expect(translateLegacyUiString('已删除 3 条图生文历史。')).toBe('Deleted 3 image-to-text history items.');
        expect(translateLegacyUiString('确定要删除此图生文历史吗？将移除 2 张源图。此操作不可撤销。')).toBe(
            'Delete this image-to-text history item? It will remove 2 source images. This cannot be undone.'
        );
        expect(translateLegacyUiString('上传最近 7 天图片 1/2')).toBe('Uploading images from the last 7 days 1/2');
        expect(translateLegacyUiString('同步选中 3 项图片历史完成')).toBe(
            'Sync 3 selected image history items complete'
        );
        expect(translateLegacyUiString('上传选中 2 项图生文源图 1/2')).toBe(
            'Uploading source images for 2 selected image-to-text items 1/2'
        );
        expect(translateLegacyUiString('新版本 v2.10.0 可用（当前 v2.9.0），可直接下载并安装。')).toBe(
            'New version v2.10.0 is available (current v2.9.0) and can be downloaded and installed directly.'
        );
        expect(translateLegacyUiString('（当前 ENV 格式：openai）')).toBe('(current ENV format: openai)');
        expect(translateLegacyUiString('直连模式图生文失败：目标地址可能不支持 CORS。原始错误: Failed to fetch')).toBe(
            'Direct-mode image-to-text failed: the target may not support CORS. Original error: Failed to fetch'
        );
    });

    it('leaves unknown strings to React resources', () => {
        expect(translateLegacyUiString('some provider value')).toBeNull();
    });
});
