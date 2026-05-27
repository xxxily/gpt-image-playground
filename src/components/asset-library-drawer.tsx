'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerBody,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useNotice } from '@/components/notice-provider';
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
    createInspirationCategory,
    createInspirationSite,
    importInspirationSitesState,
    loadInspirationSitesState,
    restoreDefaultInspirationSites,
    saveInspirationSitesState,
    validateInspirationUrl
} from '@/lib/inspiration-sites';
import { cn } from '@/lib/utils';
import type { AssetLibraryCategory, AssetLibraryItem } from '@/types/asset-library';
import type { InspirationSite, InspirationSiteCategory, InspirationSitesState } from '@/types/inspiration-sites';
import {
    Archive,
    Boxes,
    Compass,
    Download,
    EyeOff,
    ExternalLink,
    FileImage,
    FolderPlus,
    Heart,
    ImagePlus,
    LinkIcon,
    MoreHorizontal,
    Pencil,
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

type AssetLibraryDrawerProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialTab?: 'assets' | 'inspiration';
    currentSourceFiles: readonly File[];
    onUseAssetFiles: (files: File[]) => void | boolean;
};

type StorageEstimateState = {
    usage?: number;
    quota?: number;
    ratio?: number;
};

function formatDate(value: number, language: string): string {
    return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function normalizeSearch(value: string): string {
    return value.trim().toLocaleLowerCase();
}

function getCategoryLabel(category: AssetLibraryCategory | InspirationSiteCategory, t: (key: string) => string): string {
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
                    'bg-muted text-muted-foreground flex aspect-square items-center justify-center rounded-md border',
                    selected && 'border-primary'
                )}>
                {item.kind === 'archive' ? <Archive className='h-6 w-6' /> : <FileImage className='h-6 w-6' />}
            </div>
        );
    }

    return (
        <div className={cn('bg-muted aspect-square overflow-hidden rounded-md border', selected && 'border-primary')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt='' className='h-full w-full object-cover' draggable={false} />
        </div>
    );
}

export function AssetLibraryDrawer({
    open,
    onOpenChange,
    initialTab = 'assets',
    currentSourceFiles,
    onUseAssetFiles
}: AssetLibraryDrawerProps) {
    const { t, language } = useAppLanguage();
    const { addNotice } = useNotice();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const assetIndexInputRef = React.useRef<HTMLInputElement>(null);
    const inspirationJsonInputRef = React.useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = React.useState<'assets' | 'inspiration'>(initialTab);
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

    const [inspirationState, setInspirationState] = React.useState<InspirationSitesState>(() => loadInspirationSitesState());
    const [inspirationSearch, setInspirationSearch] = React.useState('');
    const [activeInspirationCategoryId, setActiveInspirationCategoryId] = React.useState('all');
    const [siteTitleDraft, setSiteTitleDraft] = React.useState('');
    const [siteUrlDraft, setSiteUrlDraft] = React.useState('');
    const [siteTagsDraft, setSiteTagsDraft] = React.useState('');
    const [siteCategoryDraft, setSiteCategoryDraft] = React.useState('design');
    const [siteCategoryNameDraft, setSiteCategoryNameDraft] = React.useState('');
    const [editingSiteId, setEditingSiteId] = React.useState<string | null>(null);
    const [siteManagerOpen, setSiteManagerOpen] = React.useState(false);
    const [iframeSite, setIframeSite] = React.useState<InspirationSite | null>(null);
    const [iframeBusy, setIframeBusy] = React.useState(false);
    const [iframeTimedOut, setIframeTimedOut] = React.useState(false);

    React.useEffect(() => {
        if (open) setActiveTab(initialTab);
    }, [initialTab, open]);

    const refreshAssets = React.useCallback(() => {
        setCategories(loadAssetLibraryCategories());
        void listAssetLibraryItems().then(setItems);
        void estimateAssetLibraryStorage().then(setStorageEstimate);
    }, []);

    React.useEffect(() => {
        if (!open) return;
        refreshAssets();
        setInspirationState(loadInspirationSitesState());
    }, [open, refreshAssets]);

    React.useEffect(() => {
        const refresh = () => refreshAssets();
        window.addEventListener(ASSET_LIBRARY_CHANGED_EVENT, refresh);
        return () => window.removeEventListener(ASSET_LIBRARY_CHANGED_EVENT, refresh);
    }, [refreshAssets]);

    const selectedAsset = React.useMemo(
        () => items.find((item) => item.id === selectedAssetId) ?? items[0] ?? null,
        [items, selectedAssetId]
    );

    React.useEffect(() => {
        if (!selectedAsset) {
            setNameDraft('');
            setTagDraft('');
            setNoteDraft('');
            return;
        }
        setSelectedAssetId(selectedAsset.id);
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

    const managerSites = React.useMemo(
        () =>
            [...inspirationState.sites].sort((a, b) => {
                if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                if (a.categoryId !== b.categoryId) return a.categoryId.localeCompare(b.categoryId);
                return a.order - b.order;
            }),
        [inspirationState.sites]
    );

    const resetSiteDrafts = React.useCallback(() => {
        setEditingSiteId(null);
        setSiteTitleDraft('');
        setSiteUrlDraft('');
        setSiteTagsDraft('');
    }, []);

    const handleSaveSite = React.useCallback(() => {
        const safeUrl = validateInspirationUrl(siteUrlDraft);
        if (!siteTitleDraft.trim() || !safeUrl) {
            addNotice(t('inspiration.notice.invalidSite'), 'warning');
            return;
        }

        if (editingSiteId) {
            saveInspirationState({
                ...inspirationState,
                sites: inspirationState.sites.map((site) =>
                    site.id === editingSiteId
                        ? {
                              ...site,
                              title: siteTitleDraft.trim(),
                              url: safeUrl,
                              categoryId: siteCategoryDraft,
                              tags: siteTagsDraft
                                  .split(',')
                                  .map((tag) => tag.trim())
                                  .filter(Boolean),
                              updatedAt: Date.now()
                          }
                        : site
                )
            });
            resetSiteDrafts();
            setSiteManagerOpen(false);
            addNotice(t('inspiration.notice.siteSaved'), 'success');
            return;
        }

        const site = createInspirationSite({
            title: siteTitleDraft,
            url: safeUrl,
            categoryId: siteCategoryDraft,
            tags: siteTagsDraft.split(',')
        });
        if (!site) {
            addNotice(t('inspiration.notice.invalidSite'), 'warning');
            return;
        }
        saveInspirationState({ ...inspirationState, sites: [...inspirationState.sites, site] });
        resetSiteDrafts();
        setSiteManagerOpen(false);
        addNotice(t('inspiration.notice.siteAdded'), 'success');
    }, [
        addNotice,
        editingSiteId,
        inspirationState,
        resetSiteDrafts,
        saveInspirationState,
        siteCategoryDraft,
        siteTagsDraft,
        siteTitleDraft,
        siteUrlDraft,
        t
    ]);

    const handleEditSite = React.useCallback((site: InspirationSite) => {
        setEditingSiteId(site.id);
        setSiteTitleDraft(site.title);
        setSiteUrlDraft(site.url);
        setSiteTagsDraft(site.tags.join(', '));
        setSiteCategoryDraft(site.categoryId);
        setSiteManagerOpen(true);
    }, []);

    const handleOpenSiteManager = React.useCallback(() => {
        resetSiteDrafts();
        setSiteManagerOpen(true);
    }, [resetSiteDrafts]);

    const handleImportInspirationFile = React.useCallback(
        async (file: File | null | undefined) => {
            if (!file) return;
            try {
                const next = importInspirationSitesState(await readJsonFile(file), inspirationState);
                if (!next) {
                    addNotice(t('inspiration.notice.invalidImport'), 'warning');
                    return;
                }
                saveInspirationState(next);
                resetSiteDrafts();
                addNotice(t('inspiration.notice.imported'), 'success');
            } catch (error) {
                console.warn('Failed to import inspiration sites:', error);
                addNotice(t('inspiration.notice.invalidImport'), 'warning');
            }
        },
        [addNotice, inspirationState, resetSiteDrafts, saveInspirationState, t]
    );

    const handleRestoreDefaultInspiration = React.useCallback(() => {
        saveInspirationState(restoreDefaultInspirationSites(inspirationState));
        resetSiteDrafts();
        addNotice(t('inspiration.notice.defaultsRestored'), 'success');
    }, [addNotice, inspirationState, resetSiteDrafts, saveInspirationState, t]);

    const handleAddInspirationCategory = React.useCallback(() => {
        const category = createInspirationCategory(siteCategoryNameDraft, 1000 + inspirationState.categories.length);
        if (!category) return;
        saveInspirationState({ ...inspirationState, categories: [...inspirationState.categories, category] });
        setSiteCategoryNameDraft('');
        setSiteCategoryDraft(category.id);
    }, [inspirationState, saveInspirationState, siteCategoryNameDraft]);

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
        async (site: InspirationSite, mode: 'drawer' | 'external' = 'drawer') => {
            updateSite(site.id, { lastOpenedAt: Date.now() });
            if (mode === 'external' || site.defaultOpenMode !== 'drawer') {
                await openExternalUrl(site.url);
                return;
            }
            setIframeSite(site);
            setIframeBusy(true);
            setIframeTimedOut(false);
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
    }, [iframeSite]);

    const storageTone =
        storageEstimate.ratio !== undefined && storageEstimate.ratio > 0.85
            ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200'
            : storageEstimate.ratio !== undefined && storageEstimate.ratio > 0.7
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200'
              : 'border-border bg-muted/40 text-muted-foreground';

    return (
        <>
            <Drawer open={open} onOpenChange={onOpenChange} side='right' preferredWidth='min(980px,82vw)'>
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle>{t('assets.drawer.title')}</DrawerTitle>
                        <DrawerDescription>{t('assets.drawer.description')}</DrawerDescription>
                    </DrawerHeader>
                    <DrawerBody className='p-0'>
                        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'assets' | 'inspiration')} className='h-full gap-0'>
                            <div className='border-border bg-background/95 sticky top-0 z-10 border-b px-4 py-3 backdrop-blur sm:px-5'>
                                <TabsList className='w-full sm:w-auto'>
                                    <TabsTrigger value='assets' className='flex-1 sm:flex-none'>
                                        <Boxes className='h-4 w-4' />
                                        {t('assets.tab.assets')}
                                    </TabsTrigger>
                                    <TabsTrigger value='inspiration' className='flex-1 sm:flex-none'>
                                        <Compass className='h-4 w-4' />
                                        {t('assets.tab.inspiration')}
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value='assets' className='m-0 h-full'>
                                <div className='grid min-h-[calc(100dvh-11rem)] grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_22rem]'>
                                    <section className='border-border min-w-0 border-b p-4 lg:border-r lg:border-b-0 sm:p-5'>
                                        <div className={cn('mb-4 rounded-lg border px-3 py-2 text-xs', storageTone)}>
                                            {storageEstimate.usage !== undefined && storageEstimate.quota !== undefined
                                                ? t('assets.storage.estimate', {
                                                      usage: formatAssetLibraryFileSize(storageEstimate.usage),
                                                      quota: formatAssetLibraryFileSize(storageEstimate.quota)
                                                  })
                                                : t('assets.storage.localMode')}
                                        </div>
                                        <div
                                            className={cn(
                                                'border-border bg-muted/25 mb-4 flex flex-col gap-3 rounded-lg border border-dashed p-3',
                                                isDraggingAssets && 'border-primary bg-primary/5'
                                            )}
                                            onDragEnter={(event) => {
                                                event.preventDefault();
                                                setIsDraggingAssets(true);
                                            }}
                                            onDragOver={(event) => event.preventDefault()}
                                            onDragLeave={() => setIsDraggingAssets(false)}
                                            onDrop={(event) => {
                                                event.preventDefault();
                                                setIsDraggingAssets(false);
                                                void handleImportFiles(Array.from(event.dataTransfer.files), 'drop');
                                            }}>
                                            <div className='flex flex-wrap items-center gap-2'>
                                                <Button type='button' size='sm' onClick={() => fileInputRef.current?.click()}>
                                                    <Upload className='h-4 w-4' />
                                                    {t('assets.action.importFiles')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    size='sm'
                                                    disabled={currentSourceFiles.length === 0}
                                                    onClick={() => void handleImportFiles(currentSourceFiles, 'current-source')}>
                                                    <ImagePlus className='h-4 w-4' />
                                                    {t('assets.action.saveCurrentSources')}
                                                </Button>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button type='button' variant='outline' size='sm'>
                                                            <MoreHorizontal className='h-4 w-4' />
                                                            {t('assets.action.manage')}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent align='start' className='w-56 p-1.5'>
                                                        <Button
                                                            type='button'
                                                            variant='ghost'
                                                            size='sm'
                                                            className='w-full justify-start'
                                                            onClick={handleExportAssetIndex}>
                                                            <Download className='h-4 w-4' />
                                                            {t('assets.action.exportIndex')}
                                                        </Button>
                                                        <Button
                                                            type='button'
                                                            variant='ghost'
                                                            size='sm'
                                                            className='w-full justify-start'
                                                            onClick={() => assetIndexInputRef.current?.click()}>
                                                            <Upload className='h-4 w-4' />
                                                            {t('assets.action.importIndex')}
                                                        </Button>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <p className='text-muted-foreground text-xs'>{t('assets.dropHint')}</p>
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
                                        <div className='mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_8rem]'>
                                            <div className='relative'>
                                                <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                                                <Input
                                                    value={search}
                                                    onChange={(event) => setSearch(event.target.value)}
                                                    className='pl-9'
                                                    placeholder={t('assets.search.placeholder')}
                                                />
                                            </div>
                                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                                <SelectTrigger className='w-full'>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value='all'>{t('assets.filter.allCategories')}</SelectItem>
                                                    {categories.map((category) => (
                                                        <SelectItem key={category.id} value={category.id}>
                                                            {getCategoryLabel(category, t)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Select value={kindFilter} onValueChange={setKindFilter}>
                                                <SelectTrigger className='w-full'>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value='all'>{t('assets.filter.allTypes')}</SelectItem>
                                                    <SelectItem value='image'>{t('assets.kind.image')}</SelectItem>
                                                    <SelectItem value='video'>{t('assets.kind.video')}</SelectItem>
                                                    <SelectItem value='design-file'>{t('assets.kind.designFile')}</SelectItem>
                                                    <SelectItem value='document'>{t('assets.kind.document')}</SelectItem>
                                                    <SelectItem value='archive'>{t('assets.kind.archive')}</SelectItem>
                                                    <SelectItem value='unknown'>{t('assets.kind.unknown')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {filteredAssets.length === 0 ? (
                                            <div className='border-border bg-muted/20 flex min-h-56 flex-col items-center justify-center rounded-lg border text-center'>
                                                <FolderPlus className='text-muted-foreground mb-3 h-8 w-8' />
                                                <p className='font-medium'>{t('assets.empty.title')}</p>
                                                <p className='text-muted-foreground mt-1 max-w-sm text-sm'>{t('assets.empty.description')}</p>
                                            </div>
                                        ) : (
                                            <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4'>
                                                {filteredAssets.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        type='button'
                                                        className={cn(
                                                            'group text-left outline-none',
                                                            selectedAsset?.id === item.id && 'ring-primary rounded-lg ring-2 ring-offset-2 ring-offset-background'
                                                        )}
                                                        onClick={() => setSelectedAssetId(item.id)}>
                                                        <AssetThumbnail item={item} selected={selectedAsset?.id === item.id} />
                                                        <div className='mt-1 min-w-0'>
                                                            <p className='truncate text-sm font-medium' data-i18n-skip='true'>
                                                                {item.displayName}
                                                            </p>
                                                            <p className='text-muted-foreground truncate text-xs'>
                                                                {formatAssetLibraryFileSize(item.size)}
                                                                {item.favorite ? ` · ${t('assets.favorite.short')}` : ''}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                    <aside className='min-w-0 p-4 sm:p-5'>
                                        {selectedAsset ? (
                                            <div className='space-y-4'>
                                                <div className='flex items-start justify-between gap-2'>
                                                    <div className='min-w-0'>
                                                        <p className='text-sm font-semibold'>{t('assets.details.title')}</p>
                                                        <p className='text-muted-foreground truncate text-xs' data-i18n-skip='true'>
                                                            {selectedAsset.originalFilename}
                                                        </p>
                                                    </div>
                                                    <Button type='button' variant='ghost' size='icon' onClick={handleToggleFavorite} aria-label={t('assets.action.favorite')}>
                                                        <Heart className={cn('h-4 w-4', selectedAsset.favorite && 'fill-current text-red-500')} />
                                                    </Button>
                                                </div>
                                                <div className='space-y-2'>
                                                    <Label htmlFor='asset-name'>{t('assets.field.name')}</Label>
                                                    <Input id='asset-name' value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} />
                                                </div>
                                                <div className='space-y-2'>
                                                    <Label>{t('assets.field.category')}</Label>
                                                    <Select value={selectedAsset.categoryId} onValueChange={handleCategoryChange}>
                                                        <SelectTrigger className='w-full'>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {categories.map((category) => (
                                                                <SelectItem key={category.id} value={category.id}>
                                                                    {getCategoryLabel(category, t)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
                                                    <Input
                                                        value={customCategoryDraft}
                                                        onChange={(event) => setCustomCategoryDraft(event.target.value)}
                                                        placeholder={t('assets.field.newCategory')}
                                                    />
                                                    <Button type='button' variant='outline' size='sm' onClick={handleCreateCategory}>
                                                        <Plus className='h-4 w-4' />
                                                        {t('common.save')}
                                                    </Button>
                                                </div>
                                                <div className='space-y-2'>
                                                    <Label htmlFor='asset-tags'>{t('assets.field.tags')}</Label>
                                                    <Input
                                                        id='asset-tags'
                                                        value={tagDraft}
                                                        onChange={(event) => setTagDraft(event.target.value)}
                                                        placeholder={t('assets.field.tagsPlaceholder')}
                                                    />
                                                </div>
                                                <div className='space-y-2'>
                                                    <Label htmlFor='asset-note'>{t('assets.field.note')}</Label>
                                                    <Textarea
                                                        id='asset-note'
                                                        value={noteDraft}
                                                        onChange={(event) => setNoteDraft(event.target.value)}
                                                        placeholder={t('assets.field.notePlaceholder')}
                                                        className='min-h-20'
                                                    />
                                                </div>
                                                <dl className='text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-xs'>
                                                    <dt>{t('assets.meta.type')}</dt>
                                                    <dd>{t(`assets.kind.${selectedAsset.kind === 'design-file' ? 'designFile' : selectedAsset.kind}`)}</dd>
                                                    <dt>{t('assets.meta.size')}</dt>
                                                    <dd>{formatAssetLibraryFileSize(selectedAsset.size)}</dd>
                                                    <dt>{t('assets.meta.created')}</dt>
                                                    <dd>{formatDate(selectedAsset.createdAt, language)}</dd>
                                                    <dt>{t('assets.meta.used')}</dt>
                                                    <dd>{selectedAsset.usageCount ?? 0}</dd>
                                                </dl>
                                                <div className='grid grid-cols-2 gap-2'>
                                                    <Button type='button' onClick={() => void handleUseAsset(selectedAsset)}>
                                                        <Send className='h-4 w-4' />
                                                        {t('assets.action.sendToEdit')}
                                                    </Button>
                                                    <Button type='button' variant='outline' onClick={handleSaveMetadata}>
                                                        {t('common.save')}
                                                    </Button>
                                                    <Button type='button' variant='outline' onClick={() => void handleDownloadAsset(selectedAsset)}>
                                                        <Download className='h-4 w-4' />
                                                        {t('assets.action.download')}
                                                    </Button>
                                                    <Button type='button' variant='outline' onClick={() => setDeleteAssetId(selectedAsset.id)}>
                                                        <Trash2 className='h-4 w-4' />
                                                        {t('assets.action.delete')}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className='text-muted-foreground flex h-full min-h-56 items-center justify-center text-center text-sm'>
                                                {t('assets.details.empty')}
                                            </div>
                                        )}
                                    </aside>
                                </div>
                            </TabsContent>

                            <TabsContent value='inspiration' className='m-0 h-full'>
                                <div className='min-h-[calc(100dvh-11rem)] p-4 sm:p-5'>
                                    <div className='mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
                                        <div className='relative min-w-0 flex-1'>
                                            <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                                            <Input
                                                value={inspirationSearch}
                                                onChange={(event) => setInspirationSearch(event.target.value)}
                                                className='pl-9'
                                                placeholder={t('inspiration.search.placeholder')}
                                            />
                                        </div>
                                        <Button type='button' variant='outline' className='shrink-0' onClick={handleOpenSiteManager}>
                                            <MoreHorizontal className='h-4 w-4' />
                                            {t('inspiration.action.manageSites')}
                                        </Button>
                                    </div>
                                    <div className='grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]'>
                                        <aside className='min-w-0'>
                                            <div className='flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0'>
                                                <Button
                                                    type='button'
                                                    variant={activeInspirationCategoryId === 'all' ? 'secondary' : 'ghost'}
                                                    className='shrink-0 justify-start lg:w-full'
                                                    onClick={() => setActiveInspirationCategoryId('all')}>
                                                    {t('inspiration.category.all')}
                                                </Button>
                                                {inspirationCategories.map((category) => (
                                                    <Button
                                                        key={category.id}
                                                        type='button'
                                                        variant={activeInspirationCategoryId === category.id ? 'secondary' : 'ghost'}
                                                        className='shrink-0 justify-start lg:w-full'
                                                        onClick={() => setActiveInspirationCategoryId(category.id)}>
                                                        {getCategoryLabel(category, t)}
                                                    </Button>
                                                ))}
                                            </div>
                                        </aside>
                                        <section className='min-w-0'>
                                            {visibleSites.length === 0 ? (
                                                <div className='border-border bg-muted/20 flex min-h-56 flex-col items-center justify-center rounded-lg border text-center'>
                                                    <Compass className='text-muted-foreground mb-3 h-8 w-8' />
                                                    <p className='font-medium'>{t('inspiration.empty.title')}</p>
                                                    <p className='text-muted-foreground mt-1 max-w-sm text-sm'>
                                                        {t('inspiration.empty.description')}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className='grid gap-3 sm:grid-cols-2 2xl:grid-cols-3'>
                                                    {visibleSites.map((site) => {
                                                        const siteCategory = inspirationCategoryById.get(site.categoryId);
                                                        const siteCategoryLabel = siteCategory
                                                            ? getCategoryLabel(siteCategory, t)
                                                            : site.categoryId;
                                                        return (
                                                            <article
                                                                key={site.id}
                                                                className='border-border bg-card/60 flex min-h-36 flex-col rounded-lg border p-3'>
                                                                <div className='mb-3 flex items-start justify-between gap-2'>
                                                                    <div className='min-w-0'>
                                                                        <h3 className='truncate text-sm font-semibold' data-i18n-skip='true'>
                                                                            {site.title}
                                                                        </h3>
                                                                        <p className='text-muted-foreground truncate text-xs' data-i18n-skip='true'>
                                                                            {new URL(site.url).hostname}
                                                                        </p>
                                                                    </div>
                                                                    <Button
                                                                        type='button'
                                                                        variant='ghost'
                                                                        size='icon'
                                                                        className='h-8 w-8'
                                                                        onClick={() => updateSite(site.id, { pinned: !site.pinned })}
                                                                        aria-label={t('inspiration.action.pin')}>
                                                                        <Star className={cn('h-4 w-4', site.pinned && 'fill-current text-amber-500')} />
                                                                    </Button>
                                                                </div>
                                                                <p className='text-muted-foreground mb-3 line-clamp-2 min-h-8 text-xs'>
                                                                    {siteCategoryLabel}
                                                                    {site.tags.length > 0 ? ` · ${site.tags.join(', ')}` : ''}
                                                                </p>
                                                                <div className='mt-auto flex items-center gap-2'>
                                                                    <Button
                                                                        type='button'
                                                                        size='sm'
                                                                        className='min-w-0 flex-1'
                                                                        onClick={() => void handleOpenSite(site, 'drawer')}>
                                                                        <Compass className='h-4 w-4' />
                                                                        {t('inspiration.action.openDrawer')}
                                                                    </Button>
                                                                    <Button
                                                                        type='button'
                                                                        variant='outline'
                                                                        size='icon'
                                                                        className='h-9 w-9 shrink-0'
                                                                        onClick={() => void handleOpenSite(site, 'external')}
                                                                        aria-label={t('inspiration.action.openExternal')}>
                                                                        <ExternalLink className='h-4 w-4' />
                                                                    </Button>
                                                                </div>
                                                            </article>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </section>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </DrawerBody>
                </DrawerContent>
            </Drawer>

            <Drawer
                open={siteManagerOpen}
                onOpenChange={(nextOpen) => {
                    setSiteManagerOpen(nextOpen);
                    if (!nextOpen) resetSiteDrafts();
                }}
                side='right'
                preferredWidth='min(520px,92vw)'>
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle>{t('inspiration.manager.title')}</DrawerTitle>
                        <DrawerDescription>{t('inspiration.manager.description')}</DrawerDescription>
                    </DrawerHeader>
                    <DrawerBody>
                        <div className='space-y-6'>
                            <section className='space-y-4'>
                                <div>
                                    <h3 className='text-sm font-semibold'>
                                        {editingSiteId ? t('inspiration.edit.title') : t('inspiration.add.title')}
                                    </h3>
                                    <p className='text-muted-foreground mt-1 text-xs'>{t('inspiration.add.description')}</p>
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='site-title'>{t('inspiration.field.title')}</Label>
                                    <Input id='site-title' value={siteTitleDraft} onChange={(event) => setSiteTitleDraft(event.target.value)} />
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='site-url'>{t('inspiration.field.url')}</Label>
                                    <Input
                                        id='site-url'
                                        value={siteUrlDraft}
                                        onChange={(event) => setSiteUrlDraft(event.target.value)}
                                        placeholder='https://'
                                        aria-invalid={siteUrlDraft.trim() ? !validateInspirationUrl(siteUrlDraft) : undefined}
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <Label>{t('inspiration.field.category')}</Label>
                                    <Select value={siteCategoryDraft} onValueChange={setSiteCategoryDraft}>
                                        <SelectTrigger className='w-full'>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {inspirationCategories.map((category) => (
                                                <SelectItem key={category.id} value={category.id}>
                                                    {getCategoryLabel(category, t)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
                                    <Input
                                        value={siteCategoryNameDraft}
                                        onChange={(event) => setSiteCategoryNameDraft(event.target.value)}
                                        placeholder={t('inspiration.field.newCategory')}
                                    />
                                    <Button type='button' variant='outline' size='sm' onClick={handleAddInspirationCategory}>
                                        <Plus className='h-4 w-4' />
                                        {t('common.save')}
                                    </Button>
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='site-tags'>{t('inspiration.field.tags')}</Label>
                                    <Input
                                        id='site-tags'
                                        value={siteTagsDraft}
                                        onChange={(event) => setSiteTagsDraft(event.target.value)}
                                        placeholder={t('inspiration.field.tagsPlaceholder')}
                                    />
                                </div>
                                <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                                    <Button type='button' className='w-full' onClick={handleSaveSite}>
                                        <Plus className='h-4 w-4' />
                                        {editingSiteId ? t('common.save') : t('inspiration.action.addSite')}
                                    </Button>
                                    {editingSiteId && (
                                        <Button type='button' variant='outline' className='w-full' onClick={resetSiteDrafts}>
                                            {t('common.cancel')}
                                        </Button>
                                    )}
                                </div>
                            </section>

                            <section className='border-border border-t pt-4'>
                                <h3 className='mb-3 text-sm font-semibold'>{t('inspiration.manager.tools')}</h3>
                                <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        className='justify-start'
                                        onClick={() => downloadJson('gpt-image-playground-inspiration-sites.json', inspirationState)}>
                                        <Download className='h-4 w-4' />
                                        {t('inspiration.action.exportJson')}
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        className='justify-start'
                                        onClick={() => inspirationJsonInputRef.current?.click()}>
                                        <Upload className='h-4 w-4' />
                                        {t('inspiration.action.importJson')}
                                    </Button>
                                    <Button type='button' variant='ghost' className='justify-start sm:col-span-2' onClick={handleRestoreDefaultInspiration}>
                                        <RefreshCw className='h-4 w-4' />
                                        {t('inspiration.action.restoreDefaults')}
                                    </Button>
                                </div>
                                <input
                                    ref={inspirationJsonInputRef}
                                    type='file'
                                    accept='application/json,.json'
                                    className='hidden'
                                    onChange={(event) => {
                                        const file = event.currentTarget.files?.[0];
                                        event.currentTarget.value = '';
                                        void handleImportInspirationFile(file);
                                    }}
                                />
                            </section>

                            <section className='border-border border-t pt-4'>
                                <h3 className='mb-3 text-sm font-semibold'>{t('inspiration.manager.siteList')}</h3>
                                <div className='space-y-2'>
                                    {managerSites.map((site) => {
                                        const siteCategory = inspirationCategoryById.get(site.categoryId);
                                        const siteCategoryLabel = siteCategory ? getCategoryLabel(siteCategory, t) : site.categoryId;
                                        return (
                                            <div
                                                key={site.id}
                                                className={cn(
                                                    'border-border bg-card/50 flex items-center gap-2 rounded-lg border p-2',
                                                    !site.enabled && 'opacity-60'
                                                )}>
                                                <div className='min-w-0 flex-1'>
                                                    <p className='truncate text-sm font-medium' data-i18n-skip='true'>
                                                        {site.title}
                                                    </p>
                                                    <p className='text-muted-foreground truncate text-xs'>
                                                        {site.enabled ? siteCategoryLabel : t('inspiration.status.hidden')}
                                                    </p>
                                                </div>
                                                <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => handleEditSite(site)} aria-label={t('common.edit')}>
                                                    <Pencil className='h-4 w-4' />
                                                </Button>
                                                {site.enabled ? (
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='icon'
                                                        className='h-8 w-8'
                                                        onClick={() => updateSite(site.id, { enabled: false })}
                                                        aria-label={t('inspiration.action.hide')}>
                                                        <EyeOff className='h-4 w-4' />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='icon'
                                                        className='h-8 w-8'
                                                        onClick={() => updateSite(site.id, { enabled: true })}
                                                        aria-label={t('inspiration.action.restore')}>
                                                        <RefreshCw className='h-4 w-4' />
                                                    </Button>
                                                )}
                                                {!site.builtIn && (
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='icon'
                                                        className='h-8 w-8'
                                                        onClick={() =>
                                                            saveInspirationState({
                                                                ...inspirationState,
                                                                sites: inspirationState.sites.filter((item) => item.id !== site.id)
                                                            })
                                                        }
                                                        aria-label={t('assets.action.delete')}>
                                                        <Trash2 className='h-4 w-4' />
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                    </DrawerBody>
                </DrawerContent>
            </Drawer>

            <Drawer
                open={Boolean(iframeSite)}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) setIframeSite(null);
                }}
                side='right'
                preferredWidth='min(860px,70vw)'>
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle data-i18n-skip='true'>{iframeSite?.title ?? t('inspiration.browser.title')}</DrawerTitle>
                        <DrawerDescription data-i18n-skip='true'>{iframeSite?.url ?? ''}</DrawerDescription>
                        {iframeSite && (
                            <div className='mt-3 flex flex-wrap gap-2'>
                                <Button type='button' size='sm' variant='outline' onClick={() => void openExternalUrl(iframeSite.url)}>
                                    <ExternalLink className='h-4 w-4' />
                                    {t('inspiration.action.openExternal')}
                                </Button>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    onClick={() => {
                                        setIframeBusy(true);
                                        setIframeTimedOut(false);
                                    }}>
                                    <RefreshCw className='h-4 w-4' />
                                    {t('inspiration.action.reload')}
                                </Button>
                                <Button type='button' size='sm' variant='outline' onClick={() => void copyTextToClipboard(iframeSite.url)}>
                                    <LinkIcon className='h-4 w-4' />
                                    {t('inspiration.action.copyUrl')}
                                </Button>
                            </div>
                        )}
                    </DrawerHeader>
                    <DrawerBody className='p-0'>
                        {iframeSite && (
                            <div className='relative h-full min-h-[calc(100dvh-11rem)]'>
                                {(iframeBusy || iframeTimedOut) && (
                                    <div className='border-border bg-background/95 absolute inset-x-4 top-4 z-10 rounded-lg border p-3 text-sm shadow-lg'>
                                        <div className='flex items-start gap-2'>
                                            {iframeBusy ? (
                                                <RefreshCw className='text-muted-foreground mt-0.5 h-4 w-4 animate-spin' />
                                            ) : (
                                                <X className='text-muted-foreground mt-0.5 h-4 w-4' />
                                            )}
                                            <div>
                                                <p className='font-medium'>
                                                    {iframeTimedOut ? t('inspiration.iframe.timeoutTitle') : t('inspiration.iframe.loadingTitle')}
                                                </p>
                                                <p className='text-muted-foreground mt-1 text-xs'>
                                                    {iframeTimedOut ? t('inspiration.iframe.timeoutDescription') : t('inspiration.iframe.loadingDescription')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <iframe
                                    key={`${iframeSite.id}-${iframeBusy ? 'reload' : 'stable'}`}
                                    src={iframeSite.url}
                                    title={iframeSite.title}
                                    className='h-full min-h-[calc(100dvh-11rem)] w-full border-0'
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
                        )}
                    </DrawerBody>
                </DrawerContent>
            </Drawer>

            {deleteAssetId && (
                <Drawer open={true} onOpenChange={(nextOpen) => !nextOpen && setDeleteAssetId(null)} side='bottom'>
                    <DrawerContent>
                        <DrawerHeader>
                            <DrawerTitle>{t('assets.delete.title')}</DrawerTitle>
                            <DrawerDescription>{t('assets.delete.description')}</DrawerDescription>
                        </DrawerHeader>
                        <DrawerBody>
                            <div className='flex justify-end gap-2'>
                                <Button type='button' variant='outline' onClick={() => setDeleteAssetId(null)}>
                                    {t('common.cancel')}
                                </Button>
                                <Button type='button' variant='destructive' onClick={() => void handleDeleteSelected()}>
                                    {t('assets.action.delete')}
                                </Button>
                            </div>
                        </DrawerBody>
                    </DrawerContent>
                </Drawer>
            )}
        </>
    );
}
