import { NextResponse } from 'next/server';

export async function GET() {
    const hasEnvApiKey = !!process.env.OPENAI_API_KEY;
    const envApiBaseUrl = process.env.OPENAI_API_BASE_URL || '';
    const envStorageMode = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE || '';
    
    return NextResponse.json({
        hasEnvApiKey,
        envApiBaseUrl,
        envStorageMode,
    });
}