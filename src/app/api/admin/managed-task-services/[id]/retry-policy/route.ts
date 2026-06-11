import { adminJsonError, parseAdminJson, requireAdminApi } from '@/lib/server/admin-api';
import {
    getManagedTaskServiceRetryPolicyAdmin,
    updateManagedTaskServiceRetryPolicyAdmin,
    type ManagedTaskAdminActor
} from '@/lib/server/managed-task-admin';
import { managedTaskRetryPolicyUpdateSchema } from '@/lib/server/managed-task-schemas';
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

export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        const retryPolicy = await getManagedTaskServiceRetryPolicyAdmin(id);
        return NextResponse.json({ retryPolicy });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, managedTaskRetryPolicyUpdateSchema);
        const retryPolicy = await updateManagedTaskServiceRetryPolicyAdmin(
            id,
            input,
            toManagedTaskActor(session, request)
        );
        return NextResponse.json({ retryPolicy });
    } catch (error) {
        return adminJsonError(error);
    }
}
