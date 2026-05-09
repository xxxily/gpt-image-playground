import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyAppPasswordHash } from '@/lib/api-password';
import { createS3Client, formatS3ServerRelayBlockedMessage, getS3ServerConfig, isS3ServerRelayAllowed } from '@/lib/s3-server';
import { validateObjectKey } from '@/lib/sync/key-validation';

type ObjectRequestBody = {
    operation?: 'HEAD';
    key?: string;
    passwordHash?: string;
};

function getRequestPasswordHash(request: NextRequest, fallback?: string | null): string | null {
    return request.headers.get('x-app-password') || getBearerToken(request.headers.get('authorization')) || fallback || null;
}

function validateServerObjectRequest(key: string | null | undefined, passwordHash: string | null): Response | { key: string } {
    const passwordVerification = verifyAppPasswordHash(passwordHash);
    if (!passwordVerification.ok) {
        return NextResponse.json({ error: passwordVerification.error }, { status: passwordVerification.status });
    }

    if (!isS3ServerRelayAllowed()) {
        return NextResponse.json({ error: formatS3ServerRelayBlockedMessage() }, { status: 400 });
    }

    const config = getS3ServerConfig();
    if (!config) {
        return NextResponse.json({ error: 'Server-side S3 fallback is not configured.' }, { status: 400 });
    }

    if (!key) {
        return NextResponse.json({ error: 'Object key is required.' }, { status: 400 });
    }

    const keyValidation = validateObjectKey(key, config.basePrefix);
    if (!keyValidation.valid) {
        return NextResponse.json({ error: `Invalid key "${key}": ${keyValidation.reason}` }, { status: 400 });
    }

    return { key };
}

export async function POST(request: NextRequest) {
    let body: ObjectRequestBody;
    try {
        body = await request.json() as ObjectRequestBody;
    } catch {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    if (body.operation !== 'HEAD') {
        return NextResponse.json({ error: 'Unsupported operation.' }, { status: 400 });
    }

    const checked = validateServerObjectRequest(body.key, getRequestPasswordHash(request, body.passwordHash));
    if (checked instanceof Response) return checked;

    const config = getS3ServerConfig();
    if (!config) return NextResponse.json({ error: 'Server-side S3 fallback is not configured.' }, { status: 400 });

    try {
        const response = await createS3Client(config).send(new HeadObjectCommand({
            Bucket: config.bucket,
            Key: checked.key
        }));

        return NextResponse.json({
            contentLength: response.ContentLength,
            metadata: response.Metadata ?? {}
        });
    } catch {
        return NextResponse.json({ exists: false }, { status: 404 });
    }
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const checked = validateServerObjectRequest(url.searchParams.get('key'), getRequestPasswordHash(request, url.searchParams.get('passwordHash')));
    if (checked instanceof Response) return checked;

    const config = getS3ServerConfig();
    if (!config) return NextResponse.json({ error: 'Server-side S3 fallback is not configured.' }, { status: 400 });

    try {
        const response = await createS3Client(config).send(new GetObjectCommand({
            Bucket: config.bucket,
            Key: checked.key
        }));
        const body = await response.Body?.transformToByteArray();
        if (!body) {
            return NextResponse.json({ error: 'Object body is empty.' }, { status: 502 });
        }

        return new Response(body, {
            headers: {
                'Content-Type': response.ContentType || 'application/octet-stream',
                'Cache-Control': 'no-store'
            }
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to download object.';
        return NextResponse.json({ error: message }, { status: 502 });
    }
}

export async function PUT(request: NextRequest) {
    const key = request.headers.get('x-sync-object-key');
    const checked = validateServerObjectRequest(key, getRequestPasswordHash(request));
    if (checked instanceof Response) return checked;

    const config = getS3ServerConfig();
    if (!config) return NextResponse.json({ error: 'Server-side S3 fallback is not configured.' }, { status: 400 });

    try {
        const body = new Uint8Array(await request.arrayBuffer());
        await createS3Client(config).send(new PutObjectCommand({
            Bucket: config.bucket,
            Key: checked.key,
            Body: body,
            ContentType: request.headers.get('content-type') || 'application/octet-stream',
            Metadata: request.headers.get('x-amz-meta-sha256')
                ? { sha256: request.headers.get('x-amz-meta-sha256')! }
                : undefined
        }));

        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to upload object.';
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
