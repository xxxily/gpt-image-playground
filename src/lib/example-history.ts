import type { GptImageModel } from '@/lib/cost-utils';
import type { HistoryImage, HistoryMetadata } from '@/types/history';

export const EXAMPLE_HISTORY_HIDDEN_STORAGE_KEY = 'gpt-image-playground-hidden-example-history-v1';

export type ExampleHistoryMode = 'auto' | 'empty' | 'off';

export type ExampleHistoryImage = HistoryImage & {
    path: string;
    thumbnailPath: string;
    previewPath: string;
};

export type ExampleHistoryMetadata = Omit<HistoryMetadata, 'images'> & {
    isExample: true;
    featureLabel: string;
    images: ExampleHistoryImage[];
};

type ShouldShowExampleHistoryInput = {
    mode: ExampleHistoryMode;
    historyLength: number;
    visibleExampleCount: number;
};

const EXAMPLE_BASE_PATH = '/examples/history';

function exampleImage(slug: string, filename: string): ExampleHistoryImage {
    const assetBase = `${EXAMPLE_BASE_PATH}/${slug}`;

    return {
        filename,
        path: `${assetBase}/preview.webp`,
        thumbnailPath: `${assetBase}/thumb.webp`,
        previewPath: `${assetBase}/preview.webp`
    };
}

function exampleVariant(slug: string, index: number): ExampleHistoryImage {
    const filename = `${slug}-${index}.webp`;
    const assetBase = `${EXAMPLE_BASE_PATH}/${slug}/${index}`;

    return {
        filename,
        path: `${assetBase}-preview.webp`,
        thumbnailPath: `${assetBase}-thumb.webp`,
        previewPath: `${assetBase}-preview.webp`
    };
}

export function normalizeExampleHistoryMode(value?: string): ExampleHistoryMode {
    const normalized = value?.trim().toLowerCase();

    if (!normalized || normalized === 'auto' || normalized === 'true' || normalized === '1' || normalized === 'on') {
        return 'auto';
    }

    if (normalized === 'empty' || normalized === 'always') {
        return 'empty';
    }

    if (normalized === 'off' || normalized === 'false' || normalized === '0' || normalized === 'no') {
        return 'off';
    }

    return 'auto';
}

function normalizeHiddenExampleHistoryIds(value: unknown): number[] {
    if (!Array.isArray(value)) return [];

    return Array.from(
        new Set(
            value
                .map((id) => (typeof id === 'number' || typeof id === 'string' ? Number(id) : NaN))
                .filter((id) => Number.isFinite(id) && id > 0)
        )
    );
}

export function loadHiddenExampleHistoryIds(): number[] {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.localStorage.getItem(EXAMPLE_HISTORY_HIDDEN_STORAGE_KEY);
        if (!raw) return [];

        return normalizeHiddenExampleHistoryIds(JSON.parse(raw));
    } catch {
        return [];
    }
}

export function saveHiddenExampleHistoryIds(ids: readonly number[]): boolean {
    if (typeof window === 'undefined') return true;

    try {
        window.localStorage.setItem(
            EXAMPLE_HISTORY_HIDDEN_STORAGE_KEY,
            JSON.stringify(normalizeHiddenExampleHistoryIds([...ids]))
        );
        return true;
    } catch {
        return false;
    }
}

export function shouldShowExampleHistory({
    mode,
    historyLength,
    visibleExampleCount
}: ShouldShowExampleHistoryInput): boolean {
    if (mode === 'off') return false;
    if (historyLength > 0) return false;

    return visibleExampleCount > 0;
}

export function getVisibleExampleHistory(hiddenIds: Iterable<number>): ExampleHistoryMetadata[] {
    const hiddenIdSet = new Set(hiddenIds);

    return EXAMPLE_HISTORY.filter((item) => !hiddenIdSet.has(item.timestamp));
}

export function isExampleHistoryImage(image: HistoryImage): image is ExampleHistoryImage {
    const value = image as Partial<ExampleHistoryImage>;
    return typeof value.thumbnailPath === 'string' && typeof value.previewPath === 'string';
}

export function isExampleHistoryItem(item: HistoryMetadata | ExampleHistoryMetadata): item is ExampleHistoryMetadata {
    return (item as Partial<ExampleHistoryMetadata>).isExample === true;
}

export const EXAMPLE_HISTORY: ExampleHistoryMetadata[] = [
    {
        isExample: true,
        featureLabel: '一图速览',
        timestamp: 1700000500000,
        images: [exampleImage('image-editing', 'example-image-editing.webp')],
        storageModeUsed: 'url',
        durationMs: 14600,
        quality: 'high',
        background: 'auto',
        moderation: 'low',
        prompt: '生成一张 GPT Image Playground 项目一图速览信息图，集中展示生成工作台、图片编辑、提示词体系、多模型供应商、历史资产、成本估算、分享链接、S3 同步、桌面部署和本地优先。',
        mode: 'generate',
        costDetails: null,
        output_format: 'webp',
        model: 'gpt-image-2' as GptImageModel
    },
    {
        isExample: true,
        featureLabel: '提示词资产',
        timestamp: 1700000300000,
        images: [exampleImage('transparent-product', 'example-transparent-product.webp')],
        storageModeUsed: 'url',
        durationMs: 9100,
        quality: 'high',
        background: 'auto',
        moderation: 'low',
        prompt: '生成一张提示词资产信息图，突出模板库、斜杠搜索、历史复用、一键润色和本地自定义模板。',
        mode: 'generate',
        costDetails: null,
        output_format: 'webp',
        model: 'gpt-image-2' as GptImageModel
    },
    {
        isExample: true,
        featureLabel: '项目总览',
        timestamp: 1700000200000,
        images: [exampleImage('text-to-image', 'example-text-to-image.webp')],
        storageModeUsed: 'url',
        durationMs: 12800,
        quality: 'high',
        background: 'auto',
        moderation: 'low',
        prompt: '为 GPT Image Playground 生成一张项目总览信息图，展示生成、编辑、提示词、历史、供应商和同步六个核心模块。',
        mode: 'generate',
        costDetails: null,
        output_format: 'webp',
        model: 'gpt-image-2' as GptImageModel
    },
    {
        isExample: true,
        featureLabel: '体系能力',
        timestamp: 1700000100000,
        images: [
            exampleVariant('batch-variants', 1),
            exampleVariant('batch-variants', 2),
            exampleVariant('batch-variants', 3)
        ],
        storageModeUsed: 'url',
        durationMs: 18800,
        quality: 'high',
        background: 'auto',
        moderation: 'low',
        prompt: '生成三张项目能力信息图，分别介绍多供应商模型管理、历史资产管理、分享链接与 S3 云同步。',
        mode: 'generate',
        costDetails: null,
        output_format: 'webp',
        model: 'gpt-image-2' as GptImageModel
    }
];
