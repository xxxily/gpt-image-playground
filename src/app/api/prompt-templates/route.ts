import { DEFAULT_PROMPT_TEMPLATE_CATEGORIES, DEFAULT_PROMPT_TEMPLATES } from '@/lib/default-prompt-templates';
import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        categories: DEFAULT_PROMPT_TEMPLATE_CATEGORIES,
        templates: DEFAULT_PROMPT_TEMPLATES
    });
}
