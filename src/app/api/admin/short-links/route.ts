import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { adminShortLinkCreateSchema } from '@/lib/server/short-link-schemas';
import {
    createAdminShortLink,
    getShortLinkTargetPreview,
    listShortLinksAdmin,
    parseTargetSummary
} from '@/lib/server/short-links';

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        const links = await listShortLinksAdmin();
        return NextResponse.json({
            links: links.map((link) => ({
                ...link,
                targetPreview: getShortLinkTargetPreview(link),
                targetSummary: parseTargetSummary(link.targetSummaryJson)
            }))
        });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, adminShortLinkCreateSchema);
        const result = await createAdminShortLink(request, input, toPromoAdminActor(session, request));
        return NextResponse.json({
            link: {
                ...result.link,
                targetPreview: getShortLinkTargetPreview(result.link),
                targetSummary: parseTargetSummary(result.link.targetSummaryJson)
            },
            shortUrl: result.shortUrl,
            warnings: result.warnings
        });
    } catch (error) {
        return adminJsonError(error);
    }
}
