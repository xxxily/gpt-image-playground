export const PROMO_SLOT_DEFINITIONS = [
    {
        key: 'generation_form_header',
        name: '生成区头部',
        description: '输入/编辑卡片头部右侧',
        defaultIntervalMs: 5000,
        defaultTransition: 'fade'
    },
    {
        key: 'app_top_banner',
        name: '页面顶部',
        description: 'Logo 下方横幅',
        defaultIntervalMs: 5000,
        defaultTransition: 'fade'
    },
    {
        key: 'history_top_banner',
        name: '历史面板上方',
        description: '历史区横幅',
        defaultIntervalMs: 5000,
        defaultTransition: 'fade'
    }
] as const;

export const PROMO_TRANSITIONS = ['fade', 'slide', 'none'] as const;
export type PromoTransition = (typeof PROMO_TRANSITIONS)[number];

export const PROMO_DEVICE_VALUES = ['all', 'desktop', 'mobile'] as const;
export type PromoDevice = (typeof PROMO_DEVICE_VALUES)[number];

export const PROMO_ASPECT_RATIO_SOURCES = ['preset', 'custom', 'legacySlot'] as const;
export type PromoAspectRatioSource = (typeof PROMO_ASPECT_RATIO_SOURCES)[number];

export type PromoAspectRatio = {
    width: number;
    height: number;
    label: string;
    source: PromoAspectRatioSource;
};

export type PromoAspectRatioPresetGroup =
    | 'square'
    | 'portrait'
    | 'landscape'
    | 'shareCard'
    | 'banner'
    | 'ultraWide';

export type PromoAspectRatioPreset = {
    id: string;
    label: string;
    width: number;
    height: number;
    group: PromoAspectRatioPresetGroup;
    recommendedSlots?: readonly string[];
};

export type PromoSlotKey = (typeof PROMO_SLOT_DEFINITIONS)[number]['key'];

export const PROMO_MAX_ASPECT_RATIO_EDGE = 20;

export const PROMO_ASPECT_RATIO_PRESETS = [
    { id: '1-1', label: '1:1', width: 1, height: 1, group: 'square' },
    { id: '4-5', label: '4:5', width: 4, height: 5, group: 'portrait' },
    { id: '3-4', label: '3:4', width: 3, height: 4, group: 'portrait' },
    { id: '2-3', label: '2:3', width: 2, height: 3, group: 'portrait' },
    { id: '9-16', label: '9:16', width: 9, height: 16, group: 'portrait' },
    { id: '5-4', label: '5:4', width: 5, height: 4, group: 'landscape' },
    { id: '4-3', label: '4:3', width: 4, height: 3, group: 'landscape' },
    { id: '3-2', label: '3:2', width: 3, height: 2, group: 'landscape' },
    { id: '16-9', label: '16:9', width: 16, height: 9, group: 'landscape' },
    { id: '191-100', label: '1.91:1', width: 191, height: 100, group: 'shareCard' },
    { id: '2-1', label: '2:1', width: 2, height: 1, group: 'shareCard' },
    {
        id: '3-1',
        label: '3:1',
        width: 3,
        height: 1,
        group: 'banner',
        recommendedSlots: ['app_top_banner', 'history_top_banner']
    },
    {
        id: '4-1',
        label: '4:1',
        width: 4,
        height: 1,
        group: 'banner',
        recommendedSlots: ['generation_form_header']
    },
    {
        id: '5-1',
        label: '5:1',
        width: 5,
        height: 1,
        group: 'banner',
        recommendedSlots: ['app_top_banner', 'history_top_banner']
    },
    {
        id: '10-1',
        label: '10:1',
        width: 10,
        height: 1,
        group: 'banner',
        recommendedSlots: ['app_top_banner', 'history_top_banner']
    },
    { id: '21-9', label: '21:9', width: 21, height: 9, group: 'ultraWide' },
    {
        id: '12-1',
        label: '12:1',
        width: 12,
        height: 1,
        group: 'ultraWide',
        recommendedSlots: ['app_top_banner', 'history_top_banner']
    }
] as const satisfies readonly PromoAspectRatioPreset[];

function gcd(a: number, b: number): number {
    let x = Math.abs(Math.trunc(a));
    let y = Math.abs(Math.trunc(b));
    while (y !== 0) {
        const next = x % y;
        x = y;
        y = next;
    }
    return x || 1;
}

function simplifyRatio(width: number, height: number): { width: number; height: number } | null {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    const roundedWidth = Math.round(width);
    const roundedHeight = Math.round(height);
    const divisor = gcd(roundedWidth, roundedHeight);
    const simplifiedWidth = roundedWidth / divisor;
    const simplifiedHeight = roundedHeight / divisor;
    const edgeRatio = Math.max(simplifiedWidth, simplifiedHeight) / Math.min(simplifiedWidth, simplifiedHeight);
    if (edgeRatio > PROMO_MAX_ASPECT_RATIO_EDGE) return null;
    return { width: simplifiedWidth, height: simplifiedHeight };
}

function findPresetByDimensions(width: number, height: number): PromoAspectRatioPreset | null {
    return PROMO_ASPECT_RATIO_PRESETS.find((preset) => preset.width === width && preset.height === height) || null;
}

export function formatPromoAspectRatioLabel(width: number, height: number): string {
    const preset = findPresetByDimensions(width, height);
    return preset?.label || `${width}:${height}`;
}

export function normalizePromoAspectRatio(
    width: number,
    height: number,
    source: PromoAspectRatioSource = 'custom'
): PromoAspectRatio | null {
    const simplified = simplifyRatio(width, height);
    if (!simplified) return null;
    return {
        width: simplified.width,
        height: simplified.height,
        label: formatPromoAspectRatioLabel(simplified.width, simplified.height),
        source
    };
}

export function parsePromoAspectRatio(
    value: string | null | undefined,
    source: PromoAspectRatioSource = 'custom'
): PromoAspectRatio | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/u);
    if (!match) return null;
    const widthText = match[1];
    const heightText = match[2];
    const widthPart = Number(widthText);
    const heightPart = Number(heightText);
    if (!Number.isFinite(widthPart) || !Number.isFinite(heightPart) || widthPart <= 0 || heightPart <= 0) return null;
    const widthDecimals = widthText.includes('.') ? widthText.split('.')[1]?.length || 0 : 0;
    const heightDecimals = heightText.includes('.') ? heightText.split('.')[1]?.length || 0 : 0;
    const scale = 10 ** Math.max(widthDecimals, heightDecimals);
    const normalizedWidth = Math.round(widthPart * scale);
    const normalizedHeight = Math.round(heightPart * scale);
    return normalizePromoAspectRatio(normalizedWidth, normalizedHeight, source);
}

export function serializePromoAspectRatioCss(aspectRatio: PromoAspectRatio | null | undefined): string {
    if (!aspectRatio || aspectRatio.width <= 0 || aspectRatio.height <= 0) return '4 / 1';
    return `${aspectRatio.width} / ${aspectRatio.height}`;
}

export type PromoCreativeTarget = {
    recommendedRatio: string;
    recommendedPixels: string;
    minimumPixels: string;
    displaySize: string;
    safeArea: 'centered' | 'centerBand';
};

export type PromoSlotCreativeGuidance = {
    slotKey: PromoSlotKey;
    fitMode: 'contain';
    desktop: PromoCreativeTarget;
    mobile: PromoCreativeTarget;
};

export const PROMO_SLOT_CREATIVE_GUIDANCE = {
    generation_form_header: {
        slotKey: 'generation_form_header',
        fitMode: 'contain',
        desktop: {
            recommendedRatio: '4:1',
            recommendedPixels: '1200 x 300 px',
            minimumPixels: '960 x 240 px',
            displaySize: '188-248 x 47-62 px',
            safeArea: 'centered'
        },
        mobile: {
            recommendedRatio: '4:1',
            recommendedPixels: '960 x 240 px',
            minimumPixels: '800 x 200 px',
            displaySize: '144-252 x 36-63 px',
            safeArea: 'centered'
        }
    },
    app_top_banner: {
        slotKey: 'app_top_banner',
        fitMode: 'contain',
        desktop: {
            recommendedRatio: '10:1',
            recommendedPixels: '2000 x 200 px',
            minimumPixels: '1600 x 160 px',
            displaySize: '684-1500 x 68-150 px',
            safeArea: 'centerBand'
        },
        mobile: {
            recommendedRatio: '4:1',
            recommendedPixels: '1200 x 300 px',
            minimumPixels: '800 x 200 px',
            displaySize: '252-394 x 63-99 px',
            safeArea: 'centerBand'
        }
    },
    history_top_banner: {
        slotKey: 'history_top_banner',
        fitMode: 'contain',
        desktop: {
            recommendedRatio: '10:1',
            recommendedPixels: '2000 x 200 px',
            minimumPixels: '1600 x 160 px',
            displaySize: '684-1500 x 68-150 px',
            safeArea: 'centerBand'
        },
        mobile: {
            recommendedRatio: '4:1',
            recommendedPixels: '1200 x 300 px',
            minimumPixels: '800 x 200 px',
            displaySize: '252-394 x 63-99 px',
            safeArea: 'centerBand'
        }
    }
} as const satisfies Record<PromoSlotKey, PromoSlotCreativeGuidance>;

export function getPromoSlotCreativeGuidance(slotKey: string): PromoSlotCreativeGuidance | null {
    return (PROMO_SLOT_CREATIVE_GUIDANCE as Record<string, PromoSlotCreativeGuidance>)[slotKey] || null;
}

export function getDefaultPromoAspectRatioForSlot(slotKey: string): PromoAspectRatio {
    const guidance = getPromoSlotCreativeGuidance(slotKey);
    return (
        parsePromoAspectRatio(guidance?.desktop.recommendedRatio, 'legacySlot') || {
            width: 4,
            height: 1,
            label: '4:1',
            source: 'legacySlot'
        }
    );
}

export function getRecommendedPromoAspectRatioForSlot(slotKey: string): PromoAspectRatio {
    const fallback = getDefaultPromoAspectRatioForSlot(slotKey);
    return { ...fallback, source: 'preset' };
}

export function normalizePromoAspectRatioSource(value: string | null | undefined): PromoAspectRatioSource {
    return value === 'preset' || value === 'custom' || value === 'legacySlot' ? value : 'legacySlot';
}

export function buildPromoAspectRatio(
    width: number | null | undefined,
    height: number | null | undefined,
    label: string | null | undefined,
    source: string | null | undefined,
    fallbackSlotKey?: string | null
): PromoAspectRatio {
    const normalizedSource = normalizePromoAspectRatioSource(source);
    const normalized =
        typeof width === 'number' && typeof height === 'number'
            ? normalizePromoAspectRatio(width, height, normalizedSource)
            : null;
    if (normalized) {
        const trimmedLabel = label?.trim();
        return {
            ...normalized,
            label: trimmedLabel || normalized.label
        };
    }
    return getDefaultPromoAspectRatioForSlot(fallbackSlotKey || '');
}

export const PROMO_DEFAULT_INTERVAL_MS = 5000;
export const PROMO_MIN_INTERVAL_MS = 3000;
export const PROMO_DEFAULT_TRANSITION: PromoTransition = 'fade';
export const PROMO_TITLE_MAX_LENGTH = 120;
export const PROMO_ALT_MAX_LENGTH = 160;
export const PROMO_URL_MAX_LENGTH = 2048;
export const PROMO_ALLOWED_ITEM_FIELDS = [
    'title',
    'alt',
    'desktopImageUrl',
    'mobileImageUrl',
    'linkUrl',
    'device',
    'enabled',
    'sortOrder',
    'weight',
    'startsAt',
    'endsAt'
] as const;

export type PromoPlacementSource = 'share' | 'global' | 'legacy';

export type PromoPlacementItem = {
    title: string;
    alt: string;
    desktopImageUrl: string;
    mobileImageUrl: string;
    linkUrl: string;
    device: PromoDevice;
    sortOrder: number;
    weight: number;
};

export type PromoPlacement = {
    slotKey: PromoSlotKey | string;
    slotName: string;
    description?: string | null;
    enabled: boolean;
    intervalMs: number;
    transition: PromoTransition;
    source: PromoPlacementSource;
    aspectRatio?: PromoAspectRatio;
    items: PromoPlacementItem[];
};

export type PromoCapabilitySlot = {
    key: PromoSlotKey | string;
    name: string;
    description?: string | null;
    enabled: boolean;
    defaultIntervalMs: number;
    defaultTransition: PromoTransition;
};

export type PromoCapabilities = {
    shareProfilesEnabled: boolean;
    slots: PromoCapabilitySlot[];
    aspectRatios: {
        presets: readonly PromoAspectRatioPreset[];
        maxEdgeRatio: number;
    };
    itemLimits: {
        titleMaxLength: number;
        altMaxLength: number;
        urlMaxLength: number;
        allowedFields: readonly string[];
    };
    carouselDefaults: {
        intervalMs: number;
        minIntervalMs: number;
        transition: PromoTransition;
    };
};
