import { NextRequest, NextResponse } from 'next/server';
import { verifyAppPasswordHash } from '@/lib/api-password';
import { createS3Client, formatS3ServerRelayBlockedMessage, generatePresignedGetUrl, generatePresignedPutUrl, getS3ServerConfig, isS3ServerRelayAllowed } from '@/lib/s3-server';
import { validateObjectKey } from '@/lib/sync/key-validation';

type SignRequestBody = {
    operations: Array<{
        method: 'PUT' | 'GET';
        key: string;
        contentType?: string;
    }>;
    basePrefix: string;
    passwordHash?: string;
};

export async function POST(request: NextRequest) {
    let body: SignRequestBody;
    try {
        body = await request.json() as SignRequestBody;
    } catch {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const passwordVerification = verifyAppPasswordHash(body.passwordHash);
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

    if (!Array.isArray(body.operations) || body.operations.length === 0) {
        return NextResponse.json({ error: 'Operations array is required and must not be empty.' }, { status: 400 });
    }

    if (body.operations.length > 50) {
        return NextResponse.json({ error: 'Too many operations. Maximum is 50.' }, { status: 400 });
    }

    if (body.basePrefix !== config.basePrefix) {
        return NextResponse.json({ error: 'Invalid basePrefix: does not match configured sync namespace.' }, { status: 403 });
    }

    const client = createS3Client(config);
    const signedUrls: Array<{ key: string; method: string; url: string }> = [];

    for (const op of body.operations) {
        if (op.method !== 'PUT' && op.method !== 'GET') {
            return NextResponse.json({ error: `Unsupported operation method: ${op.method}` }, { status: 400 });
        }

        const keyValidation = validateObjectKey(op.key, body.basePrefix);
        if (!keyValidation.valid) {
            return NextResponse.json({ error: `Invalid key "${op.key}": ${keyValidation.reason}` }, { status: 400 });
        }

        let url: string;
        if (op.method === 'PUT') {
            url = await generatePresignedPutUrl(client, config.bucket, op.key, op.contentType || 'application/octet-stream');
        } else {
            url = await generatePresignedGetUrl(client, config.bucket, op.key);
        }
        signedUrls.push({ key: op.key, method: op.method, url });
    }

    return NextResponse.json({ urls: signedUrls });
}
