import { IncomingMessage, ServerResponse } from 'node:http';

export async function readJsonBody(request: IncomingMessage, maxBytes = 1024 * 1024): Promise<unknown> {
    const chunks: Buffer[] = [];
    let total = 0;

    for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > maxBytes) {
            throw new Error('request_body_too_large');
        }
        chunks.push(buffer);
    }

    if (chunks.length === 0) {
        return {};
    }

    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
    const body = JSON.stringify(value);
    response.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': Buffer.byteLength(body)
    });
    response.end(body);
}

export function sendNoContent(response: ServerResponse): void {
    response.writeHead(204, { 'cache-control': 'no-store' });
    response.end();
}
