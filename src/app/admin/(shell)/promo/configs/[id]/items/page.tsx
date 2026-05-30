import { PromoItemsAdminClient, type AdminPromoItemDetail } from '@/components/admin/promo-items-admin-client';
import { getPromoConfigAdmin, listPromoItemsByConfigAdmin, listPromoSlotsAdmin } from '@/lib/server/promo/admin';
import { notFound } from 'next/navigation';

type PageProps = {
    params: Promise<{ id: string }>;
};

function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as unknown as T;
}

export default async function PromoConfigItemsPage({ params }: PageProps) {
    const { id } = await params;
    const [config, items, slots] = await Promise.all([
        getPromoConfigAdmin(id),
        listPromoItemsByConfigAdmin(id),
        listPromoSlotsAdmin()
    ]);
    if (!config) notFound();
    const slot = slots.find((entry) => entry.id === config.slotId) || null;

    return (
        <PromoItemsAdminClient
            config={{
                id: config.id,
                name: config.name,
                scope: config.scope,
                slotKey: slot?.key || null,
                aspectRatioWidth: config.aspectRatioWidth,
                aspectRatioHeight: config.aspectRatioHeight,
                aspectRatioLabel: config.aspectRatioLabel,
                aspectRatioSource: config.aspectRatioSource,
                constraintsJson: config.constraintsJson
            }}
            initialItems={serialize(items) as unknown as AdminPromoItemDetail[]}
        />
    );
}
