import { PromoConfigFormClient } from '@/components/admin/promo-config-form-client';
import { listPromoSlotsAdmin } from '@/lib/server/promo/admin';

type PageProps = {
    searchParams: Promise<{ scope?: string }>;
};

function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as unknown as T;
}

export default async function NewPromoConfigPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const scope = params.scope === 'share' ? 'share' : 'global';
    const slots = await listPromoSlotsAdmin();

    return (
        <PromoConfigFormClient
            mode='create'
            scope={scope}
            slots={serialize(slots.map((slot) => ({ id: slot.id, name: slot.name, key: slot.key })))}
        />
    );
}
