import { getPublicRuntimeConfig } from '@/lib/server/public-action-configs';
import { NextResponse } from 'next/server';

export async function GET() {
    const config = await getPublicRuntimeConfig().catch((error) => {
        console.warn('[public-runtime-config] failed to read config', error);
        return { apiKeyPurchaseCta: null };
    });
    return NextResponse.json(config, {
        headers: {
            'Cache-Control': 'public, max-age=30, stale-while-revalidate=120'
        }
    });
}
