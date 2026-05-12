import { getServerDatabaseReady, getSqliteClient } from '@/lib/server/db';
import { PROMO_SLOT_DEFINITIONS } from '@/lib/promo';

let seedPromise: Promise<void> | null = null;

function buildInsertSlotStatement(slot: (typeof PROMO_SLOT_DEFINITIONS)[number]): string {
    const safeName = slot.name.replace(/'/gu, "''");
    const safeDescription = slot.description.replace(/'/gu, "''");
    const safeTransition = slot.defaultTransition.replace(/'/gu, "''");
    return `INSERT OR IGNORE INTO "promo_slots" ("id", "key", "name", "description", "enabled", "defaultIntervalMs", "defaultTransition")
VALUES ('${slot.key}', '${slot.key}', '${safeName}', '${safeDescription}', 1, ${slot.defaultIntervalMs}, '${safeTransition}');`;
}

export async function ensurePromoSlotsSeeded(): Promise<void> {
    if (!seedPromise) {
        seedPromise = (async () => {
            await getServerDatabaseReady();
            const client = getSqliteClient();
            for (const slot of PROMO_SLOT_DEFINITIONS) {
                client.exec(buildInsertSlotStatement(slot));
            }
        })();
    }

    await seedPromise;
}

