import { NextResponse } from 'next/server';
import { getAdminBootstrapState } from '@/lib/server/auth';

export async function GET() {
    const state = await getAdminBootstrapState();
    return NextResponse.json({
        requiresSetup: !state.hasOwner,
        hasOwner: state.hasOwner,
        ownerCount: state.ownerCount
    });
}

