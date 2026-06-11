import { adminJsonError, parseAdminJson, requireAdminApi } from '@/lib/server/admin-api';
import {
    deleteManagedTaskServiceAdmin,
    updateManagedTaskServiceAdmin,
    type ManagedTaskAdminActor
} from '@/lib/server/managed-task-admin';
import { managedTaskServiceUpdateSchema } from '@/lib/server/managed-task-schemas';
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
        const input = await parseAdminJson(request, managedTaskServiceUpdateSchema);
        const service = await updateManagedTaskServiceAdmin(id, input, toManagedTaskActor(session, request));
        if (!service) return NextResponse.json({ error: '任务服务配置不存在。' }, { status: 404 });
        return NextResponse.json({ service });
    } catch (error) {
        return adminJsonError(error);
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const session = await requireAdminApi(request, { mutation: true, roles: ['owner', 'admin'] });
        const ok = await deleteManagedTaskServiceAdmin(id, toManagedTaskActor(session, request));
        if (!ok) return NextResponse.json({ error: '任务服务配置不存在。' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return adminJsonError(error);
    }
}
