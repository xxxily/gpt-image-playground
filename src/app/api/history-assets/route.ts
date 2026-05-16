import crypto from 'crypto';
import fs from 'fs/promises';
import { lookup } from 'mime-types';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

const outputDir = path.resolve(process.cwd(), 'generated-images');
const MAX_HISTORY_ASSET_BYTES = 50 * 1024 * 1024;

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function isSafeFilename(filename: string): boolean {
    return (
        Boolean(filename) &&
        !filename.includes('\0') &&
        !filename.includes('..') &&
        !filename.includes('/') &&
        !filename.includes('\\')
    );
}

async function collisionSafeFilename(baseDir: string, filename: string): Promise<string> {
    try {
        await fs.access(path.join(baseDir, filename));
    } catch {
        return filename;
    }

    const ext = path.extname(filename);
    const stem = path.basename(filename, ext);
    let counter = 1;

    while (counter < 10000) {
        const candidate = `${stem}-${counter}${ext}`;
        try {
            await fs.access(path.join(baseDir, candidate));
        } catch {
            return candidate;
        }
        counter += 1;
    }

    throw new Error('Could not allocate a collision-safe filename.');
}

function verifyPassword(passwordHash: FormDataEntryValue | null): Response | null {
    if (!process.env.APP_PASSWORD) return null;
    const clientPasswordHash = typeof passwordHash === 'string' ? passwordHash : '';
    if (!clientPasswordHash) {
        return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
    }

    const serverPasswordHash = sha256(process.env.APP_PASSWORD);
    if (clientPasswordHash !== serverPasswordHash) {
        return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
    }

    return null;
}

export async function POST(request: NextRequest) {
    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return NextResponse.json({ error: 'Invalid multipart form data.' }, { status: 400 });
    }

    const authError = verifyPassword(formData.get('passwordHash'));
    if (authError) return authError;

    const file = formData.get('file');
    const filename = formData.get('filename');
    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Missing source image file.' }, { status: 400 });
    }
    if (typeof filename !== 'string' || !isSafeFilename(filename)) {
        return NextResponse.json({ error: 'Invalid filename.' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Only image files can be stored as history assets.' }, { status: 400 });
    }
    if (file.size > MAX_HISTORY_ASSET_BYTES) {
        return NextResponse.json({ error: 'Image file too large (max 50MB).' }, { status: 413 });
    }

    await fs.mkdir(outputDir, { recursive: true });
    const finalFilename = await collisionSafeFilename(outputDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    const filepath = path.join(outputDir, finalFilename);
    await fs.writeFile(filepath, buffer);

    return NextResponse.json({
        filename: finalFilename,
        path: `/api/image/${encodeURIComponent(finalFilename)}`,
        size: buffer.length,
        mimeType: file.type || lookup(finalFilename) || 'application/octet-stream'
    });
}
