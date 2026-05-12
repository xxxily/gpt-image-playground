import { toNextJsHandler } from 'better-auth/next-js';
import { getAdminAuth } from '@/lib/server/auth';

const handlerPromise = getAdminAuth().then((auth) => toNextJsHandler(auth));

export async function GET(request: Request) {
    const handler = await handlerPromise;
    return handler.GET(request);
}

export async function POST(request: Request) {
    const handler = await handlerPromise;
    return handler.POST(request);
}

export async function PATCH(request: Request) {
    const handler = await handlerPromise;
    return handler.PATCH(request);
}

export async function PUT(request: Request) {
    const handler = await handlerPromise;
    return handler.PUT(request);
}

export async function DELETE(request: Request) {
    const handler = await handlerPromise;
    return handler.DELETE(request);
}

