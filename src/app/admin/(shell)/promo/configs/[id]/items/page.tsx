import { notFound } from 'next/navigation';
import { PromoItemsAdminClient, type AdminPromoItemDetail } from '@/components/admin/promo-items-admin-client';
import { getPromoConfigAdmin, listPromoItemsByConfigAdmin } from '@/lib/server/promo/admin';

type PageProps = {
    params: Promise<{ id: string }>;
};

function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as unknown as T;
}

export default async function PromoConfigItemsPage({ params }: PageProps) {
    const { id } = await params;
    const [config, items] = await Promise.all([getPromoConfigAdmin(id), listPromoItemsByConfigAdmin(id)]);
    if (!config) notFound();

    return (
        <PromoItemsAdminClient
            config={{ id: config.id, name: config.name, scope: config.scope }}
            initialItems={serialize(items) as unknown as AdminPromoItemDetail[]}
        />
    );
}
