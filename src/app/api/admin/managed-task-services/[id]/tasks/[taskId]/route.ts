import type { ManagedTaskAdminVisibility } from '@/lib/managed-task-config';
import { adminJsonError, requireAdminApi } from '@/lib/server/admin-api';
import { getManagedTaskServiceTaskDiagnosticAdmin, type ManagedTaskAdminActor } from '@/lib/server/managed-task-admin';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string; taskId: string }> };

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
        const { id, taskId } = await params;
        const visibility = request.nextUrl.searchParams.get('visibility') === 'full' ? 'full' : 'summary';
        const roles =
            visibility === 'full'
                ? (['owner'] satisfies Array<'owner'>)
                : (['owner', 'admin', 'viewer'] satisfies Array<'owner' | 'admin' | 'viewer'>);
        const session = await requireAdminApi(request, { roles });
        const task = await getManagedTaskServiceTaskDiagnosticAdmin(
            id,
            taskId,
            visibility as ManagedTaskAdminVisibility,
            toManagedTaskActor(session, request)
        );
        return NextResponse.json({ task });
    } catch (error) {
        return adminJsonError(error);
    }
}
