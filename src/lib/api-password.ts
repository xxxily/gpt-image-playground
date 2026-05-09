import crypto from 'crypto';

export type AppPasswordVerification =
    | { ok: true }
    | { ok: false; status: number; error: string };

export function verifyAppPasswordHash(clientHash: string | null | undefined): AppPasswordVerification {
    if (!process.env.APP_PASSWORD) {
        return {
            ok: false,
            status: 403,
            error: 'APP_PASSWORD must be configured before using server-side storage routes.'
        };
    }

    if (!clientHash) {
        return { ok: false, status: 401, error: 'Unauthorized: Missing password hash.' };
    }

    if (!/^[a-f0-9]{64}$/i.test(clientHash)) {
        return { ok: false, status: 401, error: 'Unauthorized: Invalid password.' };
    }

    const serverHash = crypto.createHash('sha256').update(process.env.APP_PASSWORD).digest('hex');
    const clientBuffer = Buffer.from(clientHash, 'hex');
    const serverBuffer = Buffer.from(serverHash, 'hex');

    if (clientBuffer.length !== serverBuffer.length || !crypto.timingSafeEqual(clientBuffer, serverBuffer)) {
        return { ok: false, status: 401, error: 'Unauthorized: Invalid password.' };
    }

    return { ok: true };
}

export function getBearerToken(authHeader: string | null): string | null {
    return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
}
