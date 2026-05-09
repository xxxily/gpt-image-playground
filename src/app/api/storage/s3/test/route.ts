import { NextRequest, NextResponse } from 'next/server';
import { verifyAppPasswordHash } from '@/lib/api-password';
import { createPublicS3ConfigResponse, formatS3ServerRelayBlockedMessage, getS3ServerConfig, isS3ServerRelayAllowed, verifyS3Connection } from '@/lib/s3-server';

type TestRequestBody = {
    passwordHash?: string;
};

export async function POST(request: NextRequest) {
    let body: TestRequestBody;
    try {
        body = await request.json() as TestRequestBody;
    } catch {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const passwordVerification = verifyAppPasswordHash(body.passwordHash);
    if (!passwordVerification.ok) {
        return NextResponse.json({ error: passwordVerification.error }, { status: passwordVerification.status });
    }

    if (!isS3ServerRelayAllowed()) {
        return NextResponse.json({ ok: false, error: formatS3ServerRelayBlockedMessage() }, { status: 400 });
    }

    const config = getS3ServerConfig();
    if (!config) {
        return NextResponse.json({ ok: false, error: 'Server-side S3 fallback is not configured.' }, { status: 400 });
    }

    const result = await verifyS3Connection(config);
    if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }

    return NextResponse.json({
        ok: true,
        message: 'S3 connection successful.',
        bucket: config.bucket,
        basePrefix: config.basePrefix,
        config: createPublicS3ConfigResponse(config)
    });
}
