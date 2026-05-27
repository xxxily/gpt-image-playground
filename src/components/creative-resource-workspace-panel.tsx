'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { useNotice } from '@/components/notice-provider';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    ASSET_LIBRARY_CHANGED_EVENT,
    DEFAULT_ASSET_LIBRARY_CATEGORY_ID,
    deleteAssetLibraryItems,
    estimateAssetLibraryStorage,
    formatAssetLibraryFileSize,
    getAssetLibraryFile,
    importAssetLibraryIndex,
    importAssetFilesToLibrary,
    isAssetLibraryImage,
    listAssetLibraryItems,
    loadAssetLibraryCategories,
    markAssetLibraryItemUsed,
    saveCustomAssetLibraryCategory,
    updateAssetLibraryItem
} from '@/lib/asset-library';
import { copyTextToClipboard, openExternalUrl } from '@/lib/desktop-runtime';
import {
    INSPIRATION_SITES_CHANGED_EVENT,
    loadInspirationSitesState,
    saveInspirationSitesState,
    validateInspirationUrl
} from '@/lib/inspiration-sites';
import { cn } from '@/lib/utils';
import type { AssetLibraryCategory, AssetLibraryItem } from '@/types/asset-library';
import type { InspirationSite, InspirationSiteCategory, InspirationSitesState } from '@/types/inspiration-sites';
import type { WorkspacePanelTab } from '@/types/workspace-panel';
import {
    AlertTriangle,
    Archive,
    Boxes,
    ChevronLeft,
    Compass,
    Download,
    ExternalLink,
    FileImage,
    FolderPlus,
    Heart,
    ImagePlus,
    LinkIcon,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Search,
    Send,
    Star,
    Trash2,
    Upload,
    X
} from 'lucide-react';
import * as React from 'react';

type CreativeResourceWorkspacePanelProps = {
    activeTab: WorkspacePanelTab;
    currentSourceFiles: readonly File[];
    onActiveTabChange: (tab: WorkspacePanelTab) => void;
    onUseAssetFiles: (files: File[]) => void | boolean;
    onOpenDrawer: (tab: WorkspacePanelTab) => void;
};

type StorageEstimateState = {
    usage?: number;
    quota?: number;
    ratio?: number;
};

function normalizeSearch(value: string): string {
    return value.trim().toLocaleLowerCase();
}

function formatDate(value: number, language: string): string {
    return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function getCategoryLabel(
    category: AssetLibraryCategory | InspirationSiteCategory,
    t: (key: string) => string
): string {
    if ('labelKey' in category && category.labelKey) return t(category.labelKey);
    if ('name' in category && category.name) return category.name;
    if ('customName' in category && category.customName) return category.customName;
    return category.id;
}

function downloadJson(filename: string, value: unknown): void {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

async function readJsonFile(file: File): Promise<unknown> {
    return JSON.parse(await file.text());
}

function AssetThumbnail({ item, selected }: { item: AssetLibraryItem; selected: boolean }) {
    const [url, setUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        let objectUrl: string | null = null;

        if (!isAssetLibraryImage(item)) {
            setUrl(null);
            return;
        }

        getAssetLibraryFile(item).then((file) => {
            if (!file || cancelled) return;
            objectUrl = URL.createObjectURL(file);
            setUrl(objectUrl);
        });

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [item]);

    if (!url) {
        return (
            <div
                className={cn(
                    'bg-muted/40 text-muted-foreground/60 flex aspect-square items-center justify-center rounded-xl border border-border/40',
                    selected && 'border-primary'
                )}>
                {item.kind === 'archive' ? <Archive className='h-6 w-6' /> : <FileImage className='h-6 w-6' />}
            </div>
        );
    }

    return (
        <div className={cn('bg-muted/40 aspect-square overflow-hidden rounded-xl border border-border/40', selected && 'border-primary')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt='' className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105' draggable={false} />
        </div>
    );
}

export function CreativeResourceWorkspacePanel({
    activeTab,
    currentSourceFiles,
    onActiveTabChange,
    onUseAssetFiles,
    onOpenDrawer
}: CreativeResourceWorkspacePanelProps) {
    const { t, language } = useAppLanguage();
    const { addNotice } = useNotice();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const assetIndexInputRef = React.useRef<HTMLInputElement>(null);
    const [items, setItems] = React.useState<AssetLibraryItem[]>([]);
    const [categories, setCategories] = React.useState<AssetLibraryCategory[]>(() => loadAssetLibraryCategories());
    const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState('');
    const [categoryFilter, setCategoryFilter] = React.useState('all');
    const [kindFilter, setKindFilter] = React.useState('all');
    const [tagDraft, setTagDraft] = React.useState('');
    const [noteDraft, setNoteDraft] = React.useState('');
    const [nameDraft, setNameDraft] = React.useState('');
    const [customCategoryDraft, setCustomCategoryDraft] = React.useState('');
    const [storageEstimate, setStorageEstimate] = React.useState<StorageEstimateState>({});
    const [deleteAssetId, setDeleteAssetId] = React.useState<string | null>(null);
    const [isDraggingAssets, setIsDraggingAssets] = React.useState(false);
    const [inspirationState, setInspirationState] = React.useState<InspirationSitesState>(() =>
        loadInspirationSitesState()
    );
    const [inspirationSearch, setInspirationSearch] = React.useState('');
    const [activeInspirationCategoryId, setActiveInspirationCategoryId] = React.useState('all');
    const [iframeSite, setIframeSite] = React.useState<InspirationSite | null>(null);
    const [iframeBusy, setIframeBusy] = React.useState(false);
    const [iframeTimedOut, setIframeTimedOut] = React.useState(false);
    const [iframeReloadKey, setIframeReloadKey] = React.useState(0);

    const refreshAssets = React.useCallback(() => {
        setCategories(loadAssetLibraryCategories());
        void listAssetLibraryItems().then(setItems);
        void estimateAssetLibraryStorage().then(setStorageEstimate);
    }, []);

    React.useEffect(() => {
        refreshAssets();
        setInspirationState(loadInspirationSitesState());
    }, [refreshAssets]);

    React.useEffect(() => {
        const refresh = () => refreshAssets();
        window.addEventListener(ASSET_LIBRARY_CHANGED_EVENT, refresh);
        return () => window.removeEventListener(ASSET_LIBRARY_CHANGED_EVENT, refresh);
    }, [refreshAssets]);

    React.useEffect(() => {
        const refresh = () => setInspirationState(loadInspirationSitesState());
        window.addEventListener(INSPIRATION_SITES_CHANGED_EVENT, refresh);
        return () => window.removeEventListener(INSPIRATION_SITES_CHANGED_EVENT, refresh);
    }, []);

    const selectedAsset = React.useMemo(
        () => items.find((item) => item.id === selectedAssetId) ?? null,
        [items, selectedAssetId]
    );

    React.useEffect(() => {
        if (!selectedAsset) {
            setNameDraft('');
            setTagDraft('');
            setNoteDraft('');
            return;
        }
        setNameDraft(selectedAsset.displayName);
        setTagDraft(selectedAsset.tags.join(', '));
        setNoteDraft(selectedAsset.note ?? '');
    }, [selectedAsset]);

    const categoryById = React.useMemo(() => {
        const map = new Map<string, AssetLibraryCategory>();
        categories.forEach((category) => map.set(category.id, category));
        return map;
    }, [categories]);

    const filteredAssets = React.useMemo(() => {
        const term = normalizeSearch(search);
        return items.filter((item) => {
            if (categoryFilter !== 'all' && item.categoryId !== categoryFilter) return false;
            if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
            if (!term) return true;
            const haystack = [
                item.displayName,
                item.originalFilename,
                item.note ?? '',
                item.kind,
                categoryById.get(item.categoryId)?.name ?? '',
                ...(item.tags ?? [])
            ]
                .join(' ')
                .toLocaleLowerCase();
            return haystack.includes(term);
        });
    }, [categoryById, categoryFilter, items, kindFilter, search]);

    const saveInspirationState = React.useCallback((next: InspirationSitesState) => {
        setInspirationState(next);
        saveInspirationSitesState(next);
    }, []);

    const inspirationCategories = inspirationState.categories.filter((category) => category.enabled);
    const inspirationCategoryById = React.useMemo(() => {
        const map = new Map<string, InspirationSiteCategory>();
        inspirationState.categories.forEach((category) => map.set(category.id, category));
        return map;
    }, [inspirationState.categories]);

    const visibleSites = React.useMemo(() => {
        const term = normalizeSearch(inspirationSearch);
        return inspirationState.sites
            .filter((site) => site.enabled)
            .filter((site) => activeInspirationCategoryId === 'all' || site.categoryId === activeInspirationCategoryId)
            .filter((site) => {
                if (!term) return true;
                return [site.title, site.url, site.description ?? '', ...(site.tags ?? [])]
                    .join(' ')
                    .toLocaleLowerCase()
                    .includes(term);
            })
            .sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                return a.order - b.order;
            });
    }, [activeInspirationCategoryId, inspirationSearch, inspirationState.sites]);

    const handleImportFiles = React.useCallback(
        async (files: readonly File[], source: 'file-picker' | 'drop' | 'current-source' | 'history') => {
            if (files.length === 0) return;
            const totalBytes = files.reduce((total, file) => total + file.size, 0);
            if (files.length > 100 || totalBytes > 500 * 1024 * 1024) {
                addNotice(t('assets.notice.largeImport'), 'warning');
            }
            const result = await importAssetFilesToLibrary(files, {
                source,
                categoryId: categoryFilter === 'all' ? DEFAULT_ASSET_LIBRARY_CATEGORY_ID : categoryFilter,
                skipDuplicates: true
            });
            if (result.added.length > 0) {
                addNotice(t('assets.notice.imported', { count: result.added.length }), 'success');
            }
            if (result.skippedDuplicates.length > 0) {
                addNotice(t('assets.notice.duplicatesSkipped', { count: result.skippedDuplicates.length }), 'info');
            }
            if (result.rejected.length > 0) {
                addNotice(t('assets.notice.rejected', { count: result.rejected.length }), 'warning');
            }
            refreshAssets();
        },
        [addNotice, categoryFilter, refreshAssets, t]
    );

    const handleUseAsset = React.useCallback(
        async (item: AssetLibraryItem) => {
            if (!isAssetLibraryImage(item)) {
                addNotice(t('assets.notice.imageOnlyUse'), 'warning');
                return;
            }
            const file = await getAssetLibraryFile(item);
            if (!file) {
                addNotice(t('assets.notice.missingBlob'), 'warning');
                return;
            }
            await markAssetLibraryItemUsed(item.id);
            onUseAssetFiles([file]);
            addNotice(t('assets.notice.sentToEdit'), 'success');
            refreshAssets();
        },
        [addNotice, onUseAssetFiles, refreshAssets, t]
    );

    const handleSaveMetadata = React.useCallback(async () => {
        if (!selectedAsset) return;
        await updateAssetLibraryItem(selectedAsset.id, {
            displayName: nameDraft,
            tags: tagDraft.split(','),
            note: noteDraft
        });
        addNotice(t('assets.notice.saved'), 'success');
        refreshAssets();
    }, [addNotice, nameDraft, noteDraft, refreshAssets, selectedAsset, t, tagDraft]);

    const handleCategoryChange = React.useCallback(
        async (categoryId: string) => {
            if (!selectedAsset) return;
            await updateAssetLibraryItem(selectedAsset.id, { categoryId });
            refreshAssets();
        },
        [refreshAssets, selectedAsset]
    );

    const handleToggleFavorite = React.useCallback(async () => {
        if (!selectedAsset) return;
        await updateAssetLibraryItem(selectedAsset.id, { favorite: !selectedAsset.favorite });
        refreshAssets();
    }, [refreshAssets, selectedAsset]);

    const handleDeleteSelected = React.useCallback(async () => {
        if (!deleteAssetId) return;
        await deleteAssetLibraryItems([deleteAssetId]);
        setDeleteAssetId(null);
        setSelectedAssetId(null);
        addNotice(t('assets.notice.deleted'), 'success');
        refreshAssets();
    }, [addNotice, deleteAssetId, refreshAssets, t]);

    const handleDownloadAsset = React.useCallback(async (item: AssetLibraryItem) => {
        const file = await getAssetLibraryFile(item);
        if (!file) return;
        const url = URL.createObjectURL(file);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = item.displayName || item.originalFilename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }, []);

    const handleExportAssetIndex = React.useCallback(() => {
        downloadJson('gpt-image-playground-asset-library-index.json', {
            version: 1,
            exportedAt: Date.now(),
            categories,
            items: items.map((item) => {
                const { blobKey, remoteKey, ...indexItem } = item;
                void blobKey;
                void remoteKey;
                return indexItem;
            })
        });
    }, [categories, items]);

    const handleImportAssetIndexFile = React.useCallback(
        async (file: File | null | undefined) => {
            if (!file) return;
            try {
                const result = await importAssetLibraryIndex(await readJsonFile(file));
                addNotice(
                    t('assets.notice.indexImported', {
                        count: result.itemsAdded + result.itemsUpdated,
                        categories: result.categoriesAdded + result.categoriesUpdated
                    }),
                    'success'
                );
                if (result.rejected > 0) {
                    addNotice(t('assets.notice.indexRejected', { count: result.rejected }), 'warning');
                }
                refreshAssets();
            } catch (error) {
                console.warn('Failed to import asset library index:', error);
                addNotice(t('assets.notice.invalidIndex'), 'warning');
            }
        },
        [addNotice, refreshAssets, t]
    );

    const handleCreateCategory = React.useCallback(() => {
        const category = saveCustomAssetLibraryCategory(customCategoryDraft);
        if (!category) return;
        setCustomCategoryDraft('');
        setCategories(loadAssetLibraryCategories());
        setCategoryFilter(category.id);
    }, [customCategoryDraft]);

    const updateSite = React.useCallback(
        (siteId: string, updates: Partial<InspirationSite>) => {
            saveInspirationState({
                ...inspirationState,
                sites: inspirationState.sites.map((site) =>
                    site.id === siteId ? { ...site, ...updates, updatedAt: Date.now() } : site
                )
            });
        },
        [inspirationState, saveInspirationState]
    );

    const handleOpenSite = React.useCallback(
        (site: InspirationSite) => {
            updateSite(site.id, { lastOpenedAt: Date.now() });
            setIframeSite(site);
            setIframeBusy(true);
            setIframeTimedOut(false);
            setIframeReloadKey((current) => current + 1);
        },
        [updateSite]
    );

    React.useEffect(() => {
        if (!iframeSite) return;
        const timer = window.setTimeout(() => {
            setIframeTimedOut(true);
            setIframeBusy(false);
        }, 8000);
        return () => window.clearTimeout(timer);
    }, [iframeReloadKey, iframeSite]);

    const storageTone =
        storageEstimate.ratio !== undefined && storageEstimate.ratio > 0.85
            ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200'
            : storageEstimate.ratio !== undefined && storageEstimate.ratio > 0.7
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200'
              : 'border-border bg-muted/40 text-muted-foreground';

    return (
        <>
            <Tabs
                value={activeTab}
                onValueChange={(value) => onActiveTabChange(value as WorkspacePanelTab)}
                className='h-full gap-0'>
                <div className='border-border bg-background/95 sticky top-0 z-10 border-b px-3 py-2 backdrop-blur'>
                    <TabsList className='grid w-full grid-cols-2 rounded-xl'>
                        <TabsTrigger value='assets' className='rounded-lg text-xs font-semibold gap-1.5'>
                            <Boxes className='h-3.5 w-3.5' />
                            {t('assets.tab.assets')}
                        </TabsTrigger>
                        <TabsTrigger value='inspiration' className='rounded-lg text-xs font-semibold gap-1.5'>
                            <Compass className='h-3.5 w-3.5' />
                            {t('assets.tab.inspiration')}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value='assets' className='m-0 min-h-0 overflow-y-auto overscroll-contain'>
                    <div className='space-y-4 p-3'>
                        {selectedAsset ? (
                            <div className='space-y-4 animate-in fade-in slide-in-from-right-3 duration-200'>
                                <div className='flex items-center justify-between border-b border-border/10 pb-3 mb-1'>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        className='rounded-xl font-bold gap-1.5 h-8.5 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-200 shadow-none'
                                        onClick={() => setSelectedAssetId(null)}>
                                        <ChevronLeft className='h-4 w-4' />
                                        {t('common.back')}
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='icon'
                                        className='h-8.5 w-8.5 rounded-xl hover:bg-accent/60 text-muted-foreground/60 hover:text-foreground transition-all duration-200'
                                        onClick={handleToggleFavorite}
                                        aria-label={t('assets.action.favorite')}>
                                        <Heart
                                            className={cn(
                                                'h-4 w-4 transition-transform duration-300 hover:scale-110',
                                                selectedAsset.favorite && 'fill-current text-red-500 hover:text-red-600'
                                            )}
                                        />
                                    </Button>
                                </div>
                                <section className='border-border/50 bg-muted/20 dark:bg-muted/5 space-y-4 rounded-2xl border p-4 shadow-sm'>
                                    <div className='flex items-start justify-between gap-2 border-b border-border/10 pb-3'>
                                        <div className='min-w-0'>
                                            <p className='text-xs font-bold uppercase tracking-wider text-muted-foreground/60'>{t('assets.details.title')}</p>
                                            <p className='text-foreground font-semibold truncate text-sm mt-1' data-i18n-skip='true'>
                                                {selectedAsset.originalFilename}
                                            </p>
                                        </div>
                                    </div>
                                    <div className='space-y-3.5'>
                                        <div className='space-y-1.5'>
                                            <Label htmlFor='workspace-asset-name' className='text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase px-0.5'>{t('assets.field.name')}</Label>
                                            <Input
                                                id='workspace-asset-name'
                                                value={nameDraft}
                                                onChange={(event) => setNameDraft(event.target.value)}
                                                className='rounded-xl border-border/60 focus-visible:ring-primary/20 h-9.5 text-sm font-medium'
                                            />
                                        </div>
                                        <div className='space-y-1.5'>
                                            <Label className='text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase px-0.5'>{t('assets.field.category')}</Label>
                                            <Select value={selectedAsset.categoryId} onValueChange={handleCategoryChange}>
                                                <SelectTrigger className='w-full rounded-xl border-border/60 h-9.5 text-xs font-medium'>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className='rounded-xl'>
                                                    {categories.map((category) => (
                                                        <SelectItem key={category.id} value={category.id} className='rounded-lg'>
                                                            {getCategoryLabel(category, t)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center'>
                                            <Input
                                                value={customCategoryDraft}
                                                onChange={(event) => setCustomCategoryDraft(event.target.value)}
                                                placeholder={t('assets.field.newCategory')}
                                                className='rounded-xl border-border/60 focus-visible:ring-primary/20 h-9 text-xs'
                                            />
                                            <Button type='button' variant='outline' size='sm' className='rounded-xl h-9 text-xs font-semibold gap-1 border-border/60' onClick={handleCreateCategory}>
                                                <Plus className='h-3.5 w-3.5' />
                                                {t('common.save')}
                                            </Button>
                                        </div>
                                        <div className='space-y-1.5'>
                                            <Label htmlFor='workspace-asset-tags' className='text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase px-0.5'>{t('assets.field.tags')}</Label>
                                            <Input
                                                id='workspace-asset-tags'
                                                value={tagDraft}
                                                onChange={(event) => setTagDraft(event.target.value)}
                                                placeholder={t('assets.field.tagsPlaceholder')}
                                                className='rounded-xl border-border/60 focus-visible:ring-primary/20 h-9.5 text-xs font-medium'
                                            />
                                        </div>
                                        <div className='space-y-1.5'>
                                            <Label htmlFor='workspace-asset-note' className='text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase px-0.5'>{t('assets.field.note')}</Label>
                                            <Textarea
                                                id='workspace-asset-note'
                                                value={noteDraft}
                                                onChange={(event) => setNoteDraft(event.target.value)}
                                                placeholder={t('assets.field.notePlaceholder')}
                                                className='rounded-xl border-border/60 focus-visible:ring-primary/20 min-h-20 text-xs font-medium p-3 resize-none'
                                            />
                                        </div>
                                        <div className='grid grid-cols-2 gap-2 text-xs bg-muted/15 dark:bg-muted/5 rounded-xl p-3 border border-border/10'>
                                            <div className='flex flex-col gap-0.5 min-w-0'>
                                                <span className='text-muted-foreground/60 text-[10px] font-bold uppercase tracking-wider'>{t('assets.meta.type')}</span>
                                                <span className='font-semibold text-foreground/80 truncate'>
                                                    {t(`assets.kind.${selectedAsset.kind === 'design-file' ? 'designFile' : selectedAsset.kind}`)}
                                                </span>
                                            </div>
                                            <div className='flex flex-col gap-0.5 min-w-0'>
                                                <span className='text-muted-foreground/60 text-[10px] font-bold uppercase tracking-wider'>{t('assets.meta.size')}</span>
                                                <span className='font-semibold text-foreground/80 truncate'>{formatAssetLibraryFileSize(selectedAsset.size)}</span>
                                            </div>
                                            <div className='flex flex-col gap-0.5 min-w-0 col-span-2 border-t border-border/10 pt-2 mt-1'>
                                                <span className='text-muted-foreground/60 text-[10px] font-bold uppercase tracking-wider'>{t('assets.meta.created')}</span>
                                                <span className='font-semibold text-foreground/80 truncate'>{formatDate(selectedAsset.createdAt, language)}</span>
                                            </div>
                                            <div className='flex flex-col gap-0.5 min-w-0 border-t border-border/10 pt-2 mt-1'>
                                                <span className='text-muted-foreground/60 text-[10px] font-bold uppercase tracking-wider'>{t('assets.meta.used')}</span>
                                                <span className='font-semibold text-foreground/80 truncate'>{selectedAsset.usageCount ?? 0}</span>
                                            </div>
                                        </div>
                                        <div className='flex flex-col gap-2 pt-2'>
                                            <Button
                                                type='button'
                                                className='w-full rounded-xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/10 hover:scale-[1.01] active:scale-95 transition-all duration-200 gap-2 h-10'
                                                onClick={() => void handleUseAsset(selectedAsset)}>
                                                <Send className='h-4 w-4' />
                                                {t('assets.action.sendToEdit')}
                                            </Button>
                                            <div className='grid grid-cols-3 gap-2'>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    className='rounded-xl border-border/60 hover:bg-accent/50 text-xs font-semibold'
                                                    onClick={handleSaveMetadata}>
                                                    {t('common.save')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    className='rounded-xl border-border/60 hover:bg-accent/50 text-xs font-semibold gap-1'
                                                    onClick={() => void handleDownloadAsset(selectedAsset)}>
                                                    <Download className='h-3.5 w-3.5' />
                                                    {t('assets.action.download')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    className='rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50/10 dark:hover:bg-red-500/10 text-xs font-semibold gap-1'
                                                    onClick={() => setDeleteAssetId(selectedAsset.id)}>
                                                    <Trash2 className='h-3.5 w-3.5' />
                                                    {t('assets.action.delete')}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        ) : (
                            <>
                                <div className={cn('rounded-xl border px-3 py-2.5 text-xs font-semibold tracking-wide shadow-sm backdrop-blur-sm', storageTone)}>
                                    {storageEstimate.usage !== undefined && storageEstimate.quota !== undefined
                                        ? t('assets.storage.estimate', {
                                              usage: formatAssetLibraryFileSize(storageEstimate.usage),
                                              quota: formatAssetLibraryFileSize(storageEstimate.quota)
                                          })
                                        : t('assets.storage.localMode')}
                                </div>
                                <div
                                    className={cn(
                                        'border-border/60 bg-muted/15 flex flex-col gap-3 rounded-2xl border border-dashed p-4 transition-all duration-300',
                                        isDraggingAssets ? 'border-primary bg-primary/5 shadow-inner' : 'hover:border-border/80 hover:bg-muted/25'
                                    )}
                                    onDragEnter={(event) => {
                                        event.preventDefault();
                                        setIsDraggingAssets(true);
                                    }}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDragEnterCapture={(event) => event.preventDefault()}
                                    onDragLeave={() => setIsDraggingAssets(false)}
                                    onDrop={(event) => {
                                        event.preventDefault();
                                        setIsDraggingAssets(false);
                                        void handleImportFiles(Array.from(event.dataTransfer.files), 'drop');
                                    }}>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <Button type='button' size='sm' className='rounded-xl font-semibold gap-1.5' onClick={() => fileInputRef.current?.click()}>
                                            <Upload className='h-4 w-4' />
                                            {t('assets.action.importFiles')}
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            className='rounded-xl font-semibold gap-1.5 border-border/60'
                                            disabled={currentSourceFiles.length === 0}
                                            onClick={() => void handleImportFiles(currentSourceFiles, 'current-source')}>
                                            <ImagePlus className='h-4 w-4' />
                                            {t('assets.action.saveCurrentSources')}
                                        </Button>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button type='button' variant='outline' size='sm' className='rounded-xl font-semibold gap-1 border-border/60'>
                                                    <MoreHorizontal className='h-4 w-4' />
                                                    {t('assets.action.manage')}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent align='start' className='w-56 p-1.5 rounded-xl border-border/40 bg-popover/85 backdrop-blur-md shadow-xl'>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    size='sm'
                                                    className='w-full justify-start rounded-lg text-xs font-semibold gap-1.5'
                                                    onClick={handleExportAssetIndex}>
                                                    <Download className='h-4 w-4' />
                                                    {t('assets.action.exportIndex')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    size='sm'
                                                    className='w-full justify-start rounded-lg text-xs font-semibold gap-1.5'
                                                    onClick={() => assetIndexInputRef.current?.click()}>
                                                    <Upload className='h-4 w-4' />
                                                    {t('assets.action.importIndex')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    size='sm'
                                                    className='w-full justify-start rounded-lg text-xs font-semibold gap-1.5'
                                                    onClick={() => onOpenDrawer('assets')}>
                                                    <ExternalLink className='h-4 w-4' />
                                                    {t('workspace.surface.openDrawer')}
                                                </Button>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <p className='text-muted-foreground/60 text-xs px-0.5'>{t('assets.dropHint')}</p>
                                    <input
                                        ref={fileInputRef}
                                        type='file'
                                        multiple
                                        className='hidden'
                                        onChange={(event) => {
                                            const files = Array.from(event.currentTarget.files ?? []);
                                            event.currentTarget.value = '';
                                            void handleImportFiles(files, 'file-picker');
                                        }}
                                    />
                                    <input
                                        ref={assetIndexInputRef}
                                        type='file'
                                        accept='application/json,.json'
                                        className='hidden'
                                        onChange={(event) => {
                                            const file = event.currentTarget.files?.[0];
                                            event.currentTarget.value = '';
                                            void handleImportAssetIndexFile(file);
                                        }}
                                    />
                                </div>
                                <div className='grid grid-cols-1 gap-2.5'>
                                    <div className='relative'>
                                        <Search className='text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                                        <Input
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                            className='pl-9 rounded-xl border-border/60 focus-visible:ring-primary/20 h-9.5 text-sm'
                                            placeholder={t('assets.search.placeholder')}
                                        />
                                    </div>
                                    <div className='grid grid-cols-2 gap-2'>
                                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                            <SelectTrigger className='w-full rounded-xl border-border/60 h-9.5 text-xs font-medium'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className='rounded-xl'>
                                                <SelectItem value='all' className='rounded-lg'>{t('assets.filter.allCategories')}</SelectItem>
                                                {categories.map((category) => (
                                                    <SelectItem key={category.id} value={category.id} className='rounded-lg'>
                                                        {getCategoryLabel(category, t)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select value={kindFilter} onValueChange={setKindFilter}>
                                            <SelectTrigger className='w-full rounded-xl border-border/60 h-9.5 text-xs font-medium'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className='rounded-xl'>
                                                <SelectItem value='all' className='rounded-lg'>{t('assets.filter.allTypes')}</SelectItem>
                                                <SelectItem value='image' className='rounded-lg'>{t('assets.kind.image')}</SelectItem>
                                                <SelectItem value='video' className='rounded-lg'>{t('assets.kind.video')}</SelectItem>
                                                <SelectItem value='design-file' className='rounded-lg'>{t('assets.kind.designFile')}</SelectItem>
                                                <SelectItem value='document' className='rounded-lg'>{t('assets.kind.document')}</SelectItem>
                                                <SelectItem value='archive' className='rounded-lg'>{t('assets.kind.archive')}</SelectItem>
                                                <SelectItem value='unknown' className='rounded-lg'>{t('assets.kind.unknown')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {filteredAssets.length === 0 ? (
                                    <div className='border-border/50 bg-muted/20 flex min-h-52 flex-col items-center justify-center rounded-2xl border px-4 text-center'>
                                        <FolderPlus className='text-muted-foreground/60 mb-3 h-8 w-8' />
                                        <p className='font-semibold text-sm'>{t('assets.empty.title')}</p>
                                        <p className='text-muted-foreground/75 mt-1 text-xs max-w-[200px] leading-relaxed'>{t('assets.empty.description')}</p>
                                    </div>
                                ) : (
                                    <div className='grid grid-cols-2 gap-3 xl:grid-cols-3'>
                                        {filteredAssets.map((item) => (
                                            <button
                                                key={item.id}
                                                type='button'
                                                className={cn(
                                                    'group text-left outline-none rounded-2xl p-1.5 bg-card/25 hover:bg-muted/15 border border-transparent hover:border-border/10 transition-all duration-300',
                                                    selectedAssetId === item.id &&
                                                        'bg-muted/30 border-primary/20 shadow-md shadow-primary/5 ring-1 ring-primary/20'
                                                )}
                                                onClick={() => setSelectedAssetId(item.id)}>
                                                <AssetThumbnail item={item} selected={selectedAssetId === item.id} />
                                                <div className='mt-2 px-1 min-w-0'>
                                                    <p className='truncate text-xs font-semibold text-foreground/90 group-hover:text-foreground transition-colors' data-i18n-skip='true'>
                                                        {item.displayName}
                                                    </p>
                                                    <p className='text-muted-foreground/60 truncate text-[10px] font-medium mt-0.5'>
                                                        {formatAssetLibraryFileSize(item.size)}
                                                        {item.favorite ? ` · ${t('assets.favorite.short')}` : ''}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value='inspiration' className='m-0 min-h-0 overflow-y-auto overscroll-contain'>
                    {iframeSite ? (
                        <div className='flex h-full min-h-[640px] flex-col'>
                            <div className='border-border/60 bg-background/95 flex shrink-0 flex-wrap items-center gap-2 border-b p-2.5 backdrop-blur'>
                                <Button type='button' variant='outline' size='sm' className='rounded-xl font-semibold' onClick={() => setIframeSite(null)}>
                                    {t('workspace.inspiration.backToSites')}
                                </Button>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    className='rounded-xl font-semibold gap-1.5 border-border/60'
                                    onClick={() => void openExternalUrl(iframeSite.url)}>
                                    <ExternalLink className='h-4 w-4' />
                                    {t('inspiration.action.openExternal')}
                                </Button>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    className='rounded-xl font-semibold gap-1.5 border-border/60'
                                    onClick={() => {
                                        setIframeBusy(true);
                                        setIframeTimedOut(false);
                                        setIframeReloadKey((current) => current + 1);
                                    }}>
                                    <RefreshCw className='h-4 w-4' />
                                    {t('inspiration.action.reload')}
                                </Button>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    className='rounded-xl font-semibold gap-1.5 border-border/60'
                                    onClick={() => void copyTextToClipboard(iframeSite.url)}>
                                    <LinkIcon className='h-4 w-4' />
                                    {t('inspiration.action.copyUrl')}
                                </Button>
                            </div>
                            <div className='relative min-h-0 flex-1'>
                                {(iframeBusy || iframeTimedOut) && (
                                    <div className='border-border/50 bg-background/95 absolute inset-x-3 top-3 z-10 rounded-xl border p-3.5 text-sm shadow-lg backdrop-blur-md'>
                                        <div className='flex items-start gap-2.5'>
                                            {iframeBusy ? (
                                                <RefreshCw className='text-muted-foreground/60 mt-0.5 h-4 w-4 animate-spin' />
                                            ) : (
                                                <X className='text-muted-foreground/60 mt-0.5 h-4 w-4' />
                                            )}
                                            <div>
                                                <p className='font-semibold'>
                                                    {iframeTimedOut
                                                        ? t('inspiration.iframe.timeoutTitle')
                                                        : t('inspiration.iframe.loadingTitle')}
                                                </p>
                                                <p className='text-muted-foreground/75 mt-1 text-xs leading-relaxed'>
                                                    {iframeTimedOut
                                                        ? t('inspiration.iframe.timeoutDescription')
                                                        : t('inspiration.iframe.loadingDescription')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <iframe
                                    key={`${iframeSite.id}-${iframeReloadKey}`}
                                    src={iframeSite.url}
                                    title={iframeSite.title}
                                    className='h-full min-h-[560px] w-full overscroll-contain border-0'
                                    sandbox='allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts'
                                    referrerPolicy='no-referrer-when-downgrade'
                                    onLoad={() => {
                                        setIframeBusy(false);
                                        setIframeTimedOut(false);
                                    }}
                                    onError={() => {
                                        setIframeBusy(false);
                                        setIframeTimedOut(true);
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className='space-y-4 p-3'>
                            <div className='flex flex-col gap-2.5'>
                                <div className='relative'>
                                    <Search className='text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                                    <Input
                                        value={inspirationSearch}
                                        onChange={(event) => setInspirationSearch(event.target.value)}
                                        className='pl-9 rounded-xl border-border/60 focus-visible:ring-primary/20 h-9.5 text-sm'
                                        placeholder={t('inspiration.search.placeholder')}
                                    />
                                </div>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    className='rounded-xl border-border/60 font-semibold gap-1.5 h-9 text-xs'
                                    onClick={() => onOpenDrawer('inspiration')}>
                                    <MoreHorizontal className='h-4 w-4' />
                                    {t('inspiration.action.manageSites')}
                                </Button>
                            </div>
                            <div className='flex gap-1.5 overflow-x-auto pb-2 scrollbar-none'>
                                <Button
                                    type='button'
                                    variant={activeInspirationCategoryId === 'all' ? 'secondary' : 'ghost'}
                                    className={cn(
                                        'shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-300 h-7.5',
                                        activeInspirationCategoryId === 'all'
                                            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                                            : 'bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground'
                                    )}
                                    onClick={() => setActiveInspirationCategoryId('all')}>
                                    {t('inspiration.category.all')}
                                </Button>
                                {inspirationCategories.map((category) => (
                                    <Button
                                        key={category.id}
                                        type='button'
                                        variant={activeInspirationCategoryId === category.id ? 'secondary' : 'ghost'}
                                        className={cn(
                                            'shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-300 h-7.5',
                                            activeInspirationCategoryId === category.id
                                                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                                                : 'bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground'
                                        )}
                                        onClick={() => setActiveInspirationCategoryId(category.id)}>
                                        {getCategoryLabel(category, t)}
                                    </Button>
                                ))}
                            </div>
                            {visibleSites.length === 0 ? (
                                <div className='border-border/50 bg-muted/20 flex min-h-52 flex-col items-center justify-center rounded-2xl border px-4 text-center'>
                                    <Compass className='text-muted-foreground/60 mb-3 h-8 w-8' />
                                    <p className='font-semibold text-sm'>{t('inspiration.empty.title')}</p>
                                    <p className='text-muted-foreground/75 mt-1 text-xs max-w-[200px] leading-relaxed'>
                                        {t('inspiration.empty.description')}
                                    </p>
                                </div>
                            ) : (
                                <div className='flex flex-col gap-2'>
                                    {visibleSites.map((site) => {
                                        const siteCategory = inspirationCategoryById.get(site.categoryId);
                                        const siteCategoryLabel = siteCategory
                                            ? getCategoryLabel(siteCategory, t)
                                            : site.categoryId;
                                        return (
                                            <div
                                                key={site.id}
                                                role='button'
                                                tabIndex={0}
                                                onClick={() => handleOpenSite(site)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        handleOpenSite(site);
                                                    }
                                                }}
                                                className='group relative flex items-center justify-between gap-3 bg-card/25 hover:bg-card/75 dark:bg-muted/3 dark:hover:bg-muted/12 border border-border/40 hover:border-primary/20 rounded-2xl p-2.5 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 select-none'>
                                                {(() => {
                                                    const initial = site.title ? site.title.trim().charAt(0).toUpperCase() : '?';
                                                    return (
                                                        <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary/10 to-primary/5 text-primary text-sm font-black border border-primary/10 group-hover:from-primary group-hover:to-primary/95 group-hover:text-primary-foreground group-hover:scale-105 group-hover:border-transparent transition-all duration-300 shadow-sm'>
                                                            {initial}
                                                        </span>
                                                    );
                                                })()}
                                                <div className='min-w-0 flex-1 flex flex-col justify-center text-left py-0.5'>
                                                    <div className='flex items-baseline gap-1.5 min-w-0'>
                                                        <h3 className='truncate text-sm font-bold text-foreground/90 group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-300' data-i18n-skip='true'>
                                                            {site.title}
                                                        </h3>
                                                        <span className='text-[10px] text-muted-foreground/45 font-medium tracking-wide uppercase group-hover:translate-x-0.5 transition-all duration-300 truncate hidden sm:inline' data-i18n-skip='true'>
                                                            {validateInspirationUrl(site.url) ? new URL(site.url).hostname : site.url}
                                                        </span>
                                                    </div>
                                                    <p className='text-muted-foreground/60 text-[10px] font-semibold tracking-wider uppercase mt-1 line-clamp-1 group-hover:translate-x-0.5 transition-all duration-300' data-i18n-skip='true'>
                                                        {siteCategoryLabel}
                                                        {site.tags.length > 0 ? ` · ${site.tags.join(', ')}` : ''}
                                                    </p>
                                                </div>
                                                <div className='flex items-center gap-1 shrink-0'>
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='icon'
                                                        className='h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground/60 hover:text-foreground transition-all duration-200'
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            updateSite(site.id, { pinned: !site.pinned });
                                                        }}
                                                        aria-label={t('inspiration.action.pin')}>
                                                        <Star
                                                            className={cn(
                                                                'h-3.5 w-3.5 transition-transform duration-300 hover:scale-110',
                                                                site.pinned && 'fill-current text-amber-500 hover:text-amber-600'
                                                            )}
                                                        />
                                                    </Button>
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='icon'
                                                        className='h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground/60 hover:text-foreground transition-all duration-200'
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void openExternalUrl(site.url);
                                                        }}
                                                        aria-label={t('inspiration.action.openExternal')}>
                                                        <ExternalLink className='h-3.5 w-3.5' />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {deleteAssetId && (
                <Dialog open={true} onOpenChange={(nextOpen) => !nextOpen && setDeleteAssetId(null)}>
                    <DialogContent className='max-w-md rounded-3xl p-6 border border-border/40 bg-popover/90 backdrop-blur-md shadow-2xl'>
                        <DialogHeader className='flex flex-col items-center text-center gap-4'>
                            <div className='flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 dark:bg-red-500/15 border border-red-500/20 text-red-500 animate-pulse shadow-inner shadow-red-500/5'>
                                <AlertTriangle className='h-5 w-5' />
                            </div>
                            <div className='space-y-1.5'>
                                <DialogTitle className='text-base font-bold tracking-tight text-foreground/90'>{t('assets.delete.title')}</DialogTitle>
                                <DialogDescription className='text-xs text-muted-foreground/80 font-medium leading-relaxed max-w-[280px] sm:max-w-none mx-auto'>
                                    {t('assets.delete.description')}
                                </DialogDescription>
                            </div>
                        </DialogHeader>
                        <DialogFooter className='flex flex-col-reverse sm:flex-row gap-2 mt-4 sm:justify-end'>
                            <Button
                                type='button'
                                variant='outline'
                                className='rounded-xl border-border/60 font-semibold text-xs h-9.5 min-w-[5rem]'
                                onClick={() => setDeleteAssetId(null)}>
                                {t('common.cancel')}
                            </Button>
                            <Button
                                type='button'
                                className='rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold text-xs h-9.5 gap-1 shadow-sm'
                                onClick={() => void handleDeleteSelected()}>
                                <Trash2 className='h-3.5 w-3.5' />
                                {t('assets.action.delete')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
