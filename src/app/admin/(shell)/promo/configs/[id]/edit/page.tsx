import { notFound } from 'next/navigation';
import type { ComponentProps } from 'react';
import { PromoConfigFormClient } from '@/components/admin/promo-config-form-client';
import { getPromoConfigAdmin, listPromoShareProfilesAdmin, listPromoSlotsAdmin } from '@/lib/server/promo/admin';

type PageProps = {
    params: Promise<{ id: string }>;
};

function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as unknown as T;
}

export default async function EditPromoConfigPage({ params }: PageProps) {
    const { id } = await params;
    const [config, slots, profiles] = await Promise.all([
        getPromoConfigAdmin(id),
        listPromoSlotsAdmin(),
        listPromoShareProfilesAdmin()
    ]);
    if (!config) notFound();

    const shareProfile = config.shareProfileId ? profiles.find((profile) => profile.id === config.shareProfileId) || null : null;

    return (
        <PromoConfigFormClient
            mode='edit'
            scope={config.scope}
            config={serialize(config) as unknown as ComponentProps<typeof PromoConfigFormClient>['config']}
            shareProfile={serialize(shareProfile)}
            slots={serialize(slots.map((slot) => ({ id: slot.id, name: slot.name, key: slot.key })))}
        />
    );
}
