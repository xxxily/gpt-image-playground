import { NextResponse } from 'next/server';
import { isEnabledEnvFlag } from '@/lib/connection-policy';

export async function GET() {
    const hasEnvApiKey = !!process.env.OPENAI_API_KEY;
    const envApiBaseUrl = process.env.OPENAI_API_BASE_URL || '';
    const hasEnvGeminiApiKey = !!process.env.GEMINI_API_KEY;
    const envGeminiApiBaseUrl = process.env.GEMINI_API_BASE_URL || '';
    const envStorageMode = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE || '';
    const clientDirectLinkPriority = isEnabledEnvFlag(process.env.CLIENT_DIRECT_LINK_PRIORITY || process.env.NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY);
    const hasAppPassword = !!process.env.APP_PASSWORD;
    
    return NextResponse.json({
        hasEnvApiKey,
        envApiBaseUrl,
        hasEnvGeminiApiKey,
        envGeminiApiBaseUrl,
        envStorageMode,
        clientDirectLinkPriority,
        hasAppPassword,
    });
}
