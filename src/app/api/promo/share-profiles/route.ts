import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
    PROMO_ALT_MAX_LENGTH,
    PROMO_MIN_INTERVAL_MS,
    PROMO_TITLE_MAX_LENGTH,
    PROMO_URL_MAX_LENGTH
} from '@/lib/promo';
import { checkInMemoryRateLimit } from '@/lib/server/security';
import { upsertPromoShareProfile, type PromoShareProfileUpsertResult } from '@/lib/server/promo/share';

const nullableDate = z.preprocess((value) => {
    if (value === '' || value === undefined) return undefined;
    if (value === null) return null;
    return value;
}, z.coerce.date().nullable().optional());

const nullableInterval = z.preprocess((value) => {
    if (value === '' || value === undefined) return undefined;
    if (value === null) return null;
    return value;
}, z.coerce.number().int().min(PROMO_MIN_INTERVAL_MS).nullable().optional());

const shareItemSchema = z.object({
    title: z.string().trim().min(1, '请输入广告标题。').max(PROMO_TITLE_MAX_LENGTH),
    alt: z.string().trim().min(1, '请输入广告替代文本。').max(PROMO_ALT_MAX_LENGTH),
    desktopImageUrl: z.string().trim().min(1, '请输入桌面图片 URL。').max(PROMO_URL_MAX_LENGTH),
    mobileImageUrl: z.string().trim().min(1, '请输入移动图片 URL。').max(PROMO_URL_MAX_LENGTH),
    linkUrl: z.string().trim().min(1, '请输入点击链接。').max(PROMO_URL_MAX_LENGTH),
    device: z.enum(['all', 'desktop', 'mobile']).optional(),
    enabled: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
    weight: z.coerce.number().int().min(0).optional(),
    startsAt: nullableDate,
    endsAt: nullableDate
});

const shareProfileUpsertSchema = z.object({
    shareKey: z.string().trim().min(1, '请输入权限 Key。'),
    name: z.string().trim().min(1, '请输入配置名称。').max(120),
    slotKey: z.string().trim().min(1, '请选择广告位。').max(80),
    promoProfileId: z.string().trim().min(1).max(120).nullable().optional(),
    enabled: z.boolean().optional(),
    intervalMs: nullableInterval,
    transition: z.enum(['fade', 'slide', 'none']).nullable().optional(),
    startsAt: nullableDate,
    endsAt: nullableDate,
    items: z.array(shareItemSchema).min(1, '至少需要一个广告素材。').max(20, '一次最多保存 20 个广告素材。')
});

function getClientKey(request: Request): string {
    return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'local';
}

function toPublicShareProfileResult(result: PromoShareProfileUpsertResult) {
    return {
        promoProfileId: result.promoProfileId,
        profile: {
            promoProfileId: result.profile.publicId,
            name: result.profile.name,
            status: result.profile.status,
            createdAt: result.profile.createdAt,
            updatedAt: result.profile.updatedAt,
            lastPublishedAt: result.profile.lastPublishedAt
        },
        slot: {
            key: result.slot.key,
            name: result.slot.name,
            description: result.slot.description,
            enabled: result.slot.enabled
        },
        config: {
            enabled: result.config.enabled,
            intervalMs: result.config.intervalMs,
            transition: result.config.transition,
            startsAt: result.config.startsAt,
            endsAt: result.config.endsAt
        },
        items: result.items.map((item) => ({
            title: item.title,
            alt: item.alt,
            desktopImageUrl: item.desktopImageUrl,
            mobileImageUrl: item.mobileImageUrl,
            linkUrl: item.linkUrl,
            device: item.device,
            enabled: item.enabled,
            sortOrder: item.sortOrder,
            weight: item.weight,
            startsAt: item.startsAt,
            endsAt: item.endsAt
        }))
    };
}

function jsonError(error: unknown, status = 400): NextResponse {
    if (error instanceof Error) {
        return NextResponse.json({ error: error.message || '保存失败。' }, { status });
    }
    return NextResponse.json({ error: '保存失败。' }, { status });
}

async function handleUpsert(request: NextRequest, requireExistingProfile: boolean, successStatus: 200 | 201) {
    try {
        const throttle = checkInMemoryRateLimit(`promo-share-profile:${getClientKey(request)}`, 12, 10 * 60 * 1000);
        if (!throttle.ok) {
            return NextResponse.json({ error: '操作过于频繁，请稍后再试。' }, { status: 429 });
        }

        const parsed = shareProfileUpsertSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || '请求参数无效。' }, { status: 400 });
        }

        if (requireExistingProfile && !parsed.data.promoProfileId?.trim()) {
            return NextResponse.json({ error: '更新分享广告配置需要 promoProfileId。' }, { status: 400 });
        }

        const result = await upsertPromoShareProfile(parsed.data);
        return NextResponse.json(toPublicShareProfileResult(result), { status: successStatus });
    } catch (error) {
        return jsonError(error);
    }
}

export async function POST(request: NextRequest) {
    return handleUpsert(request, false, 201);
}

export async function PUT(request: NextRequest) {
    return handleUpsert(request, true, 200);
}
