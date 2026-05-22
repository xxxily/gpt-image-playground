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

export type PromoSlotKey = (typeof PROMO_SLOT_DEFINITIONS)[number]['key'];

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
