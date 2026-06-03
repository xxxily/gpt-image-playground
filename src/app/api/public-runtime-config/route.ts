import { getPublicRuntimeConfig } from '@/lib/server/public-action-configs';
import { createServerLogger } from '@/lib/server/server-logger';
import { NextResponse } from 'next/server';

const logger = createServerLogger('api.public-runtime-config');

export async function GET() {
    const config = await getPublicRuntimeConfig().catch((error) => {
        logger.warn('public runtime config read failed', { error });
        return { apiKeyPurchaseCta: null };
    });
    return NextResponse.json(config, {
        headers: {
            'Cache-Control': 'public, max-age=30, stale-while-revalidate=120'
        }
    });
}
