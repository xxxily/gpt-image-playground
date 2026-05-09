import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyAppPasswordHash } from '@/lib/api-password';
import { createS3Client, formatS3ServerRelayBlockedMessage, getS3ServerConfig, isS3ServerRelayAllowed, listObjectsUnderPrefix } from '@/lib/s3-server';
import { validateObjectKey, validatePrefix } from '@/lib/sync/key-validation';

type ListRequestBody = {
    prefix?: string;
    passwordHash?: string;
};

function checkPassword(passwordHash: string | null): Response | null {
    const passwordVerification = verifyAppPasswordHash(passwordHash);
    if (!passwordVerification.ok) return NextResponse.json({ error: passwordVerification.error }, { status: passwordVerification.status });
    return null;
}

async function listWithConfig(requestedPrefix: string, passwordHash: string | null) {
    const authError = checkPassword(passwordHash);
    if (authError) return authError;

    if (!isS3ServerRelayAllowed()) {
        return NextResponse.json({ error: formatS3ServerRelayBlockedMessage() }, { status: 400 });
    }

    const config = getS3ServerConfig();
    if (!config) {
        return NextResponse.json({ error: 'Server-side S3 fallback is not configured.' }, { status: 400 });
    }

    const prefix = requestedPrefix || config.basePrefix;
    if (prefix !== config.basePrefix) {
        const prefixValidation = validatePrefix(prefix);
        if (!prefixValidation.valid) {
            return NextResponse.json({ error: `Invalid prefix: ${prefixValidation.reason}` }, { status: 400 });
        }
        const prefixScope = validateObjectKey(prefix, config.basePrefix);
        if (!prefixScope.valid) {
            return NextResponse.json({ error: `Invalid prefix: ${prefixScope.reason}` }, { status: 403 });
        }
    }

    const listPrefix = prefix === config.basePrefix ? `${config.basePrefix}/` : prefix;
    const client = createS3Client(config);
    const objects = await listObjectsUnderPrefix(client, config.bucket, listPrefix);

    return NextResponse.json({
        prefix,
        count: objects.length,
        objects: objects.map(obj => ({
            key: obj.key,
            size: obj.size,
            lastModified: obj.lastModified.toISOString()
        }))
    });
}

export async function POST(request: NextRequest) {
    let body: ListRequestBody;
    try {
        body = await request.json() as ListRequestBody;
    } catch {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    return listWithConfig(body.prefix || '', body.passwordHash || null);
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const requestedPrefix = url.searchParams.get('prefix') || '';
    const passwordHash = getBearerToken(request.headers.get('authorization'));

    return listWithConfig(requestedPrefix, passwordHash);
}
