import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, requireAdminApi } from '@/lib/server/admin-api';
import { getServerDatabasePath } from '@/lib/server/db';

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request, { roles: ['owner', 'admin'] });
        return NextResponse.json({
            settings: {
                databasePath: getServerDatabasePath(),
                bootstrapSecretConfigured: Boolean(process.env.ADMIN_BOOTSTRAP_SECRET),
                betterAuthSecretConfigured: Boolean(process.env.BETTER_AUTH_SECRET),
                shareProfilesEnabled: process.env.PROMO_SHARE_CONFIG_ENABLED !== 'false',
                legacyGenerationHeaderFallbackConfigured: Boolean(
                    process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_ENABLED ||
                        process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_IMAGE_URL ||
                        process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_LINK_URL
                )
            }
        });
    } catch (error) {
        return adminJsonError(error);
    }
}
