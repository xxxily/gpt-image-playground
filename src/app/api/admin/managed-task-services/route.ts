import { adminJsonError, parseAdminJson, requireAdminApi } from '@/lib/server/admin-api';
import {
    createManagedTaskServiceAdmin,
    listManagedTaskPoliciesAdmin,
    listManagedTaskServicesAdmin,
    type ManagedTaskAdminActor
} from '@/lib/server/managed-task-admin';
import { managedTaskServiceCreateSchema } from '@/lib/server/managed-task-schemas';
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
        const [services, policies] = await Promise.all([
            listManagedTaskServicesAdmin(),
            listManagedTaskPoliciesAdmin()
        ]);
        return NextResponse.json({ services, policies });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, managedTaskServiceCreateSchema);
        const service = await createManagedTaskServiceAdmin(input, toManagedTaskActor(session, request));
        return NextResponse.json({ service });
    } catch (error) {
        return adminJsonError(error);
    }
}
