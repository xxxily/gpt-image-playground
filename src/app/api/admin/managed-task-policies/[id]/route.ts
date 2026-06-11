import { adminJsonError, parseAdminJson, requireAdminApi } from '@/lib/server/admin-api';
import {
    deleteManagedTaskPolicyAdmin,
    updateManagedTaskPolicyAdmin,
    type ManagedTaskAdminActor
} from '@/lib/server/managed-task-admin';
import { managedTaskPolicyUpdateSchema } from '@/lib/server/managed-task-schemas';
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

export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const input = await parseAdminJson(request, managedTaskPolicyUpdateSchema);
        const policy = await updateManagedTaskPolicyAdmin(id, input, toManagedTaskActor(session, request));
        if (!policy) return NextResponse.json({ error: '接管策略不存在。' }, { status: 404 });
        return NextResponse.json({ policy });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const ok = await deleteManagedTaskPolicyAdmin(id, toManagedTaskActor(session, request));
        if (!ok) return NextResponse.json({ error: '接管策略不存在。' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return adminJsonError(error);
    }
}
