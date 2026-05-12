import { NextResponse } from 'next/server';
import { getPromoCapabilities } from '@/lib/server/promo';

export async function GET() {
    const capabilities = await getPromoCapabilities();
    return NextResponse.json(capabilities);
}

