import { listPromoConfigsAdmin, listPromoItemsAdmin, listPromoSlotsAdmin } from '@/lib/server/promo/admin';
import { PromoAdminClient, type AdminPromoConfig, type AdminPromoItem, type AdminPromoSlot } from '@/components/admin/promo-admin-client';

function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as unknown as T;
}

export default async function AdminPromoPage() {
    const [slots, configs, items] = await Promise.all([listPromoSlotsAdmin(), listPromoConfigsAdmin(), listPromoItemsAdmin()]);

    return (
        <PromoAdminClient
            initialSlots={serialize(slots) as unknown as AdminPromoSlot[]}
            initialConfigs={serialize(configs) as unknown as AdminPromoConfig[]}
            initialItems={serialize(items) as unknown as AdminPromoItem[]}
        />
    );
}
