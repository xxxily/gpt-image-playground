import { toNextJsHandler } from 'better-auth/next-js';
import { getAdminAuth } from '@/lib/server/auth';

export async function GET(request: Request) {
    const handler = toNextJsHandler(await getAdminAuth(request));
    return handler.GET(request);
}

export async function POST(request: Request) {
    const handler = toNextJsHandler(await getAdminAuth(request));
    return handler.POST(request);
}

export async function PATCH(request: Request) {
    const handler = toNextJsHandler(await getAdminAuth(request));
    return handler.PATCH(request);
}

export async function PUT(request: Request) {
    const handler = toNextJsHandler(await getAdminAuth(request));
    return handler.PUT(request);
}

export async function DELETE(request: Request) {
    const handler = toNextJsHandler(await getAdminAuth(request));
    return handler.DELETE(request);
}
