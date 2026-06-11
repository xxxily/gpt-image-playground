import type { ManagedTaskResolveRequest } from '@/lib/managed-task-types';
import { resolveManagedTaskUserRequest } from '@/lib/server/managed-task-execution';
import { NextRequest, NextResponse } from 'next/server';

function jsonError(error: unknown, status = 400): NextResponse {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status });
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as ManagedTaskResolveRequest;
        return NextResponse.json(await resolveManagedTaskUserRequest(body));
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        return jsonError(error, message.startsWith('Unauthorized:') ? 401 : 400);
    }
}
