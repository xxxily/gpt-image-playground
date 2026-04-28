import type { PromptTemplate, PromptTemplateWithSource } from '@/types/prompt-template';

const USER_PROMPT_TEMPLATES_STORAGE_KEY = 'gpt-image-playground-user-prompt-templates';

type PromptTemplateExport = {
    version: 1;
    exportedAt: string;
    templates: PromptTemplate[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function normalizeTemplate(value: unknown, index: number): PromptTemplate | null {
    if (!isRecord(value)) return null;

    const name = isNonEmptyString(value.name) ? value.name.trim() : '';
    const categoryId = isNonEmptyString(value.categoryId) ? value.categoryId.trim() : '';
    const prompt = isNonEmptyString(value.prompt) ? value.prompt.trim() : '';
    if (!name || !categoryId || !prompt) return null;

    return {
        id: isNonEmptyString(value.id) ? value.id.trim() : `imported-template-${Date.now()}-${index}`,
        name,
        categoryId,
        prompt,
        description: isNonEmptyString(value.description) ? value.description.trim() : undefined
    };
}

export function loadUserPromptTemplates(): PromptTemplateWithSource[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = window.localStorage.getItem(USER_PROMPT_TEMPLATES_STORAGE_KEY);
        if (!stored) return [];

        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((item, index) => normalizeTemplate(item, index))
            .filter((item): item is PromptTemplate => item !== null)
            .map((template) => ({ ...template, source: 'user' }));
    } catch (error) {
        console.warn('Failed to load user prompt templates from localStorage:', error);
        return [];
    }
}

export function saveUserPromptTemplates(templates: PromptTemplateWithSource[]): void {
    if (typeof window === 'undefined') return;

    try {
        const userTemplates = templates
            .filter((template) => template.source === 'user')
            .map(({ id, name, categoryId, prompt, description }) => ({ id, name, categoryId, prompt, description }));
        window.localStorage.setItem(USER_PROMPT_TEMPLATES_STORAGE_KEY, JSON.stringify(userTemplates));
    } catch (error) {
        console.warn('Failed to save user prompt templates to localStorage:', error);
    }
}

export function createPromptTemplatesExport(templates: PromptTemplateWithSource[]): string {
    const payload: PromptTemplateExport = {
        version: 1,
        exportedAt: new Date().toISOString(),
        templates: templates
            .filter((template) => template.source === 'user')
            .map(({ id, name, categoryId, prompt, description }) => ({ id, name, categoryId, prompt, description }))
    };

    return JSON.stringify(payload, null, 2);
}

export function parsePromptTemplatesImport(raw: string): PromptTemplate[] {
    const parsed: unknown = JSON.parse(raw);
    const source = isRecord(parsed) && Array.isArray(parsed.templates) ? parsed.templates : parsed;

    if (!Array.isArray(source)) {
        throw new Error('导入文件格式无效：需要包含 templates 数组，或直接是模板数组。');
    }

    const templates = source
        .map((item, index) => normalizeTemplate(item, index))
        .filter((item): item is PromptTemplate => item !== null);

    if (templates.length === 0) {
        throw new Error('导入文件中没有可用模板。');
    }

    return templates;
}
