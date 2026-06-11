import { adminJsonError, parseAdminJson, requireAdminApi } from '@/lib/server/admin-api';
import {
    createManagedTaskPolicyAdmin,
    listManagedTaskPoliciesAdmin,
    type ManagedTaskAdminActor
} from '@/lib/server/managed-task-admin';
import { managedTaskPolicyCreateSchema } from '@/lib/server/managed-task-schemas';
import { NextRequest, NextResponse } from 'next/server';

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

export async function GET(request: NextRequest) {
    try {
        await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        const policies = await listManagedTaskPoliciesAdmin();
        return NextResponse.json({ policies });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, managedTaskPolicyCreateSchema);
        const policy = await createManagedTaskPolicyAdmin(input, toManagedTaskActor(session, request));
        return NextResponse.json({ policy });
    } catch (error) {
        return adminJsonError(error);
    }
}
