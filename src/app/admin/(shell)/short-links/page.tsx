import {
    ShortLinksAdminClient,
    type AdminShortLink,
    type AdminShortLinkProfile,
    type AdminShortLinkSettings
} from '@/components/admin/short-links-admin-client';
import { listPromoShareProfilesAdmin } from '@/lib/server/promo/admin';
import {
    getShortLinkSettingsAdmin,
    getShortLinkTargetPreview,
    listShortLinksAdmin,
    parseTargetSummary
} from '@/lib/server/short-links';

function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as unknown as T;
}

export default async function AdminShortLinksPage() {
    const [links, settings, profiles] = await Promise.all([
        listShortLinksAdmin(),
        getShortLinkSettingsAdmin(),
        listPromoShareProfilesAdmin()
    ]);

    const serializedLinks = links.map((link) => ({
        ...link,
        targetPreview: getShortLinkTargetPreview(link),
        targetSummary: parseTargetSummary(link.targetSummaryJson)
    }));

    return (
        <ShortLinksAdminClient
            initialLinks={serialize(serializedLinks) as unknown as AdminShortLink[]}
            initialSettings={serialize(settings) as unknown as AdminShortLinkSettings}
            profiles={serialize(profiles) as unknown as AdminShortLinkProfile[]}
        />
    );
}
