import { NextResponse } from 'next/server';

export async function GET() {
    const hasEnvApiKey = !!process.env.OPENAI_API_KEY;
    const envApiBaseUrl = process.env.OPENAI_API_BASE_URL || '';
    const hasEnvGeminiApiKey = !!process.env.GEMINI_API_KEY;
    const envGeminiApiBaseUrl = process.env.GEMINI_API_BASE_URL || '';
    const envStorageMode = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE || '';
    const hasAppPassword = !!process.env.APP_PASSWORD;
    
    return NextResponse.json({
        hasEnvApiKey,
        envApiBaseUrl,
        hasEnvGeminiApiKey,
        envGeminiApiBaseUrl,
        envStorageMode,
        hasAppPassword,
    });
}
