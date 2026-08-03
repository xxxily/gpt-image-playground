import { ShowcaseAdminClient } from '@/components/admin/showcase-admin-client';
import { DEFAULT_SHOWCASE_CATALOG } from '@/lib/default-showcases';
import { getAdminSession } from '@/lib/server/auth';
import { listShowcaseTopicsAdmin } from '@/lib/server/showcase/admin';
import { headers } from 'next/headers';

function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export default async function AdminShowcasesPage() {
    const requestHeaders = await headers();
    const session = await getAdminSession(requestHeaders);
    const topics = await listShowcaseTopicsAdmin();
    const defaultTopic = DEFAULT_SHOWCASE_CATALOG.topics[0]!;
    const caseIds = new Set(defaultTopic.caseIds);
    const cases = DEFAULT_SHOWCASE_CATALOG.cases.filter((item) => caseIds.has(item.id));
    const assetIds = new Set<string>([defaultTopic.coverAssetId]);
    cases.forEach((item) => {
        assetIds.add(item.coverAssetId);
        item.inputAssetIds.forEach((id) => assetIds.add(id));
        item.outputAssetIds.forEach((id) => assetIds.add(id));
    });
    const defaultDraft = {
        topic: defaultTopic,
        cases,
        assets: DEFAULT_SHOWCASE_CATALOG.assets.filter((item) => assetIds.has(item.id))
    };

    return (
        <ShowcaseAdminClient
            initialTopics={serialize(topics)}
            initialActorRole={session?.role ?? 'viewer'}
            defaultDraft={serialize(defaultDraft)}
        />
    );
}
