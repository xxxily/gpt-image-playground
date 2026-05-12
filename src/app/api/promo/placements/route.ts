import { NextRequest, NextResponse } from 'next/server';
import { getPromoPlacements } from '@/lib/server/promo';

function parseSlotQuery(searchParams: URLSearchParams): string[] {
    const raw = searchParams.getAll('slots');
    if (raw.length > 0) return raw;
    const single = searchParams.get('slots');
    return single ? [single] : [];
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const placements = await getPromoPlacements({
        slots: parseSlotQuery(searchParams),
        surface: searchParams.get('surface'),
        device: searchParams.get('device'),
        promoProfileId: searchParams.get('promoProfileId')
    });

    return NextResponse.json(placements);
}

