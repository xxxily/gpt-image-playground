import { adminJsonError, requireAdminApi } from '@/lib/server/admin-api';
import { listManagedTaskServiceTasksAdmin } from '@/lib/server/managed-task-admin';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        const limit = Number(request.nextUrl.searchParams.get('limit') || 100);
        const payload = await listManagedTaskServiceTasksAdmin(id, limit);
        return NextResponse.json(payload);
    } catch (error) {
        return adminJsonError(error);
    }
}
