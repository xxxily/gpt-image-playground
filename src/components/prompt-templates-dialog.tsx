'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { LocalizedMessage } from '@/components/localized-message';
import { MemoTextarea } from '@/components/memoized-textarea';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isAboveOrAtBreakpoint } from '@/lib/breakpoints';
import { DEFAULT_PROMPT_TEMPLATE_CATEGORIES, DEFAULT_PROMPT_TEMPLATES } from '@/lib/default-prompt-templates';
import { isTauriDesktop } from '@/lib/desktop-runtime';
import { generateId } from '@/lib/id';
import {
    createPromptTemplatesExport,
    loadUserPromptTemplates,
    parsePromptTemplatesImport,
    saveUserPromptTemplates
} from '@/lib/prompt-template-storage';
import { cn } from '@/lib/utils';
import type { PromptTemplate, PromptTemplateCategory, PromptTemplateWithSource } from '@/types/prompt-template';
import {
    Copy,
    Download,
    Edit3,
    FileUp,
    FolderPlus,
    Layers3,
    ListFilter,
    Pin,
    Plus,
    Search,
    NotebookText,
    Sparkles,
    Trash2,
    X
} from 'lucide-react';
import * as React from 'react';

type PromptTemplatesDialogProps = {
    currentPrompt: string;
    onApplyTemplate: (prompt: string) => void;
    triggerClassName?: string;
};

type PanelMode = 'browse' | 'edit' | 'manage';

const ALL_CATEGORY_ID = 'all';
const PINNED_CATEGORIES_STORAGE_KEY = 'gpt-image-playground-pinned-prompt-template-categories';
const UNCATEGORIZED_CATEGORY_ID = 'custom';

function uniqueById<T extends { id: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    const result: T[] = [];
    items.forEach((item) => {
        if (seen.has(item.id)) return;
        seen.add(item.id);
        result.push(item);
    });
    return result;
}

function createTemplateId(): string {
    return generateId('user-template');
}

function getTemplateKey(template: PromptTemplateWithSource): string {
    return `${template.source}:${template.id}`;
}

function normalizeSearch(value: string): string {
    return value.trim().toLocaleLowerCase();
}

function loadPinnedCategoryIds(): string[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = window.localStorage.getItem(PINNED_CATEGORIES_STORAGE_KEY);
        if (!stored) return [];

        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];

        return parsed.filter((item): item is string => typeof item === 'string' && item !== ALL_CATEGORY_ID);
    } catch (error) {
        console.warn('Failed to load pinned prompt template categories:', error);
        return [];
    }
}

function savePinnedCategoryIds(categoryIds: string[]): void {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(PINNED_CATEGORIES_STORAGE_KEY, JSON.stringify(categoryIds));
    } catch (error) {
        console.warn('Failed to save pinned prompt template categories:', error);
    }
}

function PromptTemplatesDialogBase({ currentPrompt, onApplyTemplate, triggerClassName }: PromptTemplatesDialogProps) {
    const { t } = useAppLanguage();
    const [open, setOpen] = React.useState(false);
    const [defaultCategories, setDefaultCategories] = React.useState<PromptTemplateCategory[]>([]);
    const [defaultTemplates, setDefaultTemplates] = React.useState<PromptTemplateWithSource[]>([]);
    const [userTemplates, setUserTemplates] = React.useState<PromptTemplateWithSource[]>([]);
    const [activeCategoryId, setActiveCategoryId] = React.useState(ALL_CATEGORY_ID);
    const [selectedTemplateKey, setSelectedTemplateKey] = React.useState<string | null>(null);
    const [panelMode, setPanelMode] = React.useState<PanelMode>('browse');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [templateName, setTemplateName] = React.useState('');
    const [templateCategory, setTemplateCategory] = React.useState(t('phase4b.myTemplates'));
    const [templatePrompt, setTemplatePrompt] = React.useState(currentPrompt);
    const [editingTemplateId, setEditingTemplateId] = React.useState<string | null>(null);
    const [pinnedCategoryIds, setPinnedCategoryIds] = React.useState<string[]>([]);
    const [status, setStatus] = React.useState<string | null>(null);
    const importInputRef = React.useRef<HTMLInputElement>(null);
    const [mobileCategoriesOpen, setMobileCategoriesOpen] = React.useState(false);
    const [mobileDetailTemplate, setMobileDetailTemplate] = React.useState<PromptTemplateWithSource | null>(null);

    React.useEffect(() => {
        if (!open) return;

        setUserTemplates(loadUserPromptTemplates());
        setTemplatePrompt(currentPrompt);
        setTemplateName('');
        setTemplateCategory(t('phase4b.myTemplates'));
        setEditingTemplateId(null);
        setPanelMode('browse');
        setSearchQuery('');
        setPinnedCategoryIds(loadPinnedCategoryIds());
        setStatus(null);
        setMobileCategoriesOpen(false);
        setMobileDetailTemplate(null);

        let cancelled = false;
        const applyDefaultTemplates = (data: { categories: PromptTemplateCategory[]; templates: PromptTemplate[] }) => {
            if (cancelled) return;

            const categories = Array.isArray(data.categories) ? data.categories : [];
            const templates = Array.isArray(data.templates) ? data.templates : [];
            const nextDefaultTemplates = templates.map((template) => ({ ...template, source: 'default' as const }));
            setDefaultCategories(categories);
            setDefaultTemplates(nextDefaultTemplates);
            setActiveCategoryId(ALL_CATEGORY_ID);
            setSelectedTemplateKey(nextDefaultTemplates[0] ? getTemplateKey(nextDefaultTemplates[0]) : null);
        };

        if (isTauriDesktop()) {
            applyDefaultTemplates({
                categories: DEFAULT_PROMPT_TEMPLATE_CATEGORIES,
                templates: DEFAULT_PROMPT_TEMPLATES
            });
            return () => {
                cancelled = true;
            };
        }

        fetch('/api/prompt-templates')
            .then((response) => {
                if (!response.ok) {
                    throw new Error(t('phase4b.defaultTemplatesLoadFailed', { status: response.status }));
                }
                return response.json() as Promise<{
                    categories: PromptTemplateCategory[];
                    templates: PromptTemplate[];
                }>;
            })
            .then(applyDefaultTemplates)
            .catch((error) => {
                if (cancelled) return;
                console.warn('Failed to fetch default prompt templates:', error);
                setDefaultCategories([]);
                setDefaultTemplates([]);
                setActiveCategoryId(ALL_CATEGORY_ID);
                setStatus(t('phase4b.defaultTemplatesUnavailable'));
            });

        return () => {
            cancelled = true;
        };
    }, [open, currentPrompt, t]);

    const allTemplates = React.useMemo(
        () => [...defaultTemplates, ...userTemplates],
        [defaultTemplates, userTemplates]
    );

    const categories = React.useMemo(() => {
        const dynamicCategories = userTemplates.map((template) => ({
            id: template.categoryId,
            name: template.categoryId,
            description: t('phase4b.userCustomCategory')
        }));
        return uniqueById([
            ...defaultCategories,
            {
                id: UNCATEGORIZED_CATEGORY_ID,
                name: t('phase4b.myTemplates'),
                description: t('phase4b.personalTemplatesDescription')
            },
            ...dynamicCategories
        ]);
    }, [defaultCategories, userTemplates, t]);

    const categoriesWithCounts = React.useMemo(() => {
        const pinnedIndex = new Map(pinnedCategoryIds.map((id, index) => [id, index]));
        const countedCategories = categories.map((category, index) => ({
            ...category,
            count: allTemplates.filter((template) => template.categoryId === category.id).length,
            pinned: pinnedIndex.has(category.id),
            pinnedIndex: pinnedIndex.get(category.id) ?? Number.MAX_SAFE_INTEGER,
            originalIndex: index
        }));
        const sortedCategories = countedCategories.sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            if (a.pinned && b.pinned) return a.pinnedIndex - b.pinnedIndex;
            return a.originalIndex - b.originalIndex;
        });

        return [
            {
                id: ALL_CATEGORY_ID,
                name: t('phase4b.allTemplates'),
                description: t('phase4b.searchAcrossCategoriesDescription'),
                count: allTemplates.length,
                pinned: false
            },
            ...sortedCategories
        ];
    }, [allTemplates, categories, pinnedCategoryIds, t]);

    const categoryNameById = React.useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach((category) => map.set(category.id, category.name));
        return map;
    }, [categories]);

    React.useEffect(() => {
        if (!open || defaultCategories.length === 0 || pinnedCategoryIds.length === 0) return;

        const validCategoryIds = new Set(categories.map((category) => category.id));
        const nextPinnedCategoryIds = pinnedCategoryIds.filter((id) => validCategoryIds.has(id));
        if (nextPinnedCategoryIds.length === pinnedCategoryIds.length) return;

        setPinnedCategoryIds(nextPinnedCategoryIds);
        savePinnedCategoryIds(nextPinnedCategoryIds);
    }, [categories, defaultCategories.length, open, pinnedCategoryIds]);

    const searchTerm = normalizeSearch(searchQuery);
    const visibleTemplates = React.useMemo(() => {
        return allTemplates.filter((template) => {
            const matchesCategory = activeCategoryId === ALL_CATEGORY_ID || template.categoryId === activeCategoryId;
            if (!matchesCategory) return false;
            if (!searchTerm) return true;

            const categoryName = categoryNameById.get(template.categoryId) || template.categoryId;
            const searchableText =
                `${template.name} ${template.description || ''} ${template.prompt} ${categoryName}`.toLocaleLowerCase();
            return searchableText.includes(searchTerm);
        });
    }, [activeCategoryId, allTemplates, categoryNameById, searchTerm]);

    const selectedTemplate = React.useMemo(() => {
        if (!selectedTemplateKey) return visibleTemplates[0] || null;
        return (
            visibleTemplates.find((template) => getTemplateKey(template) === selectedTemplateKey) ||
            visibleTemplates[0] ||
            null
        );
    }, [selectedTemplateKey, visibleTemplates]);

    React.useEffect(() => {
        if (visibleTemplates.length === 0) {
            setSelectedTemplateKey(null);
            return;
        }

        if (
            !selectedTemplateKey ||
            !visibleTemplates.some((template) => getTemplateKey(template) === selectedTemplateKey)
        ) {
            setSelectedTemplateKey(getTemplateKey(visibleTemplates[0]));
        }
    }, [selectedTemplateKey, visibleTemplates]);

    const resetEditor = React.useCallback(
        (categoryId?: string) => {
            setEditingTemplateId(null);
            setTemplateName('');
            setTemplateCategory(
                categoryId && categoryId !== ALL_CATEGORY_ID
                    ? categoryNameById.get(categoryId) || categoryId
                    : t('phase4b.myTemplates')
            );
            setTemplatePrompt(currentPrompt);
        },
        [categoryNameById, currentPrompt, t]
    );

    const handleStartAdd = React.useCallback(
        (categoryId?: string) => {
            resetEditor(categoryId || activeCategoryId);
            setPanelMode('edit');
            setStatus(null);
        },
        [activeCategoryId, resetEditor]
    );

    const handleStartEdit = React.useCallback(
        (template: PromptTemplateWithSource) => {
            setEditingTemplateId(template.source === 'user' ? template.id : null);
            setTemplateName(
                template.source === 'user'
                    ? template.name
                    : t('phase4b.customTemplateCopyName', { name: template.name })
            );
            setTemplateCategory(categoryNameById.get(template.categoryId) || template.categoryId);
            setTemplatePrompt(template.prompt);
            setPanelMode('edit');
            setStatus(template.source === 'default' ? t('phase4b.defaultTemplateCopiedNotice') : null);
        },
        [categoryNameById, t]
    );

    const handleTogglePinnedCategory = React.useCallback(
        (categoryId: string) => {
            if (categoryId === ALL_CATEGORY_ID) return;

            const nextPinnedCategoryIds = pinnedCategoryIds.includes(categoryId)
                ? pinnedCategoryIds.filter((id) => id !== categoryId)
                : [...pinnedCategoryIds, categoryId];
            setPinnedCategoryIds(nextPinnedCategoryIds);
            savePinnedCategoryIds(nextPinnedCategoryIds);
            setStatus(
                nextPinnedCategoryIds.includes(categoryId)
                    ? t('phase4b.categoryPinned')
                    : t('phase4b.categoryUnpinned')
            );
        },
        [pinnedCategoryIds, t]
    );

    const handleSelectTemplate = React.useCallback((template: PromptTemplateWithSource) => {
        setSelectedTemplateKey(getTemplateKey(template));

        if (isAboveOrAtBreakpoint('lg')) {
            setMobileDetailTemplate(null);
            return;
        }

        setMobileDetailTemplate(template);
    }, []);

    const handleSaveTemplate = React.useCallback(() => {
        const name = templateName.trim();
        const rawCategory = templateCategory.trim();
        const matchingCategory = categories.find(
            (category) => category.id === rawCategory || category.name === rawCategory
        );
        const category = matchingCategory?.id || rawCategory || UNCATEGORIZED_CATEGORY_ID;
        const prompt = templatePrompt.trim();

        if (!name || !prompt) {
            setStatus(t('phase4b.templateNameAndPromptRequired'));
            return;
        }

        if (editingTemplateId) {
            const nextTemplates = userTemplates.map((template) =>
                template.id === editingTemplateId ? { ...template, name, categoryId: category, prompt } : template
            );
            setUserTemplates(nextTemplates);
            saveUserPromptTemplates(nextTemplates);
            setActiveCategoryId(category);
            setSelectedTemplateKey(`user:${editingTemplateId}`);
            setStatus(t('phase4b.localTemplateUpdated'));
            setPanelMode('browse');
            return;
        }

        const newTemplate: PromptTemplateWithSource = {
            id: createTemplateId(),
            name,
            categoryId: category,
            prompt,
            source: 'user'
        };
        const nextTemplates = [...userTemplates, newTemplate];
        setUserTemplates(nextTemplates);
        saveUserPromptTemplates(nextTemplates);
        setActiveCategoryId(category);
        setSelectedTemplateKey(getTemplateKey(newTemplate));
        setTemplateName('');
        setTemplateCategory(matchingCategory?.name || category);
        setEditingTemplateId(null);
        setPanelMode('browse');
        setStatus(t('phase4b.savedToCurrentBrowser'));
    }, [categories, editingTemplateId, templateCategory, templateName, templatePrompt, userTemplates, t]);

    const handleDeleteTemplate = React.useCallback(
        (id: string) => {
            const deletedTemplate = userTemplates.find((template) => template.id === id);
            const nextTemplates = userTemplates.filter((template) => template.id !== id);
            setUserTemplates(nextTemplates);
            saveUserPromptTemplates(nextTemplates);
            if (selectedTemplateKey === `user:${id}`) {
                setSelectedTemplateKey(null);
            }
            if (editingTemplateId === id) {
                resetEditor(deletedTemplate?.categoryId);
                setPanelMode('browse');
            }
            setStatus(t('phase4b.localTemplateDeleted'));
        },
        [editingTemplateId, resetEditor, selectedTemplateKey, userTemplates, t]
    );

    const handleExport = React.useCallback(() => {
        const content = createPromptTemplatesExport(userTemplates);
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `gpt-image-prompt-templates-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        setStatus(t('phase4b.localTemplatesExported'));
    }, [userTemplates, t]);

    const handleImportFile = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const raw = typeof reader.result === 'string' ? reader.result : '';
                    const imported = parsePromptTemplatesImport(raw).map((template) => ({
                        ...template,
                        source: 'user' as const
                    }));
                    const merged = uniqueById([...userTemplates, ...imported]);
                    setUserTemplates(merged);
                    saveUserPromptTemplates(merged);
                    setPanelMode('browse');
                    setStatus(t('phase4b.importedTemplateCount', { count: imported.length }));
                } catch (error) {
                    setStatus(error instanceof Error ? error.message : t('phase4b.importFailedCheckJson'));
                }
            };
            reader.onerror = () => setStatus(t('phase4b.importFileReadFailed'));
            reader.readAsText(file);
        },
        [userTemplates, t]
    );

    const localCategoryCount = new Set(userTemplates.map((template) => template.categoryId)).size;
    const currentCategoryName =
        categoriesWithCounts.find((category) => category.id === activeCategoryId)?.name || t('phase4b.allTemplates');

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    type='button'
                    variant={triggerClassName ? 'ghost' : 'outline'}
                    size='sm'
                    className={cn(
                        'border-panel-divider text-on-panel-muted hover:bg-accent hover:text-foreground shrink-0',
                        triggerClassName
                    )}
                    aria-label={t('promptTemplates.openAria')}
                    title={t('phase4b.promptTemplates')}>
                    <NotebookText className='h-3 w-3 sm:mr-1.5' aria-hidden='true' />
                    <span className='sr-only sm:not-sr-only sm:inline'>
                        <LocalizedMessage id='phase4b.promptTemplates' />
                    </span>
                </Button>
            </DialogTrigger>
            <DialogContent className='border-border bg-background text-foreground top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none p-0 shadow-2xl sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[92vh] sm:w-[min(1180px,calc(100vw-2rem))] sm:max-w-[1180px] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl'>
                <div className='border-panel-divider bg-panel-ghost border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] pr-12 sm:px-6 sm:py-3.5'>
                    <DialogHeader>
                        <DialogTitle className='flex items-center gap-2 text-lg font-semibold sm:text-xl'>
                            <span className='rounded-xl border border-violet-400/20 bg-violet-500/10 p-1.5 text-violet-600 dark:text-violet-200'>
                                <Layers3 className='h-4 w-4 sm:h-5 sm:w-5' />
                            </span>
                            <LocalizedMessage id='phase4b.promptTemplateLibrary' />
                        </DialogTitle>
                    </DialogHeader>
                </div>

                <button
                    type='button'
                    onClick={() => setMobileCategoriesOpen(!mobileCategoriesOpen)}
                    className='border-panel-divider bg-panel-ghost text-on-panel-muted hover:bg-panel-subtle hover:text-foreground focus-visible:ring-ring/50 mx-4 mb-2 flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border text-sm transition focus-visible:ring-[3px] focus-visible:outline-none lg:hidden'
                    aria-label={t('promptTemplates.toggleCategoryPanelAria')}
                    aria-expanded={mobileCategoriesOpen}>
                    <ListFilter className='h-4 w-4' />
                    <span>
                        <LocalizedMessage id='inspiration.field.category' />
                    </span>
                    <span className='text-on-panel-faint text-xs'>({categoriesWithCounts.length})</span>
                </button>

                {mobileCategoriesOpen && (
                    <div className='border-panel-divider bg-panel-soft border-b p-2.5 lg:hidden'>
                        <div className='mb-2 flex items-center justify-between gap-3'>
                            <p className='text-on-panel-faint text-xs font-medium tracking-[0.22em] uppercase'>
                                <LocalizedMessage id='inspiration.field.category' />
                            </p>
                            <Button
                                type='button'
                                variant='ghost'
                                size='icon'
                                onClick={() => setMobileCategoriesOpen(false)}
                                className='text-on-panel-muted hover:bg-accent hover:text-foreground h-8 w-8'
                                aria-label={t('promptTemplates.closeCategoryAria')}>
                                <X className='h-4 w-4' />
                            </Button>
                        </div>
                        <div className='relative mb-2'>
                            <Search className='text-on-panel-faint pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder={t('promptTemplates.searchPlaceholder')}
                                aria-label={t('promptTemplates.searchAria')}
                                autoComplete='off'
                                className='border-panel-divider bg-panel-ghost text-foreground placeholder:text-on-panel-faint h-9 rounded-lg pl-9 text-sm focus-visible:border-violet-500/50 focus-visible:ring-violet-500/20'
                            />
                        </div>
                        <div className='flex gap-2 overflow-x-auto pb-1'>
                            {categoriesWithCounts.map((category) => {
                                const selected = category.id === activeCategoryId;
                                return (
                                    <button
                                        key={category.id}
                                        type='button'
                                        onClick={() => {
                                            setActiveCategoryId(category.id);
                                            setPanelMode('browse');
                                            setMobileCategoriesOpen(false);
                                            setMobileDetailTemplate(null);
                                        }}
                                        aria-pressed={selected}
                                        className={`focus-visible:ring-ring/50 shrink-0 rounded-lg border px-3 py-2 text-sm transition focus-visible:ring-[3px] focus-visible:outline-none ${selected ? 'text-foreground border-violet-400/40 bg-violet-500/15' : 'border-panel-divider bg-panel-ghost text-on-panel-muted'}`}>
                                        <span className='font-medium'>{category.name}</span>
                                        <span className='text-on-panel-faint ml-1.5 text-xs'>{category.count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className='grid min-h-0 flex-1 grid-cols-1 overflow-y-auto sm:h-[calc(92vh-132px)] sm:flex-none sm:overflow-hidden lg:grid-cols-[240px_minmax(0,1fr)] lg:overflow-hidden'>
                    <aside className='border-panel-divider bg-panel-soft hidden min-h-0 flex-col border-b p-2.5 sm:p-3 lg:flex lg:border-r lg:border-b-0 lg:p-3'>
                        <div className='mb-2 flex items-center justify-between gap-3'>
                            <p className='text-on-panel-faint text-xs font-medium tracking-[0.22em] uppercase'>
                                <LocalizedMessage id='inspiration.field.category' />
                            </p>
                            <Button
                                type='button'
                                variant='ghost'
                                size='icon'
                                onClick={() => handleStartAdd(activeCategoryId)}
                                className='text-on-panel-muted hover:bg-accent hover:text-foreground h-10 w-10 sm:h-8 sm:w-8'
                                aria-label={t('phase4b.addTemplate')}>
                                <Plus className='h-4 w-4' />
                            </Button>
                        </div>
                        <div className='relative mb-2 sm:mb-3'>
                            <Search className='text-on-panel-faint pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder={t('promptTemplates.searchPlaceholder')}
                                aria-label={t('promptTemplates.searchAria')}
                                autoComplete='off'
                                className='border-panel-divider bg-panel-ghost text-foreground placeholder:text-on-panel-faint h-9 rounded-lg pl-9 text-sm focus-visible:border-violet-500/50 focus-visible:ring-violet-500/20'
                            />
                        </div>
                        <div className='mb-2 flex scrollbar-thin gap-2 overflow-x-auto pb-1 sm:mb-3 lg:mb-2 lg:min-h-0 lg:flex-1 lg:flex-col lg:space-y-1 lg:overflow-y-auto lg:pr-1'>
                            {categoriesWithCounts.map((category) => {
                                const selected = category.id === activeCategoryId;
                                const pinVisibilityClass = category.pinned
                                    ? 'opacity-100'
                                    : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100';
                                return (
                                    <div
                                        key={category.id}
                                        className={`group flex shrink-0 items-center gap-1 rounded-lg border px-3 py-2 text-sm transition sm:py-1.5 lg:w-full lg:shrink lg:py-1.5 ${selected ? 'text-foreground dark:text-foreground border-violet-400/40 bg-violet-500/15' : 'border-panel-divider bg-panel-ghost text-on-panel-muted hover:border-panel-divider hover:bg-panel-ghost hover:text-foreground dark:border-panel-divider dark:bg-panel-ghost'}`}>
                                        <button
                                            type='button'
                                            onClick={() => {
                                                setActiveCategoryId(category.id);
                                                setPanelMode('browse');
                                            }}
                                            className='focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-1.5 truncate rounded text-left focus-visible:ring-[3px] focus-visible:outline-none'
                                            aria-pressed={selected}>
                                            <span className='truncate font-medium'>{category.name}</span>
                                        </button>
                                        <span
                                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${selected ? 'bg-accent text-foreground' : 'bg-panel-subtle text-on-panel-faint'}`}>
                                            {category.count}
                                        </span>
                                        {category.id !== ALL_CATEGORY_ID && (
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='icon'
                                                onClick={() => handleTogglePinnedCategory(category.id)}
                                                className={`-my-1 h-8 w-8 shrink-0 rounded-md transition-opacity sm:h-7 sm:w-7 ${pinVisibilityClass} ${category.pinned ? 'text-amber-600 hover:bg-amber-500/12 hover:text-amber-700 dark:text-amber-200 dark:hover:bg-amber-400/10 dark:hover:text-amber-100' : 'hover:bg-accent dark:text-on-panel-faint dark:hover:text-foreground text-slate-500 hover:text-slate-700'}`}
                                                aria-label={
                                                    category.pinned
                                                        ? t('phase4b.unpinCategoryAria', { category: category.name })
                                                        : t('phase4b.pinCategoryAria', { category: category.name })
                                                }
                                                title={
                                                    category.pinned
                                                        ? t('phase4b.unpinCategory')
                                                        : t('phase4b.pinCategory')
                                                }>
                                                <Pin className='h-3.5 w-3.5' />
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </aside>

                    <section className='grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-visible lg:overflow-hidden'>
                        <div className='border-panel-divider bg-popover flex flex-col gap-2 border-b px-3 py-2 sm:px-5 sm:py-2.5 xl:flex-row xl:items-center xl:justify-between'>
                            <p className='text-foreground text-sm font-medium'>{currentCategoryName}</p>
                            <div className='flex flex-wrap gap-1.5'>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant={panelMode === 'browse' ? 'default' : 'outline'}
                                    onClick={() => setPanelMode('browse')}
                                    className={`min-h-[44px] sm:min-h-0 ${panelMode === 'browse' ? 'bg-foreground text-background hover:bg-foreground/90' : 'border-panel-divider text-on-panel-muted hover:bg-accent hover:text-foreground'}`}>
                                    <LocalizedMessage id='phase4b.browseTemplates' />
                                </Button>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant={panelMode === 'edit' ? 'default' : 'outline'}
                                    onClick={() => handleStartAdd(activeCategoryId)}
                                    className={`min-h-[44px] sm:min-h-0 ${panelMode === 'edit' ? 'bg-violet-600 text-white hover:bg-violet-500' : 'border-panel-divider text-on-panel-muted hover:bg-accent hover:text-foreground'}`}>
                                    <FolderPlus className='mr-1.5 h-4 w-4' />
                                    <LocalizedMessage id='phase4b.addTemplate' />
                                </Button>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant={panelMode === 'manage' ? 'default' : 'outline'}
                                    onClick={() => setPanelMode('manage')}
                                    className={`min-h-[44px] sm:min-h-0 ${panelMode === 'manage' ? 'bg-foreground text-background hover:bg-foreground/90' : 'border-panel-divider text-on-panel-muted hover:bg-accent hover:text-foreground'}`}>
                                    <LocalizedMessage id='phase4b.manageLocal' />
                                </Button>
                            </div>
                        </div>

                        <div className='min-h-0 overflow-visible p-3 sm:p-4 lg:overflow-y-auto'>
                            {panelMode === 'browse' && (
                                <div className='grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(280px,0.9fr)_minmax(360px,1.1fr)]'>
                                    <div className='bg-panel-soft lg:border-panel-divider flex min-h-0 flex-col rounded-2xl border-0 p-2 sm:p-2.5 lg:border'>
                                        {visibleTemplates.length === 0 ? (
                                            <div className='border-panel-divider bg-panel-soft flex h-full min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center'>
                                                <Sparkles className='text-on-panel-faint mb-2 h-7 w-7' />
                                                <p className='text-on-panel-muted text-sm font-medium'>
                                                    <LocalizedMessage id='phase4b.noMatchingTemplates' />
                                                </p>
                                                <Button
                                                    type='button'
                                                    size='sm'
                                                    onClick={() => handleStartAdd(activeCategoryId)}
                                                    className='mt-3 min-h-[44px] bg-violet-600 text-white hover:bg-violet-500 sm:min-h-0'>
                                                    <Plus className='mr-1.5 h-4 w-4' />
                                                    <LocalizedMessage id='phase4b.addTemplate' />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className='grid min-h-0 flex-1 content-start gap-2 overflow-visible lg:overflow-y-auto lg:pr-1'>
                                                {visibleTemplates.map((template) => {
                                                    const selected = selectedTemplate
                                                        ? getTemplateKey(template) === getTemplateKey(selectedTemplate)
                                                        : false;
                                                    const categoryName =
                                                        categoryNameById.get(template.categoryId) ||
                                                        template.categoryId;
                                                    return (
                                                        <button
                                                            key={getTemplateKey(template)}
                                                            type='button'
                                                            onClick={() => handleSelectTemplate(template)}
                                                            aria-pressed={selected}
                                                            className={`focus-visible:ring-ring/50 rounded-lg border p-2.5 text-left text-sm transition focus-visible:ring-[3px] focus-visible:outline-none ${selected ? 'border-violet-400/40 bg-violet-500/12 shadow-lg shadow-violet-950/20' : 'border-panel-divider bg-panel-ghost hover:border-panel-divider hover:bg-panel-subtle'}`}>
                                                            <div className='flex items-start justify-between gap-3'>
                                                                <div className='min-w-0'>
                                                                    <p
                                                                        className='text-foreground truncate text-sm font-medium'
                                                                        data-i18n-skip='true'>
                                                                        {template.name}
                                                                    </p>
                                                                    <p
                                                                        className='text-on-panel-faint mt-0.5 truncate text-[11px]'
                                                                        data-i18n-skip='true'>
                                                                        {categoryName}
                                                                    </p>
                                                                </div>
                                                                <span
                                                                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${template.source === 'default' ? 'bg-violet-500/15 text-violet-700 dark:text-violet-200' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'}`}>
                                                                    {template.source === 'default'
                                                                        ? t('phase4b.preset')
                                                                        : t('phase4b.local')}
                                                                </span>
                                                            </div>
                                                            {template.description && (
                                                                <p
                                                                    className='text-on-panel-faint mt-1.5 line-clamp-1 text-[11px]'
                                                                    data-i18n-skip='true'>
                                                                    {template.description}
                                                                </p>
                                                            )}
                                                            <p
                                                                className='text-on-panel-muted mt-1.5 line-clamp-2 text-[11px] leading-4'
                                                                data-i18n-skip='true'>
                                                                {template.prompt}
                                                            </p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div className='border-panel-divider hidden min-h-0 rounded-2xl border bg-gradient-to-br from-white/[0.055] to-white/[0.02] p-3 sm:p-5 lg:flex'>
                                        {selectedTemplate ? (
                                            <div className='flex h-full min-h-0 flex-col'>
                                                <div className='flex flex-wrap items-start justify-between gap-3'>
                                                    <div className='min-w-0'>
                                                        <div className='mb-2 flex flex-wrap items-center gap-2'>
                                                            <span
                                                                className={`rounded-full px-2.5 py-1 text-xs ${selectedTemplate.source === 'default' ? 'bg-violet-500/15 text-violet-700 dark:text-violet-200' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'}`}>
                                                                {selectedTemplate.source === 'default'
                                                                    ? t('phase4b.preset')
                                                                    : t('phase4b.local')}
                                                            </span>
                                                            <span className='bg-panel-subtle text-on-panel-faint rounded-full px-2.5 py-1 text-xs'>
                                                                <span data-i18n-skip='true'>
                                                                    {categoryNameById.get(
                                                                        selectedTemplate.categoryId
                                                                    ) || selectedTemplate.categoryId}
                                                                </span>
                                                            </span>
                                                        </div>
                                                        <h3
                                                            className='text-foreground text-lg font-semibold sm:text-xl'
                                                            data-i18n-skip='true'>
                                                            {selectedTemplate.name}
                                                        </h3>
                                                        {selectedTemplate.description && (
                                                            <p
                                                                className='text-on-panel-muted mt-2 text-sm'
                                                                data-i18n-skip='true'>
                                                                {selectedTemplate.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <Button
                                                        type='button'
                                                        size='sm'
                                                        onClick={() => {
                                                            onApplyTemplate(selectedTemplate.prompt);
                                                            setOpen(false);
                                                        }}
                                                        className='bg-foreground text-background hover:bg-foreground/90'>
                                                        <Sparkles className='mr-1.5 h-4 w-4' />
                                                        <LocalizedMessage id='phase4b.useTemplate' />
                                                    </Button>
                                                </div>

                                                <div className='border-panel-divider bg-panel-soft mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border p-3'>
                                                    <p className='text-on-panel-faint mb-1.5 text-[10px] font-medium tracking-[0.22em] uppercase'>
                                                        <LocalizedMessage id='video.history.prompt' />
                                                    </p>
                                                    <p
                                                        className='text-on-panel-muted text-sm leading-6 whitespace-pre-wrap'
                                                        data-i18n-skip='true'>
                                                        {selectedTemplate.prompt}
                                                    </p>
                                                </div>

                                                <div className='mt-3 flex flex-wrap gap-2'>
                                                    <Button
                                                        type='button'
                                                        variant='outline'
                                                        onClick={() => handleStartEdit(selectedTemplate)}
                                                        className='border-panel-divider text-on-panel-muted hover:bg-accent hover:text-foreground'>
                                                        {selectedTemplate.source === 'user' ? (
                                                            <Edit3 className='mr-1.5 h-4 w-4' />
                                                        ) : (
                                                            <Copy className='mr-1.5 h-4 w-4' />
                                                        )}
                                                        {selectedTemplate.source === 'user'
                                                            ? t('phase4b.editTemplate')
                                                            : t('phase4b.copyAsLocalTemplate')}
                                                    </Button>
                                                    {selectedTemplate.source === 'user' && (
                                                        <Button
                                                            type='button'
                                                            variant='outline'
                                                            onClick={() => handleDeleteTemplate(selectedTemplate.id)}
                                                            className='border-red-400/20 text-red-200 hover:bg-red-500/10 hover:text-red-100'>
                                                            <Trash2 className='mr-1.5 h-4 w-4' />
                                                            <LocalizedMessage id='assets.action.delete' />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className='border-panel-divider text-on-panel-faint flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-dashed text-sm'>
                                                <LocalizedMessage id='phase4b.selectATemplateToViewDetails' />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {panelMode === 'edit' && (
                                <div className='border-panel-divider bg-panel-ghost mx-auto max-w-3xl rounded-2xl border p-3 shadow-xl shadow-black/20 sm:p-5'>
                                    <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
                                        <div>
                                            <p className='text-xs font-medium tracking-[0.22em] text-violet-200/70 uppercase'>
                                                <LocalizedMessage id='phase4b.localTemplates' />
                                            </p>
                                            <h3 className='text-foreground mt-0.5 text-lg font-semibold sm:text-xl'>
                                                {editingTemplateId ? t('phase4b.editTemplate') : t('phase4b.addTemplate')}
                                            </h3>
                                        </div>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            onClick={() => setPanelMode('browse')}
                                            className='border-panel-divider text-on-panel-muted hover:bg-accent hover:text-foreground'>
                                            <LocalizedMessage id='phase4b.backToBrowse' />
                                        </Button>
                                    </div>

                                    <div className='grid gap-3 sm:gap-4 md:grid-cols-2'>
                                        <div className='space-y-1.5'>
                                            <Label htmlFor='template-name' className='text-foreground'>
                                                <LocalizedMessage id='phase4b.templateName' />
                                            </Label>
                                            <Input
                                                id='template-name'
                                                value={templateName}
                                                onChange={(event) => setTemplateName(event.target.value)}
                                                placeholder={t('promptTemplates.namePlaceholder')}
                                                autoComplete='off'
                                                className='border-panel-divider bg-panel-ghost text-foreground placeholder:text-on-panel-faint rounded-lg focus-visible:border-violet-500/50 focus-visible:ring-violet-500/20'
                                            />
                                        </div>
                                        <div className='space-y-1.5'>
                                            <Label htmlFor='template-category' className='text-foreground'>
                                                <LocalizedMessage id='inspiration.field.category' />
                                            </Label>
                                            <Input
                                                id='template-category'
                                                list='prompt-template-categories'
                                                value={templateCategory}
                                                onChange={(event) => setTemplateCategory(event.target.value)}
                                                placeholder={t('promptTemplates.categoryPlaceholder')}
                                                autoComplete='off'
                                                className='border-panel-divider bg-panel-ghost text-foreground placeholder:text-on-panel-faint rounded-lg focus-visible:border-violet-500/50 focus-visible:ring-violet-500/20'
                                            />
                                            <datalist id='prompt-template-categories'>
                                                {categories.map((category) => (
                                                    <option key={category.id} value={category.name} />
                                                ))}
                                            </datalist>
                                        </div>
                                    </div>

                                    <div className='mt-3 space-y-1.5'>
                                        <Label htmlFor='template-prompt' className='text-foreground'>
                                            <LocalizedMessage id='phase4b.templatePrompt' />
                                        </Label>
                                        <MemoTextarea
                                            id='template-prompt'
                                            value={templatePrompt}
                                            valueSetter={setTemplatePrompt}
                                            placeholder={t('promptTemplates.promptPlaceholder')}
                                            className='border-panel-divider bg-panel-ghost text-foreground placeholder:text-on-panel-faint min-h-[200px] rounded-lg focus-visible:border-violet-500/50 focus-visible:ring-violet-500/20'
                                        />
                                    </div>

                                    <div className='mt-4 flex flex-wrap justify-end gap-2'>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            onClick={() => resetEditor(activeCategoryId)}
                                            className='border-panel-divider text-on-panel-muted hover:bg-accent hover:text-foreground'>
                                            <LocalizedMessage id='phase4b.clearAndRefill' />
                                        </Button>
                                        <Button
                                            type='button'
                                            onClick={handleSaveTemplate}
                                            className='bg-violet-600 text-white hover:bg-violet-500'>
                                            <Plus className='mr-1.5 h-4 w-4' />
                                            {editingTemplateId ? t('phase4b.saveChanges') : t('phase4b.saveAsLocalTemplate')}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {panelMode === 'manage' && (
                                <div className='grid gap-3 xl:grid-cols-[0.9fr_1.1fr]'>
                                    <div className='border-panel-divider bg-panel-ghost rounded-2xl border p-3 sm:p-4'>
                                        <p className='text-on-panel-faint text-xs font-medium tracking-[0.22em] uppercase'>
                                            <LocalizedMessage id='phase4b.migrationAndBackup' />
                                        </p>
                                        <h3 className='text-foreground mt-1 text-lg font-semibold'>
                                            <LocalizedMessage id='phase4b.manageLocalTemplates' />
                                        </h3>
                                        <div className='mt-3 grid grid-cols-2 gap-2'>
                                            <Button
                                                type='button'
                                                variant='outline'
                                                onClick={() => importInputRef.current?.click()}
                                                className='border-panel-divider text-on-panel-muted hover:bg-accent hover:text-foreground h-11 sm:h-10'>
                                                <FileUp className='mr-1.5 h-4 w-4' />
                                                <LocalizedMessage id='inspiration.action.importJson' />
                                            </Button>
                                            <Button
                                                type='button'
                                                variant='outline'
                                                onClick={handleExport}
                                                disabled={userTemplates.length === 0}
                                                className='border-panel-divider text-on-panel-muted hover:bg-accent hover:text-foreground h-11 sm:h-10'>
                                                <Download className='mr-1.5 h-4 w-4' />
                                                <LocalizedMessage id='inspiration.action.exportJson' />
                                            </Button>
                                        </div>
                                        <Input
                                            ref={importInputRef}
                                            type='file'
                                            accept='application/json,.json'
                                            onChange={handleImportFile}
                                            className='sr-only'
                                        />
                                        <div className='mt-3 grid grid-cols-3 gap-2'>
                                            <div className='border-panel-divider bg-panel-soft rounded-lg border p-2.5'>
                                                <p className='text-foreground text-xl font-semibold'>
                                                    {userTemplates.length}
                                                </p>
                                                <p className='text-on-panel-faint mt-0.5 text-xs'>
                                                    <LocalizedMessage id='settings.promptToolbar.templates' />
                                                </p>
                                            </div>
                                            <div className='border-panel-divider bg-panel-soft rounded-lg border p-2.5'>
                                                <p className='text-foreground text-xl font-semibold'>
                                                    {localCategoryCount}
                                                </p>
                                                <p className='text-on-panel-faint mt-0.5 text-xs'>
                                                    <LocalizedMessage id='inspiration.field.category' />
                                                </p>
                                            </div>
                                            <div className='border-panel-divider bg-panel-soft rounded-lg border p-2.5'>
                                                <p className='text-foreground text-xl font-semibold'>
                                                    {defaultTemplates.length}
                                                </p>
                                                <p className='text-on-panel-faint mt-0.5 text-xs'>
                                                    <LocalizedMessage id='phase4b.preset' />
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className='border-panel-divider bg-panel-ghost rounded-2xl border p-3 sm:p-4'>
                                        <div className='mb-2 flex items-center justify-between gap-3'>
                                            <p className='text-foreground font-medium'>
                                                <LocalizedMessage id='phase4b.localTemplateList' />
                                            </p>
                                            <Button
                                                type='button'
                                                size='sm'
                                                onClick={() => handleStartAdd(activeCategoryId)}
                                                className='min-h-[44px] bg-violet-600 text-white hover:bg-violet-500 sm:min-h-0'>
                                                <Plus className='mr-1.5 h-4 w-4' />
                                                <LocalizedMessage id='phase4b.add' />
                                            </Button>
                                        </div>
                                        {userTemplates.length === 0 ? (
                                            <div className='border-panel-divider bg-panel-soft text-on-panel-faint rounded-xl border border-dashed p-4 text-center text-sm'>
                                                <LocalizedMessage id='phase4b.noLocalTemplatesYet' />
                                            </div>
                                        ) : (
                                            <div className='max-h-[380px] space-y-1.5 overflow-y-auto pr-1'>
                                                {userTemplates.map((template) => (
                                                    <div
                                                        key={template.id}
                                                        className='border-panel-divider bg-panel-soft rounded-lg border p-2.5'>
                                                        <div className='flex items-start justify-between gap-3'>
                                                            <div className='min-w-0'>
                                                                <p
                                                                    className='text-foreground truncate text-sm font-medium'
                                                                    data-i18n-skip='true'>
                                                                    {template.name}
                                                                </p>
                                                                <p
                                                                    className='text-on-panel-faint mt-0.5 text-xs'
                                                                    data-i18n-skip='true'>
                                                                    {categoryNameById.get(template.categoryId) ||
                                                                        template.categoryId}
                                                                </p>
                                                            </div>
                                                            <div className='flex gap-1'>
                                                                <Button
                                                                    type='button'
                                                                    variant='ghost'
                                                                    size='icon'
                                                                    onClick={() => handleStartEdit(template)}
                                                                    className='text-on-panel-muted hover:bg-accent hover:text-foreground h-7 w-7'
                                                                    aria-label={t('phase4b.editTemplateAria', {
                                                                        name: template.name
                                                                    })}>
                                                                    <Edit3 className='h-3.5 w-3.5' />
                                                                </Button>
                                                                <Button
                                                                    type='button'
                                                                    variant='ghost'
                                                                    size='icon'
                                                                    onClick={() => handleDeleteTemplate(template.id)}
                                                                    className='text-on-panel-faint h-7 w-7 hover:bg-red-500/10 hover:text-red-200'
                                                                    aria-label={t('phase4b.deleteTemplateAria', {
                                                                        name: template.name
                                                                    })}>
                                                                    <Trash2 className='h-3.5 w-3.5' />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <p
                                                            className='text-on-panel-muted mt-1.5 line-clamp-2 text-[11px] leading-4'
                                                            data-i18n-skip='true'>
                                                            {template.prompt}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <Dialog
                    open={Boolean(mobileDetailTemplate)}
                    onOpenChange={(nextOpen) => {
                        if (!nextOpen) setMobileDetailTemplate(null);
                    }}>
                    <DialogContent className='border-panel-divider bg-popover text-foreground top-auto bottom-0 left-0 max-h-[85vh] w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-t-2xl p-4 shadow-2xl sm:left-1/2 sm:max-h-[80vh] sm:max-w-[min(560px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-2xl lg:hidden'>
                        {mobileDetailTemplate && (
                            <>
                                <DialogHeader className='pr-8 text-left'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-xs ${mobileDetailTemplate.source === 'default' ? 'bg-violet-500/15 text-violet-700 dark:text-violet-200' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'}`}>
                                            {mobileDetailTemplate.source === 'default'
                                                ? t('phase4b.preset')
                                                : t('phase4b.local')}
                                        </span>
                                        <span className='bg-panel-subtle text-on-panel-faint rounded-full px-2.5 py-1 text-xs'>
                                            <span data-i18n-skip='true'>
                                                {categoryNameById.get(mobileDetailTemplate.categoryId) ||
                                                    mobileDetailTemplate.categoryId}
                                            </span>
                                        </span>
                                    </div>
                                    <DialogTitle
                                        className='text-foreground mt-3 text-lg font-semibold'
                                        data-i18n-skip='true'>
                                        {mobileDetailTemplate.name}
                                    </DialogTitle>
                                    {mobileDetailTemplate.description ? (
                                        <DialogDescription
                                            className='text-on-panel-muted text-sm'
                                            data-i18n-skip='true'>
                                            {mobileDetailTemplate.description}
                                        </DialogDescription>
                                    ) : (
                                        <DialogDescription className='sr-only'>
                                            <LocalizedMessage id='phase4b.viewPromptTemplateDetailsAndChooseWhetherTo' />
                                        </DialogDescription>
                                    )}
                                </DialogHeader>
                                <div className='border-panel-divider bg-panel-soft max-h-[40vh] min-h-[120px] overflow-y-auto rounded-xl border p-3'>
                                    <p className='text-on-panel-faint mb-1.5 text-[10px] font-medium tracking-[0.22em] uppercase'>
                                        <LocalizedMessage id='video.history.prompt' />
                                    </p>
                                    <p
                                        className='text-on-panel-muted text-sm leading-6 whitespace-pre-wrap'
                                        data-i18n-skip='true'>
                                        {mobileDetailTemplate.prompt}
                                    </p>
                                </div>
                                <DialogFooter className='flex-col-reverse gap-2 sm:flex-row sm:justify-start'>
                                    <Button
                                        type='button'
                                        size='sm'
                                        onClick={() => {
                                            onApplyTemplate(mobileDetailTemplate.prompt);
                                            setMobileDetailTemplate(null);
                                            setOpen(false);
                                        }}
                                        className='bg-foreground text-background hover:bg-foreground/90 min-h-[44px]'>
                                        <Sparkles className='mr-1.5 h-4 w-4' />
                                        <LocalizedMessage id='phase4b.useTemplate' />
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        onClick={() => {
                                            handleStartEdit(mobileDetailTemplate);
                                            setMobileDetailTemplate(null);
                                        }}
                                        className='border-panel-divider text-on-panel-muted hover:bg-accent hover:text-foreground min-h-[44px]'>
                                        {mobileDetailTemplate.source === 'user' ? (
                                            <Edit3 className='mr-1.5 h-4 w-4' />
                                        ) : (
                                            <Copy className='mr-1.5 h-4 w-4' />
                                        )}
                                        {mobileDetailTemplate.source === 'user'
                                            ? t('phase4b.editTemplate')
                                            : t('phase4b.copyAsLocalTemplate')}
                                    </Button>
                                    {mobileDetailTemplate.source === 'user' && (
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={() => {
                                                handleDeleteTemplate(mobileDetailTemplate.id);
                                                setMobileDetailTemplate(null);
                                            }}
                                            className='min-h-[44px] border-red-400/20 text-red-200 hover:bg-red-500/10 hover:text-red-100'>
                                            <Trash2 className='mr-1.5 h-4 w-4' />
                                            <LocalizedMessage id='assets.action.delete' />
                                        </Button>
                                    )}
                                </DialogFooter>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                <DialogFooter className='border-panel-divider bg-panel-soft border-t px-5 py-4'>
                    <div className='flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                        {status ? (
                            <p
                                aria-live='polite'
                                className='border-panel-divider bg-panel-ghost text-on-panel-muted rounded-lg border px-3 py-2 text-xs'>
                                {status}
                            </p>
                        ) : (
                            <div />
                        )}
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => setOpen(false)}
                            className='border-panel-divider text-on-panel-muted hover:bg-accent hover:text-foreground min-h-[44px] sm:min-h-0'>
                            <LocalizedMessage id='tasks.dismiss' />
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export const PromptTemplatesDialog = React.memo(PromptTemplatesDialogBase) as typeof PromptTemplatesDialogBase;
