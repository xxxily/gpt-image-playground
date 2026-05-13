import {
    listPromoConfigsAdmin,
    listPromoItemsAdmin,
    listPromoShareProfilesAdmin,
    listPromoSlotsAdmin
} from '@/lib/server/promo/admin';
import {
    PromoAdminClient,
    type AdminPromoConfig,
    type AdminPromoItem,
    type AdminPromoShareProfile,
    type AdminPromoSlot
} from '@/components/admin/promo-admin-client';

function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as unknown as T;
}

export default async function AdminPromoPage() {
    const [slots, configs, items, profiles] = await Promise.all([
        listPromoSlotsAdmin(),
        listPromoConfigsAdmin(),
        listPromoItemsAdmin(),
        listPromoShareProfilesAdmin()
    ]);

    return (
        <PromoAdminClient
            initialSlots={serialize(slots) as unknown as AdminPromoSlot[]}
            initialConfigs={serialize(configs) as unknown as AdminPromoConfig[]}
            initialItems={serialize(items) as unknown as AdminPromoItem[]}
            initialShareProfiles={serialize(profiles) as unknown as AdminPromoShareProfile[]}
        />
    );
}
