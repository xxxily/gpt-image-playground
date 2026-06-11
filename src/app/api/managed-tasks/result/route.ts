import type { ManagedTaskImportRequest } from '@/lib/managed-task-types';
import { importManagedTaskUserResult } from '@/lib/server/managed-task-execution';
import { NextRequest, NextResponse } from 'next/server';

function jsonError(error: unknown, status = 400): NextResponse {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status });
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as ManagedTaskImportRequest;
        return NextResponse.json(await importManagedTaskUserResult(body));
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        return jsonError(error, message.startsWith('Unauthorized:') ? 401 : 400);
    }
}
