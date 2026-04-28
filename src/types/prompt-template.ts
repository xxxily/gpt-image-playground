export type PromptTemplateCategory = {
    id: string;
    name: string;
    description?: string;
};

export type PromptTemplate = {
    id: string;
    name: string;
    categoryId: string;
    prompt: string;
    description?: string;
};

export type PromptTemplateWithSource = PromptTemplate & {
    source: 'default' | 'user';
};

export type PromptTemplatesResponse = {
    categories: PromptTemplateCategory[];
    templates: PromptTemplate[];
};
