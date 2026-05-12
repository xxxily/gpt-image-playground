import { PromoKeysAdminClient, type AdminPromoShareKey, type PromoSlotOption } from '@/components/admin/promo-keys-admin-client';
import { listPromoShareKeysAdmin, listPromoSlotsAdmin } from '@/lib/server/promo/admin';

type PromoShareKeyRecord = Awaited<ReturnType<typeof listPromoShareKeysAdmin>>[number];

function toDateString(value: Date | null): string | null {
    return value ? value.toISOString() : null;
}

function toAdminShareKey(record: PromoShareKeyRecord): AdminPromoShareKey {
    return {
        id: record.id,
        name: record.name,
        note: record.note,
        tokenPrefix: record.tokenPrefix,
        status: record.status,
        expiresAt: toDateString(record.expiresAt),
        allowedSlotsJson: record.allowedSlotsJson,
        createdByUserId: record.createdByUserId,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        lastUsedAt: toDateString(record.lastUsedAt)
    };
}

export default async function AdminPromoKeysPage() {
    const [keys, slots] = await Promise.all([listPromoShareKeysAdmin(), listPromoSlotsAdmin()]);
    const safeKeys = keys.map(toAdminShareKey);
    const slotOptions: PromoSlotOption[] = slots.map((slot) => ({ id: slot.id, key: slot.key, name: slot.name }));

    return <PromoKeysAdminClient initialKeys={safeKeys} slotOptions={slotOptions} />;
}
