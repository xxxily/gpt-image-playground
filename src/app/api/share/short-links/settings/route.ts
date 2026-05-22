import { NextResponse } from 'next/server';
import { getPublicShortLinkSettings } from '@/lib/server/short-links';

export async function GET() {
    try {
        const settings = await getPublicShortLinkSettings();
        return NextResponse.json({ settings });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '读取短链设置失败。' },
            { status: 400 }
        );
    }
}
