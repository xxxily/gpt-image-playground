import { adminJsonError, requireAdminApi } from '@/lib/server/admin-api';
import { checkManagedTaskServiceAdmin, type ManagedTaskAdminActor } from '@/lib/server/managed-task-admin';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

function toManagedTaskActor(
    session: Awaited<ReturnType<typeof requireAdminApi>>,
    request: NextRequest
): ManagedTaskAdminActor {
    return {
        userId: session.id,
        email: session.email,
        role: session.role,
        request
    };
}

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const service = await checkManagedTaskServiceAdmin(id, toManagedTaskActor(session, request));
        return NextResponse.json({ service });
    } catch (error) {
        return adminJsonError(error);
    }
}
