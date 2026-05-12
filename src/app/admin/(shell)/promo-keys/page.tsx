import { PromoKeysAdminClient, type AdminPromoShareKey, type PromoSlotOption } from '@/components/admin/promo-keys-admin-client';
import { listPromoShareKeysAdmin, listPromoSlotsAdmin } from '@/lib/server/promo/admin';

function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as unknown as T;
}

function omitTokenHash(record: any): AdminPromoShareKey {
    return {
        id: record.id,
        name: record.name,
        note: record.note,
        tokenPrefix: record.tokenPrefix,
        status: record.status,
        expiresAt: record.expiresAt,
        allowedSlotsJson: record.allowedSlotsJson,
        createdByUserId: record.createdByUserId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        lastUsedAt: record.lastUsedAt
    };
}

export default async function AdminPromoKeysPage() {
    const [keys, slots] = await Promise.all([listPromoShareKeysAdmin(), listPromoSlotsAdmin()]);
    const safeKeys = serialize(keys).map(omitTokenHash);
    const slotOptions = serialize(slots).map((slot) => ({ id: slot.id, key: slot.key, name: slot.name })) as unknown as PromoSlotOption[];

    return <PromoKeysAdminClient initialKeys={safeKeys} slotOptions={slotOptions} />;
}
