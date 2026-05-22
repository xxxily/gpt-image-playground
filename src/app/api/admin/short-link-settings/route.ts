import { NextRequest, NextResponse } from 'next/server';
import { adminJsonError, parseAdminJson, requireAdminApi, toPromoAdminActor } from '@/lib/server/admin-api';
import { adminShortLinkSettingsUpdateSchema } from '@/lib/server/short-link-schemas';
import { getShortLinkSettingsAdmin, updateShortLinkSettingsAdmin } from '@/lib/server/short-links';

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        const settings = await getShortLinkSettingsAdmin();
        return NextResponse.json({ settings });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner'] });
        const input = await parseAdminJson(request, adminShortLinkSettingsUpdateSchema);
        const settings = await updateShortLinkSettingsAdmin(input, toPromoAdminActor(session, request));
        return NextResponse.json({ settings });
    } catch (error) {
        return adminJsonError(error);
    }
}
