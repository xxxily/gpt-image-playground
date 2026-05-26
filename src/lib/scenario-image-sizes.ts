import type { AppLanguage } from '@/lib/i18n/language';
import {
    GEMINI_NANO_BANANA_2_MODEL,
    getImageModel,
    type ImageModelDefinition,
    type ImageModelId,
    type ImageProviderId,
    type StoredCustomImageModel
} from '@/lib/model-registry';
import {
    GEMINI_SIZE_OPTIONS,
    SENSENOVA_SIZE_OPTIONS,
    getSeedreamSizeOptions,
    type ProviderSizeOption
} from '@/lib/provider-advanced-options';
import {
    GPT_IMAGE_2_EDGE_MULTIPLE,
    GPT_IMAGE_2_MAX_ASPECT,
    GPT_IMAGE_2_MAX_EDGE,
    GPT_IMAGE_2_MAX_PIXELS,
    GPT_IMAGE_2_MIN_PIXELS,
    GPT_IMAGE_2_SIZE_PRESETS,
    validateGptImage2Size,
    type OpenAIImageSizeTier,
    type SizeValidation
} from '@/lib/size-utils';

export type LocalizedScenarioText = Record<AppLanguage, string>;

export type ScenarioSizeSourceConfidence =
    | 'official'
    | 'officialAds'
    | 'platformPractice'
    | 'industryStandard'
    | 'practical';

export type ScenarioSizeCategory =
    | 'social'
    | 'ads'
    | 'web'
    | 'videoCover'
    | 'screen'
    | 'ecommerce'
    | 'print'
    | 'photo'
    | 'office'
    | 'brand'
    | 'appStore';

export type ScenarioSizeTier = '512' | '1K' | '2K' | '3K' | '4K';

export type ScenarioSizeAdapterKind = 'customPixels' | 'enumeratedPixels' | 'fixedPreset';
export type ScenarioSizeMatchQuality = 'exact' | 'near' | 'fallback' | 'unavailable';

export type ScenarioImageSizeSource = {
    id: string;
    title: LocalizedScenarioText;
    category: ScenarioSizeCategory;
    platforms: readonly string[];
    useCases: readonly string[];
    sourceWidth?: number;
    sourceHeight?: number;
    ratioLabel: string;
    ratio: number;
    confidence: ScenarioSizeSourceConfidence;
    tags: readonly string[];
    note?: LocalizedScenarioText;
    safeArea?: LocalizedScenarioText;
    popularity: number;
};

export type ModelDeclaredSizeOption = {
    value: string;
    width: number;
    height: number;
    ratio?: string;
    tier?: ScenarioSizeTier | string;
    label?: string;
    description?: string;
};

export type ScenarioSizeRequest = {
    preferredTier?: ScenarioSizeTier;
    includeUnavailable?: boolean;
};

export type ScenarioModelSizeOption = {
    source: ScenarioImageSizeSource;
    adapterId: string;
    adapterKind: ScenarioSizeAdapterKind;
    provider: ImageProviderId;
    modelId: string;
    modelLabel: string;
    modelSize: string;
    width: number;
    height: number;
    tier: ScenarioSizeTier | string;
    ratioLabel: string;
    exactRatioMatch: boolean;
    matchQuality: ScenarioSizeMatchQuality;
    ratioDelta: number;
    transformed: boolean;
    valid: boolean;
    disabledReason?: LocalizedScenarioText;
    optionLabel?: string;
    optionDescription?: string;
};

export type GptImage2ScenarioSizeVariant = {
    value: string;
    width: number;
    height: number;
    tier: OpenAIImageSizeTier;
    ratioLabel: string;
    ratio: number;
};

export type ScenarioSizeAdapter = {
    id: string;
    kind: ScenarioSizeAdapterKind;
    provider: ImageProviderId;
    modelId: string;
    modelLabel: string;
    defaultTier: ScenarioSizeTier;
    tiers: readonly ScenarioSizeTier[];
    resolve: (source: ScenarioImageSizeSource, request?: ScenarioSizeRequest) => ScenarioModelSizeOption[];
    validate: (value: string) => SizeValidation;
};

const TEXT = {
    unavailableRatio: {
        'zh-CN': '当前模型不支持这个宽高比。',
        'en-US': 'This aspect ratio is not supported by the current model.'
    },
    unavailableSize: {
        'zh-CN': '当前模型没有可提交的匹配尺寸。',
        'en-US': 'The current model has no valid matching size.'
    }
} satisfies Record<string, LocalizedScenarioText>;

function text(zh: string, en: string): LocalizedScenarioText {
    return { 'zh-CN': zh, 'en-US': en };
}

function scenario(input: Omit<ScenarioImageSizeSource, 'ratio' | 'popularity'> & { popularity?: number }): ScenarioImageSizeSource {
    const ratio = input.sourceWidth && input.sourceHeight ? input.sourceWidth / input.sourceHeight : ratioLabelToNumber(input.ratioLabel);
    return {
        ...input,
        ratio,
        popularity: input.popularity ?? 50
    };
}

function ratioLabelToNumber(label: string): number {
    const trimmed = label.trim();
    if (trimmed === '1:1.414') return 1 / Math.SQRT2;
    const [left, right] = trimmed.split(':').map(Number);
    if (Number.isFinite(left) && Number.isFinite(right) && right > 0) return left / right;
    return 1;
}

export const SCENARIO_SIZE_CATEGORIES: readonly ScenarioSizeCategory[] = [
    'social',
    'videoCover',
    'ads',
    'web',
    'ecommerce',
    'screen',
    'print',
    'photo',
    'office',
    'brand',
    'appStore'
];

export const SCENARIO_IMAGE_SIZE_SOURCES: readonly ScenarioImageSizeSource[] = [
    scenario({
        id: 'instagram-feed-square',
        title: text('Instagram Feed 方图', 'Instagram feed square'),
        category: 'social',
        platforms: ['Instagram'],
        useCases: ['feed', 'carousel'],
        sourceWidth: 1080,
        sourceHeight: 1080,
        ratioLabel: '1:1',
        confidence: 'officialAds',
        tags: ['feed', 'square', 'carousel'],
        note: text('兼容度最高，适合公告、单图和轮播首图。', 'Most compatible for announcements, single images, and carousel covers.'),
        popularity: 96
    }),
    scenario({
        id: 'instagram-feed-portrait',
        title: text('Instagram Feed 竖图', 'Instagram feed portrait'),
        category: 'social',
        platforms: ['Instagram', 'Facebook', 'X', 'LinkedIn'],
        useCases: ['feed', 'mobile'],
        sourceWidth: 1080,
        sourceHeight: 1350,
        ratioLabel: '4:5',
        confidence: 'officialAds',
        tags: ['feed', 'portrait', 'mobile'],
        note: text('移动信息流占屏更高，标题和主体不要贴边。', 'Takes more mobile feed space; keep titles and subjects away from edges.'),
        popularity: 100
    }),
    scenario({
        id: 'xiaohongshu-cover',
        title: text('小红书图文首图', 'Xiaohongshu post cover'),
        category: 'social',
        platforms: ['小红书'],
        useCases: ['cover', 'feed'],
        sourceWidth: 1242,
        sourceHeight: 1660,
        ratioLabel: '3:4',
        confidence: 'practical',
        tags: ['cover', 'portrait', 'cn'],
        note: text('中文图文首图常用比例，标题可放上三分之一但需留安全边。', 'A common Chinese lifestyle post cover ratio. Keep title text in the upper third with safe margins.'),
        safeArea: text('左右至少留 64px，标题不要贴顶。', 'Leave at least 64px on both sides and avoid top-edge titles.'),
        popularity: 99
    }),
    scenario({
        id: 'stories-reels-short-video',
        title: text('Stories / Reels / 抖音封面', 'Stories / Reels / short-video cover'),
        category: 'videoCover',
        platforms: ['Instagram', 'Facebook', 'YouTube Shorts', 'TikTok', '抖音', '快手', '视频号', 'Snapchat'],
        useCases: ['story', 'reels', 'shorts', 'cover'],
        sourceWidth: 1080,
        sourceHeight: 1920,
        ratioLabel: '9:16',
        confidence: 'officialAds',
        tags: ['fullscreen', 'portrait', 'video'],
        note: text('短视频和全屏竖版默认规格，需避开上下互动 UI。', 'Default full-screen vertical format; avoid top and bottom UI zones.'),
        safeArea: text('核心文字放在中间 80% 宽度、70% 高度内。', 'Keep key text inside the central 80% width and 70% height.'),
        popularity: 100
    }),
    scenario({
        id: 'youtube-thumbnail',
        title: text('YouTube / B站横版视频封面', 'YouTube / Bilibili landscape thumbnail'),
        category: 'videoCover',
        platforms: ['YouTube', 'B站', '视频号'],
        useCases: ['thumbnail', 'cover'],
        sourceWidth: 1280,
        sourceHeight: 720,
        ratioLabel: '16:9',
        confidence: 'official',
        tags: ['video', 'landscape', 'thumbnail'],
        note: text('横版视频封面和演示屏幕最通用比例。', 'The most common landscape ratio for video thumbnails and presentation screens.'),
        popularity: 98
    }),
    scenario({
        id: 'bilibili-cover',
        title: text('B站投稿封面', 'Bilibili upload cover'),
        category: 'videoCover',
        platforms: ['B站'],
        useCases: ['cover', 'thumbnail'],
        sourceWidth: 1146,
        sourceHeight: 717,
        ratioLabel: '16:10',
        confidence: 'platformPractice',
        tags: ['video', 'cover', 'cn'],
        note: text('B站生态常见封面规格，主体居中可兼容推荐流裁切。', 'Common in the Bilibili ecosystem; centered subjects survive feed cropping better.'),
        popularity: 82
    }),
    scenario({
        id: 'open-graph-share',
        title: text('Open Graph / 链接卡片', 'Open Graph / link card'),
        category: 'web',
        platforms: ['Facebook', 'LinkedIn', 'X', '微信', 'Web'],
        useCases: ['link-card', 'share'],
        sourceWidth: 1200,
        sourceHeight: 630,
        ratioLabel: '1.91:1',
        confidence: 'officialAds',
        tags: ['share', 'landscape', 'web'],
        note: text('适合网页分享、X/LinkedIn/Facebook 链接卡片和广告横图。', 'Good for web sharing, X/LinkedIn/Facebook link cards, and landscape ad creatives.'),
        safeArea: text('移动端可能二次裁切，主信息放在中心 70%。', 'Mobile previews may crop; keep key information in the central 70%.'),
        popularity: 96
    }),
    scenario({
        id: 'x-landscape-single-image',
        title: text('X / Twitter 单图横版', 'X / Twitter single landscape image'),
        category: 'social',
        platforms: ['X'],
        useCases: ['feed', 'single-image'],
        sourceWidth: 1200,
        sourceHeight: 675,
        ratioLabel: '16:9',
        confidence: 'officialAds',
        tags: ['feed', 'landscape'],
        popularity: 78
    }),
    scenario({
        id: 'wechat-article-cover',
        title: text('微信公众号首条封面', 'WeChat official account lead cover'),
        category: 'social',
        platforms: ['微信公众号'],
        useCases: ['article-cover'],
        sourceWidth: 900,
        sourceHeight: 383,
        ratioLabel: '2.35:1',
        confidence: 'platformPractice',
        tags: ['article', 'wide', 'cn'],
        note: text('公众号后台长期使用规格，转发卡片会二次裁切。', 'Long-running WeChat cover practice; shared cards may crop it again.'),
        safeArea: text('核心标题和 Logo 放中间 70% 区域。', 'Keep title and logo in the central 70% area.'),
        popularity: 92
    }),
    scenario({
        id: 'linkedin-profile-banner',
        title: text('LinkedIn 个人背景图', 'LinkedIn profile background'),
        category: 'social',
        platforms: ['LinkedIn'],
        useCases: ['profile-banner'],
        sourceWidth: 1584,
        sourceHeight: 396,
        ratioLabel: '4:1',
        confidence: 'official',
        tags: ['banner', 'profile'],
        note: text('头像会遮挡左侧，当前模型会映射到最接近可用比例。', 'The avatar covers the left area; models map this to the nearest supported ratio.'),
        popularity: 54
    }),
    scenario({
        id: 'brand-wide-cover',
        title: text('品牌封面横图', 'Brand wide cover'),
        category: 'brand',
        platforms: ['Web', 'X', 'Bluesky', '微博'],
        useCases: ['brand-cover', 'header'],
        sourceWidth: 1920,
        sourceHeight: 640,
        ratioLabel: '3:1',
        confidence: 'practical',
        tags: ['banner', 'brand'],
        popularity: 72
    }),
    scenario({
        id: 'pinterest-standard-pin',
        title: text('Pinterest 标准 Pin', 'Pinterest standard pin'),
        category: 'social',
        platforms: ['Pinterest'],
        useCases: ['pin', 'feed'],
        sourceWidth: 1000,
        sourceHeight: 1500,
        ratioLabel: '2:3',
        confidence: 'officialAds',
        tags: ['pin', 'portrait'],
        note: text('Pinterest 最核心规格，过长图片可能被截断。', 'Pinterest’s core format; overly long images may be truncated.'),
        popularity: 86
    }),
    scenario({
        id: 'google-display-medium-rectangle',
        title: text('Google Display 中矩形广告', 'Google Display medium rectangle'),
        category: 'ads',
        platforms: ['Google Ads'],
        useCases: ['display-ad'],
        sourceWidth: 300,
        sourceHeight: 250,
        ratioLabel: '6:5',
        confidence: 'officialAds',
        tags: ['ads', 'rectangle'],
        popularity: 88
    }),
    scenario({
        id: 'google-display-half-page',
        title: text('Google Display Half Page', 'Google Display half page'),
        category: 'ads',
        platforms: ['Google Ads'],
        useCases: ['display-ad'],
        sourceWidth: 300,
        sourceHeight: 600,
        ratioLabel: '1:2',
        confidence: 'officialAds',
        tags: ['ads', 'portrait'],
        popularity: 67
    }),
    scenario({
        id: 'ecommerce-square-product',
        title: text('电商高清商品主图', 'E-commerce high-resolution product image'),
        category: 'ecommerce',
        platforms: ['Shopify', 'Amazon', '淘宝', '天猫', '京东', 'eBay'],
        useCases: ['product-main'],
        sourceWidth: 2048,
        sourceHeight: 2048,
        ratioLabel: '1:1',
        confidence: 'officialAds',
        tags: ['product', 'square'],
        note: text('商品图优先方图高清源，方便放大预览和跨平台复用。', 'Use a high-resolution square source for zoom previews and cross-platform reuse.'),
        popularity: 96
    }),
    scenario({
        id: 'ecommerce-mobile-banner',
        title: text('电商移动端 Banner', 'E-commerce mobile banner'),
        category: 'ecommerce',
        platforms: ['淘宝', '天猫', '京东', 'Shopify'],
        useCases: ['mobile-banner'],
        sourceWidth: 750,
        sourceHeight: 300,
        ratioLabel: '2.5:1',
        confidence: 'platformPractice',
        tags: ['banner', 'mobile'],
        popularity: 64
    }),
    scenario({
        id: 'screen-landscape-fhd',
        title: text('横屏 Full HD / 演示屏', 'Landscape Full HD / presentation screen'),
        category: 'screen',
        platforms: ['Digital Signage', 'PowerPoint', 'Keynote'],
        useCases: ['screen', 'presentation'],
        sourceWidth: 1920,
        sourceHeight: 1080,
        ratioLabel: '16:9',
        confidence: 'industryStandard',
        tags: ['screen', 'landscape'],
        popularity: 94
    }),
    scenario({
        id: 'screen-vertical-fhd',
        title: text('竖屏 Full HD 海报屏', 'Vertical Full HD signage'),
        category: 'screen',
        platforms: ['Digital Signage', '电梯屏', '门店屏'],
        useCases: ['screen', 'poster'],
        sourceWidth: 1080,
        sourceHeight: 1920,
        ratioLabel: '9:16',
        confidence: 'industryStandard',
        tags: ['screen', 'portrait'],
        popularity: 90
    }),
    scenario({
        id: 'powerpoint-standard',
        title: text('PowerPoint 标准 4:3', 'PowerPoint standard 4:3'),
        category: 'office',
        platforms: ['PowerPoint', 'Google Slides'],
        useCases: ['presentation'],
        sourceWidth: 1024,
        sourceHeight: 768,
        ratioLabel: '4:3',
        confidence: 'industryStandard',
        tags: ['presentation', 'screen'],
        popularity: 52
    }),
    scenario({
        id: 'a-series-poster',
        title: text('A 系列纸张竖版母版', 'A-series portrait print master'),
        category: 'print',
        platforms: ['Print', 'A4', 'A3', 'Poster'],
        useCases: ['print-master', 'poster'],
        sourceWidth: 2480,
        sourceHeight: 3508,
        ratioLabel: '1:1.414',
        confidence: 'official',
        tags: ['print', 'poster'],
        note: text('仅用于生成视觉母版，印刷交付仍需按印厂模板、出血和 300ppi 复核。', 'Use as a visual master only; final print delivery still needs vendor templates, bleed, and 300ppi checks.'),
        popularity: 72
    }),
    scenario({
        id: 'letter-print',
        title: text('Letter 纸张竖版母版', 'Letter portrait print master'),
        category: 'print',
        platforms: ['Print', 'Letter'],
        useCases: ['print-master', 'document'],
        sourceWidth: 2550,
        sourceHeight: 3300,
        ratioLabel: '8.5:11',
        confidence: 'industryStandard',
        tags: ['print', 'document'],
        note: text('北美文件、简历、传单常用比例。', 'Common for North American documents, resumes, and flyers.'),
        popularity: 50
    }),
    scenario({
        id: 'photo-4x5',
        title: text('8x10 / 4:5 摄影输出', '8x10 / 4:5 photo print'),
        category: 'photo',
        platforms: ['Photo Print'],
        useCases: ['photo', 'portrait'],
        sourceWidth: 2400,
        sourceHeight: 3000,
        ratioLabel: '4:5',
        confidence: 'industryStandard',
        tags: ['photo', 'portrait'],
        popularity: 64
    }),
    scenario({
        id: 'photo-3x2',
        title: text('3:2 摄影横图', '3:2 landscape photo'),
        category: 'photo',
        platforms: ['Photo Print', 'Camera'],
        useCases: ['photo'],
        sourceWidth: 1800,
        sourceHeight: 1200,
        ratioLabel: '3:2',
        confidence: 'industryStandard',
        tags: ['photo', 'landscape'],
        popularity: 66
    }),
    scenario({
        id: 'app-store-icon',
        title: text('App 图标源图', 'App icon source'),
        category: 'appStore',
        platforms: ['App Store', 'Google Play', 'PWA'],
        useCases: ['app-icon'],
        sourceWidth: 1024,
        sourceHeight: 1024,
        ratioLabel: '1:1',
        confidence: 'official',
        tags: ['icon', 'square'],
        note: text('应用商店源图不要自行加圆角。', 'Do not add rounded corners to app-store icon source art.'),
        popularity: 76
    }),
    scenario({
        id: 'google-play-feature-graphic',
        title: text('Google Play Feature Graphic', 'Google Play feature graphic'),
        category: 'appStore',
        platforms: ['Google Play'],
        useCases: ['store-asset'],
        sourceWidth: 1024,
        sourceHeight: 500,
        ratioLabel: '2.048:1',
        confidence: 'official',
        tags: ['store', 'wide'],
        popularity: 58
    }),
    scenario({
        id: 'logo-horizontal',
        title: text('Logo 横版画布', 'Horizontal logo canvas'),
        category: 'brand',
        platforms: ['Brand', 'Web'],
        useCases: ['logo'],
        sourceWidth: 2400,
        sourceHeight: 800,
        ratioLabel: '3:1',
        confidence: 'practical',
        tags: ['logo', 'brand'],
        popularity: 60
    })
];

const GPT_TIER_LONG_EDGE: Record<ScenarioSizeTier, number> = {
    '512': 1024,
    '1K': 1280,
    '2K': 2048,
    '3K': 3072,
    '4K': 3840
};

const TIER_ORDER: readonly ScenarioSizeTier[] = ['512', '1K', '2K', '3K', '4K'];
const GPT_IMAGE_2_SCENARIO_TIERS: readonly OpenAIImageSizeTier[] = ['1K', '2K', '3K', '4K'];
const BASE_RATIO_LABELS: readonly string[] = [
    '1:1',
    '4:5',
    '5:4',
    '3:4',
    '4:3',
    '2:3',
    '3:2',
    '9:16',
    '16:9',
    '1.91:1',
    '2:1',
    '1:2',
    '3:1',
    '1:3',
    '2.35:1',
    '1:1.414',
    '6:5',
    '5:6',
    '16:10',
    '10:16',
    '21:9',
    '9:21'
];

function parseSizeValue(value: string): { width: number; height: number } | null {
    const match = /^(\d+)x(\d+)$/u.exec(value);
    if (!match) return null;
    return { width: Number(match[1]), height: Number(match[2]) };
}

function ratioDelta(candidateRatio: number, targetRatio: number): number {
    return Math.abs(Math.log(candidateRatio / targetRatio));
}

function ratioMatchQuality(delta: number, exact: boolean): ScenarioSizeMatchQuality {
    if (exact || delta < 0.025) return 'exact';
    if (delta < 0.18) return 'near';
    return 'fallback';
}

function sameRatioLabel(sourceLabel: string, optionRatio?: string): boolean {
    if (!optionRatio) return false;
    return sourceLabel === optionRatio || ratioDelta(ratioLabelToNumber(optionRatio), ratioLabelToNumber(sourceLabel)) < 0.025;
}

function tierDistance(candidate: string | undefined, preferred: ScenarioSizeTier): number {
    const candidateIndex = TIER_ORDER.indexOf(candidate as ScenarioSizeTier);
    const preferredIndex = TIER_ORDER.indexOf(preferred);
    if (candidateIndex < 0 || preferredIndex < 0) return 10;
    return Math.abs(candidateIndex - preferredIndex);
}

function getSourcePixelTarget(source: ScenarioImageSizeSource, tier: ScenarioSizeTier): number {
    const longEdge = GPT_TIER_LONG_EDGE[tier];
    const longShortRatio = Math.max(source.ratio, 1 / source.ratio);
    return Math.min(GPT_IMAGE_2_MAX_PIXELS, Math.max(GPT_IMAGE_2_MIN_PIXELS, (longEdge * longEdge) / longShortRatio));
}

function isValidGptCandidate(width: number, height: number): boolean {
    return validateGptImage2Size(width, height).valid;
}

function findGptImage2Candidate(source: ScenarioImageSizeSource, tier: ScenarioSizeTier): { width: number; height: number } | null {
    const targetRatio = source.ratio;
    const longShortRatio = Math.max(targetRatio, 1 / targetRatio);
    if (longShortRatio > GPT_IMAGE_2_MAX_ASPECT) return null;

    const targetPixels = getSourcePixelTarget(source, tier);
    let targetWidth = Math.sqrt(targetPixels * targetRatio);
    let targetHeight = targetWidth / targetRatio;
    const edgeScale = Math.min(1, GPT_IMAGE_2_MAX_EDGE / targetWidth, GPT_IMAGE_2_MAX_EDGE / targetHeight);
    targetWidth *= edgeScale;
    targetHeight *= edgeScale;

    let best: { width: number; height: number; score: number } | null = null;
    const consider = (width: number, height: number) => {
        if (!isValidGptCandidate(width, height)) return;
        const candidateRatio = width / height;
        const pixels = width * height;
        const score =
            ratioDelta(candidateRatio, targetRatio) * 10 +
            Math.abs(Math.log(pixels / targetPixels)) * 2 +
            (Math.abs(width - targetWidth) + Math.abs(height - targetHeight)) / GPT_IMAGE_2_MAX_EDGE;
        if (!best || score < best.score) best = { width, height, score };
    };

    for (
        let candidateWidth = GPT_IMAGE_2_EDGE_MULTIPLE;
        candidateWidth <= GPT_IMAGE_2_MAX_EDGE;
        candidateWidth += GPT_IMAGE_2_EDGE_MULTIPLE
    ) {
        const matchingHeight = Math.round(candidateWidth / targetRatio / GPT_IMAGE_2_EDGE_MULTIPLE) * GPT_IMAGE_2_EDGE_MULTIPLE;
        consider(candidateWidth, matchingHeight);
        consider(candidateWidth, matchingHeight - GPT_IMAGE_2_EDGE_MULTIPLE);
        consider(candidateWidth, matchingHeight + GPT_IMAGE_2_EDGE_MULTIPLE);
    }

    for (
        let candidateHeight = GPT_IMAGE_2_EDGE_MULTIPLE;
        candidateHeight <= GPT_IMAGE_2_MAX_EDGE;
        candidateHeight += GPT_IMAGE_2_EDGE_MULTIPLE
    ) {
        const matchingWidth = Math.round(candidateHeight * targetRatio / GPT_IMAGE_2_EDGE_MULTIPLE) * GPT_IMAGE_2_EDGE_MULTIPLE;
        consider(matchingWidth, candidateHeight);
        consider(matchingWidth - GPT_IMAGE_2_EDGE_MULTIPLE, candidateHeight);
        consider(matchingWidth + GPT_IMAGE_2_EDGE_MULTIPLE, candidateHeight);
    }

    const resolvedBest = best as { width: number; height: number; score: number } | null;
    return resolvedBest ? { width: resolvedBest.width, height: resolvedBest.height } : null;
}

function gptImage2Adapter(model: ImageModelDefinition): ScenarioSizeAdapter {
    const validate = (value: string): SizeValidation => {
        const parsed = parseSizeValue(value);
        if (!parsed) return { valid: false, reason: 'Invalid size value.' };
        return validateGptImage2Size(parsed.width, parsed.height);
    };

    return {
        id: 'gpt-image-2-custom-pixels',
        kind: 'customPixels',
        provider: model.provider,
        modelId: model.id,
        modelLabel: model.label,
        defaultTier: '2K',
        tiers: ['1K', '2K', '3K', '4K'],
        validate,
        resolve: (source, request) => {
            const tier = request?.preferredTier && request.preferredTier !== '512' ? request.preferredTier : '2K';
            const candidate = findGptImage2Candidate(source, tier);
            if (!candidate) {
                return request?.includeUnavailable
                    ? [
                          {
                              source,
                              adapterId: 'gpt-image-2-custom-pixels',
                              adapterKind: 'customPixels',
                              provider: model.provider,
                              modelId: model.id,
                              modelLabel: model.label,
                              modelSize: '',
                              width: 0,
                              height: 0,
                              tier,
                              ratioLabel: source.ratioLabel,
                              exactRatioMatch: false,
                              matchQuality: 'unavailable',
                              ratioDelta: Number.POSITIVE_INFINITY,
                              transformed: true,
                              valid: false,
                              disabledReason: TEXT.unavailableRatio
                          }
                      ]
                    : [];
            }
            const delta = ratioDelta(candidate.width / candidate.height, source.ratio);
            const modelSize = `${candidate.width}x${candidate.height}`;
            return [
                {
                    source,
                    adapterId: 'gpt-image-2-custom-pixels',
                    adapterKind: 'customPixels',
                    provider: model.provider,
                    modelId: model.id,
                    modelLabel: model.label,
                    modelSize,
                    width: candidate.width,
                    height: candidate.height,
                    tier,
                    ratioLabel: source.ratioLabel,
                    exactRatioMatch: delta < 0.025,
                    matchQuality: ratioMatchQuality(delta, delta < 0.025),
                    ratioDelta: delta,
                    transformed: source.sourceWidth !== candidate.width || source.sourceHeight !== candidate.height,
                    valid: validate(modelSize).valid
                }
            ];
        }
    };
}

function providerOptionToDeclared(option: ProviderSizeOption): ModelDeclaredSizeOption | null {
    const parsed = parseSizeValue(option.value);
    if (!parsed) return null;
    return {
        value: option.value,
        width: parsed.width,
        height: parsed.height,
        ratio: option.ratio,
        tier: option.tier,
        label: option.label,
        description: option.description
    };
}

function enumeratedAdapter(
    model: ImageModelDefinition,
    adapterId: string,
    options: readonly ProviderSizeOption[],
    defaultTier: ScenarioSizeTier = '2K'
): ScenarioSizeAdapter {
    const declaredOptions = options.map(providerOptionToDeclared).filter((option): option is ModelDeclaredSizeOption => Boolean(option));
    const valueSet = new Set(declaredOptions.map((option) => option.value));
    const tiers = Array.from(new Set(declaredOptions.map((option) => option.tier).filter(Boolean))) as ScenarioSizeTier[];

    return {
        id: adapterId,
        kind: 'enumeratedPixels',
        provider: model.provider,
        modelId: model.id,
        modelLabel: model.label,
        defaultTier,
        tiers: tiers.length > 0 ? tiers : [defaultTier],
        validate: (value) => (valueSet.has(value) ? { valid: true } : { valid: false, reason: 'Unsupported size value.' }),
        resolve: (source, request) => {
            const preferredTier = request?.preferredTier ?? defaultTier;
            const ranked = declaredOptions
                .map((option) => {
                    const candidateRatio = option.width / option.height;
                    const delta = ratioDelta(candidateRatio, source.ratio);
                    const exactRatio = sameRatioLabel(source.ratioLabel, option.ratio) || delta < 0.025;
                    const sourcePixels = source.sourceWidth && source.sourceHeight ? source.sourceWidth * source.sourceHeight : 0;
                    const pixelDelta = sourcePixels > 0 ? Math.abs(Math.log((option.width * option.height) / sourcePixels)) : 0;
                    const score = (exactRatio ? 0 : delta * 10) + tierDistance(option.tier, preferredTier) * 2 + pixelDelta * 0.1;
                    return { option, delta, exactRatio, score };
                })
                .sort((a, b) => a.score - b.score || b.option.width * b.option.height - a.option.width * a.option.height);

            const best = ranked[0];
            if (!best) {
                return request?.includeUnavailable
                    ? [
                          {
                              source,
                              adapterId,
                              adapterKind: 'enumeratedPixels',
                              provider: model.provider,
                              modelId: model.id,
                              modelLabel: model.label,
                              modelSize: '',
                              width: 0,
                              height: 0,
                              tier: preferredTier,
                              ratioLabel: source.ratioLabel,
                              exactRatioMatch: false,
                              matchQuality: 'unavailable',
                              ratioDelta: Number.POSITIVE_INFINITY,
                              transformed: true,
                              valid: false,
                              disabledReason: TEXT.unavailableSize
                          }
                      ]
                    : [];
            }

            return [
                {
                    source,
                    adapterId,
                    adapterKind: 'enumeratedPixels',
                    provider: model.provider,
                    modelId: model.id,
                    modelLabel: model.label,
                    modelSize: best.option.value,
                    width: best.option.width,
                    height: best.option.height,
                    tier: best.option.tier ?? preferredTier,
                    ratioLabel: best.option.ratio ?? source.ratioLabel,
                    exactRatioMatch: best.exactRatio,
                    matchQuality: ratioMatchQuality(best.delta, best.exactRatio),
                    ratioDelta: best.delta,
                    transformed: source.sourceWidth !== best.option.width || source.sourceHeight !== best.option.height,
                    valid: true,
                    optionLabel: best.option.label,
                    optionDescription: best.option.description
                }
            ];
        }
    };
}

function fixedPresetAdapter(model: ImageModelDefinition): ScenarioSizeAdapter | null {
    const options = Object.entries(model.sizePresets ?? {}).reduce<ProviderSizeOption[]>((items, [key, value]) => {
            const parsed = parseSizeValue(value);
            if (!parsed) return items;
            items.push({
                value,
                label: key,
                description: model.label,
                ratio:
                    key === 'square'
                        ? '1:1'
                        : key === 'landscape'
                          ? parsed.width >= parsed.height
                              ? '3:2'
                              : undefined
                          : key === 'portrait'
                            ? parsed.height >= parsed.width
                                ? '2:3'
                                : undefined
                            : undefined,
                tier: '1K'
            });
            return items;
        }, []);
    if (options.length === 0) return null;
    const adapter = enumeratedAdapter(model, `${model.id}-fixed-presets`, options, '1K');
    return { ...adapter, kind: 'fixedPreset' };
}

export function getScenarioSizeAdapter(
    modelId: ImageModelId,
    customModels: readonly StoredCustomImageModel[] = []
): ScenarioSizeAdapter | null {
    const model = getImageModel(modelId, customModels);
    if (model.id === 'gpt-image-2' || (model.provider === 'openai' && model.supportsCustomSize)) {
        return gptImage2Adapter(model);
    }
    if (model.id === GEMINI_NANO_BANANA_2_MODEL || model.provider === 'google') {
        return enumeratedAdapter(model, 'gemini-nano-banana-2-enumerated-pixels', GEMINI_SIZE_OPTIONS, '2K');
    }
    if (model.provider === 'sensenova') {
        return enumeratedAdapter(model, 'sensenova-enumerated-pixels', SENSENOVA_SIZE_OPTIONS, '2K');
    }
    if (model.provider === 'seedream') {
        return enumeratedAdapter(model, 'seedream-enumerated-pixels', getSeedreamSizeOptions(model.id), '2K');
    }
    return fixedPresetAdapter(model);
}

export function getScenarioSizeOptions(
    modelId: ImageModelId,
    customModels: readonly StoredCustomImageModel[] = [],
    request: ScenarioSizeRequest = {}
): ScenarioModelSizeOption[] {
    const adapter = getScenarioSizeAdapter(modelId, customModels);
    if (!adapter) return [];
    return SCENARIO_IMAGE_SIZE_SOURCES.flatMap((source) => adapter.resolve(source, request)).sort((a, b) => {
        if (a.valid !== b.valid) return a.valid ? -1 : 1;
        const qualityOrder: Record<ScenarioSizeMatchQuality, number> = {
            exact: 0,
            near: 1,
            fallback: 2,
            unavailable: 3
        };
        return (
            qualityOrder[a.matchQuality] - qualityOrder[b.matchQuality] ||
            b.source.popularity - a.source.popularity ||
            a.ratioDelta - b.ratioDelta
        );
    });
}

export function isScenarioSizeSupportedValue(
    modelId: ImageModelId,
    value: string,
    customModels: readonly StoredCustomImageModel[] = []
): boolean {
    if (!value || value === 'auto' || value === 'custom' || value === 'square' || value === 'landscape' || value === 'portrait') {
        return true;
    }
    const adapter = getScenarioSizeAdapter(modelId, customModels);
    if (!adapter) return false;
    return adapter.validate(value).valid;
}

export function getLocalizedScenarioText(value: LocalizedScenarioText | undefined, language: AppLanguage): string {
    if (!value) return '';
    return value[language] ?? value['zh-CN'] ?? value['en-US'] ?? '';
}

export function formatScenarioSize(width: number, height: number): string {
    return `${width}x${height}`;
}

function trimRatioPart(value: number): string {
    if (Math.abs(value - Math.round(value)) < 0.001) return String(Math.round(value));
    return value.toFixed(3).replace(/0+$/u, '').replace(/\.$/u, '');
}

function formatRatioLabelFromNumber(ratio: number): string {
    if (!Number.isFinite(ratio) || ratio <= 0) return '1:1';
    if (Math.abs(ratio - 1) < 0.025) return '1:1';
    if (ratio >= 1) return `${trimRatioPart(ratio)}:1`;
    return `1:${trimRatioPart(1 / ratio)}`;
}

export function getSwappedScenarioRatioLabel(ratioLabel: string): string | null {
    const ratio = ratioLabelToNumber(ratioLabel);
    if (!Number.isFinite(ratio) || ratio <= 0 || Math.abs(ratio - 1) < 0.025) return null;
    const [left, right] = ratioLabel.split(':').map((part) => part.trim()).filter(Boolean);
    if (left && right) return `${right}:${left}`;
    return formatRatioLabelFromNumber(1 / ratio);
}

export function getScenarioRatioOptionsWithSwap(ratioLabel: string): string[] {
    const swappedRatio = getSwappedScenarioRatioLabel(ratioLabel);
    return swappedRatio && swappedRatio !== ratioLabel ? [ratioLabel, swappedRatio] : [ratioLabel];
}

function getKnownScenarioRatioLabels(): string[] {
    const labels = new Set<string>(BASE_RATIO_LABELS);
    for (const source of SCENARIO_IMAGE_SIZE_SOURCES) {
        labels.add(source.ratioLabel);
    }
    for (const label of [...labels]) {
        const swapped = getSwappedScenarioRatioLabel(label);
        if (swapped) labels.add(swapped);
    }
    return [...labels];
}

function nearestScenarioRatioLabel(width: number, height: number): string {
    const targetRatio = width / height;
    const best = getKnownScenarioRatioLabels()
        .map((label) => ({
            label,
            delta: ratioDelta(ratioLabelToNumber(label), targetRatio)
        }))
        .sort((a, b) => a.delta - b.delta)[0];

    return best && best.delta < 0.03 ? best.label : formatRatioLabelFromNumber(targetRatio);
}

function createRatioOnlySource(ratioLabel: string): ScenarioImageSizeSource {
    return {
        id: `ratio-${ratioLabel}`,
        title: text(ratioLabel, ratioLabel),
        category: 'screen',
        platforms: ['Custom'],
        useCases: ['ratio'],
        ratioLabel,
        ratio: ratioLabelToNumber(ratioLabel),
        confidence: 'practical',
        tags: [],
        popularity: 0
    };
}

export function getGptImage2ScenarioSizeVariant(
    ratioLabel: string,
    tier: OpenAIImageSizeTier
): GptImage2ScenarioSizeVariant | null {
    const preset = GPT_IMAGE_2_SIZE_PRESETS.find((item) => item.tier === tier && item.ratio === ratioLabel);
    if (preset) {
        return {
            value: preset.value,
            width: preset.width,
            height: preset.height,
            tier,
            ratioLabel,
            ratio: preset.width / preset.height
        };
    }

    const source = createRatioOnlySource(ratioLabel);
    const longShortRatio = Math.max(source.ratio, 1 / source.ratio);
    if (!Number.isFinite(source.ratio) || source.ratio <= 0 || longShortRatio > GPT_IMAGE_2_MAX_ASPECT) return null;

    const candidate = findGptImage2Candidate(source, tier);
    if (!candidate) return null;

    const value = formatScenarioSize(candidate.width, candidate.height);
    if (!validateGptImage2Size(candidate.width, candidate.height).valid) return null;
    return {
        value,
        width: candidate.width,
        height: candidate.height,
        tier,
        ratioLabel,
        ratio: candidate.width / candidate.height
    };
}

export function getGptImage2ScenarioSizeVariants(ratioLabel: string): GptImage2ScenarioSizeVariant[] {
    return GPT_IMAGE_2_SCENARIO_TIERS.map((tier) => getGptImage2ScenarioSizeVariant(ratioLabel, tier)).filter(
        (variant): variant is GptImage2ScenarioSizeVariant => Boolean(variant)
    );
}

export function getGptImage2ScenarioSizeDescriptor(value: string): GptImage2ScenarioSizeVariant | null {
    const parsed = parseSizeValue(value);
    if (!parsed || !validateGptImage2Size(parsed.width, parsed.height).valid) return null;

    const ratioLabel = nearestScenarioRatioLabel(parsed.width, parsed.height);
    const variants = getGptImage2ScenarioSizeVariants(ratioLabel);
    const matchingVariant = variants.find((variant) => variant.value === value);
    if (matchingVariant) return matchingVariant;

    const pixels = parsed.width * parsed.height;
    const nearestTier =
        variants
            .map((variant) => ({
                tier: variant.tier,
                score:
                    ratioDelta(variant.width / variant.height, parsed.width / parsed.height) * 10 +
                    Math.abs(Math.log((variant.width * variant.height) / pixels))
            }))
            .sort((a, b) => a.score - b.score)[0]?.tier ?? '2K';

    return {
        value,
        width: parsed.width,
        height: parsed.height,
        tier: nearestTier,
        ratioLabel,
        ratio: parsed.width / parsed.height
    };
}
