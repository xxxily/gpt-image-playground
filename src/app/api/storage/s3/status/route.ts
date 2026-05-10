import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyAppPasswordHash } from '@/lib/api-password';
import { formatS3ServerRelayBlockedMessage, getS3ServerConfig, isS3ServerRelayAllowed, S3_ENV_VAR_NAMES } from '@/lib/s3-server';

function checkPassword(request: NextRequest): Response | null {
    const passwordVerification = verifyAppPasswordHash(getBearerToken(request.headers.get('authorization')));
    if (!passwordVerification.ok) return NextResponse.json({ error: passwordVerification.error }, { status: passwordVerification.status });
    return null;
}

export async function GET(request: NextRequest) {
    const authError = checkPassword(request);
    if (authError) return authError;

    if (!isS3ServerRelayAllowed()) {
        return NextResponse.json({ error: formatS3ServerRelayBlockedMessage() }, { status: 400 });
    }

    const config = getS3ServerConfig();
    if (!config) {
        return NextResponse.json({
            configured: false,
            envVarsPresent: S3_ENV_VAR_NAMES.map(name => ({
                name,
                present: !!process.env[name]
            })),
            message: 'S3 environment variables not configured on server.'
        });
    }

    return NextResponse.json({
        configured: true,
        endpoint: config.endpoint,
        region: config.region,
        bucket: config.bucket,
        forcePathStyle: config.forcePathStyle,
        allowRemoteDeletion: false,
        rootPrefix: config.rootPrefix,
        profileId: config.profileId,
        basePrefix: config.basePrefix
    });
}

export async function POST(request: NextRequest) {
    let body: { passwordHash?: string };
    try {
        body = await request.json() as { passwordHash?: string };
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
        return NextResponse.json({
            configured: false,
            envVarsPresent: S3_ENV_VAR_NAMES.map(name => ({
                name,
                present: !!process.env[name]
            })),
            message: 'S3 environment variables not configured on server.'
        });
    }

    return NextResponse.json({
        configured: true,
        endpoint: config.endpoint,
        region: config.region,
        bucket: config.bucket,
        forcePathStyle: config.forcePathStyle,
        allowRemoteDeletion: false,
        rootPrefix: config.rootPrefix,
        profileId: config.profileId,
        basePrefix: config.basePrefix
    });
}
