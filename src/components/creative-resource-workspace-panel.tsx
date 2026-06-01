'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { InspirationSiteAvatar } from '@/components/inspiration-site-avatar';
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
import { ZoomViewer } from '@/components/zoom-viewer';
import { useAssetPreviewUrls } from '@/hooks/useAssetPreviewUrls';
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
    updateAssetLibraryItem,
    updateAssetLibraryItems
} from '@/lib/asset-library';
import { copyTextToClipboard, openExternalUrl } from '@/lib/desktop-runtime';
import {
    INSPIRATION_IFRAME_LOAD_TIMEOUT_MS,
    INSPIRATION_IFRAME_NOTICE_AUTO_DISMISS_MS
} from '@/lib/inspiration-iframe';
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
    LayoutGrid,
    List,
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
                    'bg-muted/40 text-muted-foreground/60 border-border/40 flex aspect-square items-center justify-center rounded-xl border',
                    selected && 'border-primary'
                )}>
                {item.kind === 'archive' ? <Archive className='h-6 w-6' /> : <FileImage className='h-6 w-6' />}
            </div>
        );
    }

    return (
        <div
            className={cn(
                'bg-muted/40 border-border/40 aspect-square overflow-hidden rounded-xl border',
                selected && 'border-primary'
            )}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={url}
                alt=''
                className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105'
                draggable={false}
            />
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
    const safeT = React.useCallback(
        (key: string, fallback: string, params?: Record<string, string | number>) => {
            const val = t(key, params);
            return val === key ? fallback : val;
        },
        [t]
    );
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
    const [iframeNoticeDismissed, setIframeNoticeDismissed] = React.useState(false);
    const [iframeReloadKey, setIframeReloadKey] = React.useState(0);

    const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
    const [selectedAssetIds, setSelectedAssetIds] = React.useState<Set<string>>(new Set());
    const [previewAssetIndex, setPreviewAssetIndex] = React.useState<number | null>(null);
    const [batchTagInput, setBatchTagInput] = React.useState('');
    const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = React.useState(false);

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

    const handleToggleFavoriteForItem = React.useCallback(
        async (item: AssetLibraryItem) => {
            await updateAssetLibraryItem(item.id, { favorite: !item.favorite });
            refreshAssets();
        },
        [refreshAssets]
    );

    // 大图预览画廊资产过滤
    const previewableAssets = React.useMemo(() => {
        return filteredAssets.filter((item) => isAssetLibraryImage(item));
    }, [filteredAssets]);

    const previewUrls = useAssetPreviewUrls(previewableAssets, previewAssetIndex);

    const zoomImages = React.useMemo(() => {
        return previewableAssets.map((asset) => ({
            src: previewUrls[asset.id] || '',
            filename: asset.displayName || asset.originalFilename,
            width: asset.width,
            height: asset.height,
            sizeBytes: asset.size
        }));
    }, [previewableAssets, previewUrls]);

    React.useEffect(() => {
        if (previewAssetIndex === null) return;
        if (previewAssetIndex < previewableAssets.length) return;
        setPreviewAssetIndex(previewableAssets.length > 0 ? previewableAssets.length - 1 : null);
    }, [previewAssetIndex, previewableAssets.length]);

    const filteredAssetIdSet = React.useMemo(() => new Set(filteredAssets.map((item) => item.id)), [filteredAssets]);
    const selectedFilteredAssetIds = React.useMemo(
        () => filteredAssets.filter((item) => selectedAssetIds.has(item.id)).map((item) => item.id),
        [filteredAssets, selectedAssetIds]
    );
    const selectedFilteredAssetCount = selectedFilteredAssetIds.length;
    const allFilteredAssetsSelected = filteredAssets.length > 0 && selectedFilteredAssetCount === filteredAssets.length;

    React.useEffect(() => {
        setSelectedAssetIds((prev) => {
            let changed = false;
            const next = new Set<string>();
            prev.forEach((id) => {
                if (filteredAssetIdSet.has(id)) {
                    next.add(id);
                } else {
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [filteredAssetIdSet]);

    // 多选和全选交互 hooks
    const handleToggleSelectAsset = React.useCallback((id: string) => {
        setSelectedAssetIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const handleToggleSelectAll = React.useCallback(() => {
        setSelectedAssetIds((prev) => {
            const next = new Set(prev);
            if (filteredAssets.length > 0 && filteredAssets.every((item) => next.has(item.id))) {
                filteredAssets.forEach((item) => next.delete(item.id));
                return next;
            }
            filteredAssets.forEach((item) => next.add(item.id));
            return next;
        });
    }, [filteredAssets]);

    // 批量操作业务逻辑
    const handleBatchMoveCategory = React.useCallback(
        async (categoryId: string) => {
            const ids = selectedFilteredAssetIds;
            if (ids.length === 0) return;

            const result = await updateAssetLibraryItems(ids, { categoryId });

            addNotice(
                safeT('assets.notice.batchMoved', `已将 ${result.updated} 个物料移动至目标分类`, {
                    count: result.updated
                }),
                'success'
            );
            setSelectedAssetIds(new Set());
        },
        [selectedFilteredAssetIds, addNotice, safeT]
    );

    const handleBatchAddTags = React.useCallback(async () => {
        const ids = selectedFilteredAssetIds;
        if (ids.length === 0) return;
        const inputTags = batchTagInput
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
        if (inputTags.length === 0) return;

        const result = await updateAssetLibraryItems(ids, (item) => ({
            tags: [...(item.tags || []), ...inputTags]
        }));

        addNotice(
            safeT('assets.notice.batchTagsAdded', `已为 ${result.updated} 个物料附加标签`, { count: result.updated }),
            'success'
        );
        setBatchTagInput('');
        setSelectedAssetIds(new Set());
    }, [selectedFilteredAssetIds, batchTagInput, addNotice, safeT]);

    const handleBatchDelete = React.useCallback(async () => {
        const ids = selectedFilteredAssetIds;
        if (ids.length === 0) return;

        await deleteAssetLibraryItems(ids);
        setIsBatchDeleteConfirmOpen(false);
        setSelectedAssetIds(new Set());

        if (selectedAssetId && ids.includes(selectedAssetId)) {
            setSelectedAssetId(null);
        }

        addNotice(
            safeT('assets.notice.batchDeleted', `已成功删除 ${ids.length} 个物料`, { count: ids.length }),
            'success'
        );
    }, [selectedFilteredAssetIds, selectedAssetId, addNotice, safeT]);

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
        async (site: InspirationSite) => {
            updateSite(site.id, { lastOpenedAt: Date.now() });
            if (site.defaultOpenMode !== 'drawer') {
                await openExternalUrl(site.url);
                return;
            }
            setIframeSite(site);
            setIframeBusy(true);
            setIframeTimedOut(false);
            setIframeNoticeDismissed(false);
            setIframeReloadKey((current) => current + 1);
        },
        [updateSite]
    );

    React.useEffect(() => {
        if (!iframeSite || !iframeBusy) return;
        const timer = window.setTimeout(() => {
            setIframeTimedOut(true);
            setIframeBusy(false);
            setIframeNoticeDismissed(false);
        }, INSPIRATION_IFRAME_LOAD_TIMEOUT_MS);
        return () => window.clearTimeout(timer);
    }, [iframeBusy, iframeReloadKey, iframeSite]);

    React.useEffect(() => {
        if ((!iframeBusy && !iframeTimedOut) || iframeNoticeDismissed) return;
        const timer = window.setTimeout(() => {
            setIframeNoticeDismissed(true);
        }, INSPIRATION_IFRAME_NOTICE_AUTO_DISMISS_MS);
        return () => window.clearTimeout(timer);
    }, [iframeBusy, iframeNoticeDismissed, iframeTimedOut]);

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
                        <TabsTrigger value='assets' className='gap-1.5 rounded-lg text-xs font-semibold'>
                            <Boxes className='h-3.5 w-3.5' />
                            {t('assets.tab.assets')}
                        </TabsTrigger>
                        <TabsTrigger value='inspiration' className='gap-1.5 rounded-lg text-xs font-semibold'>
                            <Compass className='h-3.5 w-3.5' />
                            {t('assets.tab.inspiration')}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value='assets' className='m-0 min-h-0 overflow-y-auto overscroll-contain'>
                    <div className='space-y-4 p-3'>
                        {selectedAsset ? (
                            <div className='animate-in fade-in slide-in-from-right-3 space-y-4 duration-200'>
                                <div className='border-border/10 mb-1 flex items-center justify-between border-b pb-3'>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        className='text-muted-foreground hover:text-foreground hover:bg-accent/60 h-8.5 gap-1.5 rounded-xl px-3 text-xs font-bold shadow-none transition-all duration-200'
                                        onClick={() => setSelectedAssetId(null)}>
                                        <ChevronLeft className='h-4 w-4' />
                                        {t('common.back')}
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='icon'
                                        className='hover:bg-accent/60 text-muted-foreground/60 hover:text-foreground h-8.5 w-8.5 rounded-xl transition-all duration-200'
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
                                    <div className='border-border/10 flex items-start justify-between gap-2 border-b pb-3'>
                                        <div className='min-w-0'>
                                            <p className='text-muted-foreground/60 text-xs font-bold tracking-wider uppercase'>
                                                {t('assets.details.title')}
                                            </p>
                                            <p
                                                className='text-foreground mt-1 truncate text-sm font-semibold'
                                                data-i18n-skip='true'>
                                                {selectedAsset.originalFilename}
                                            </p>
                                        </div>
                                    </div>
                                    <div className='space-y-3.5'>
                                        <div className='space-y-1.5'>
                                            <Label
                                                htmlFor='workspace-asset-name'
                                                className='text-muted-foreground/70 px-0.5 text-[10px] font-bold tracking-wider uppercase'>
                                                {t('assets.field.name')}
                                            </Label>
                                            <Input
                                                id='workspace-asset-name'
                                                value={nameDraft}
                                                onChange={(event) => setNameDraft(event.target.value)}
                                                className='border-border/60 focus-visible:ring-primary/20 h-9.5 rounded-xl text-sm font-medium'
                                            />
                                        </div>
                                        <div className='space-y-1.5'>
                                            <Label className='text-muted-foreground/70 px-0.5 text-[10px] font-bold tracking-wider uppercase'>
                                                {t('assets.field.category')}
                                            </Label>
                                            <Select
                                                value={selectedAsset.categoryId}
                                                onValueChange={handleCategoryChange}>
                                                <SelectTrigger className='border-border/60 h-9.5 w-full rounded-xl text-xs font-medium'>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className='rounded-xl'>
                                                    {categories.map((category) => (
                                                        <SelectItem
                                                            key={category.id}
                                                            value={category.id}
                                                            className='rounded-lg'>
                                                            {getCategoryLabel(category, t)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2'>
                                            <Input
                                                value={customCategoryDraft}
                                                onChange={(event) => setCustomCategoryDraft(event.target.value)}
                                                placeholder={t('assets.field.newCategory')}
                                                className='border-border/60 focus-visible:ring-primary/20 h-9 rounded-xl text-xs'
                                            />
                                            <Button
                                                type='button'
                                                variant='outline'
                                                size='sm'
                                                className='border-border/60 h-9 gap-1 rounded-xl text-xs font-semibold'
                                                onClick={handleCreateCategory}>
                                                <Plus className='h-3.5 w-3.5' />
                                                {t('common.save')}
                                            </Button>
                                        </div>
                                        <div className='space-y-1.5'>
                                            <Label
                                                htmlFor='workspace-asset-tags'
                                                className='text-muted-foreground/70 px-0.5 text-[10px] font-bold tracking-wider uppercase'>
                                                {t('assets.field.tags')}
                                            </Label>
                                            <Input
                                                id='workspace-asset-tags'
                                                value={tagDraft}
                                                onChange={(event) => setTagDraft(event.target.value)}
                                                placeholder={t('assets.field.tagsPlaceholder')}
                                                className='border-border/60 focus-visible:ring-primary/20 h-9.5 rounded-xl text-xs font-medium'
                                            />
                                        </div>
                                        <div className='space-y-1.5'>
                                            <Label
                                                htmlFor='workspace-asset-note'
                                                className='text-muted-foreground/70 px-0.5 text-[10px] font-bold tracking-wider uppercase'>
                                                {t('assets.field.note')}
                                            </Label>
                                            <Textarea
                                                id='workspace-asset-note'
                                                value={noteDraft}
                                                onChange={(event) => setNoteDraft(event.target.value)}
                                                placeholder={t('assets.field.notePlaceholder')}
                                                className='border-border/60 focus-visible:ring-primary/20 min-h-20 resize-none rounded-xl p-3 text-xs font-medium'
                                            />
                                        </div>
                                        <div className='bg-muted/15 dark:bg-muted/5 border-border/10 grid grid-cols-2 gap-2 rounded-xl border p-3 text-xs'>
                                            <div className='flex min-w-0 flex-col gap-0.5'>
                                                <span className='text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase'>
                                                    {t('assets.meta.type')}
                                                </span>
                                                <span className='text-foreground/80 truncate font-semibold'>
                                                    {t(
                                                        `assets.kind.${selectedAsset.kind === 'design-file' ? 'designFile' : selectedAsset.kind}`
                                                    )}
                                                </span>
                                            </div>
                                            <div className='flex min-w-0 flex-col gap-0.5'>
                                                <span className='text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase'>
                                                    {t('assets.meta.size')}
                                                </span>
                                                <span className='text-foreground/80 truncate font-semibold'>
                                                    {formatAssetLibraryFileSize(selectedAsset.size)}
                                                </span>
                                            </div>
                                            <div className='border-border/10 col-span-2 mt-1 flex min-w-0 flex-col gap-0.5 border-t pt-2'>
                                                <span className='text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase'>
                                                    {t('assets.meta.created')}
                                                </span>
                                                <span className='text-foreground/80 truncate font-semibold'>
                                                    {formatDate(selectedAsset.createdAt, language)}
                                                </span>
                                            </div>
                                            <div className='border-border/10 mt-1 flex min-w-0 flex-col gap-0.5 border-t pt-2'>
                                                <span className='text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase'>
                                                    {t('assets.meta.used')}
                                                </span>
                                                <span className='text-foreground/80 truncate font-semibold'>
                                                    {selectedAsset.usageCount ?? 0}
                                                </span>
                                            </div>
                                        </div>
                                        <div className='flex flex-col gap-2 pt-2'>
                                            <Button
                                                type='button'
                                                className='from-primary to-primary/90 text-primary-foreground shadow-primary/10 h-10 w-full gap-2 rounded-xl bg-gradient-to-r font-semibold shadow-md transition-all duration-200 hover:scale-[1.01] active:scale-95'
                                                onClick={() => void handleUseAsset(selectedAsset)}>
                                                <Send className='h-4 w-4' />
                                                {t('assets.action.sendToEdit')}
                                            </Button>
                                            <div className='grid grid-cols-3 gap-2'>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    className='border-border/60 hover:bg-accent/50 rounded-xl text-xs font-semibold'
                                                    onClick={handleSaveMetadata}>
                                                    {t('common.save')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    className='border-border/60 hover:bg-accent/50 gap-1 rounded-xl text-xs font-semibold'
                                                    onClick={() => void handleDownloadAsset(selectedAsset)}>
                                                    <Download className='h-3.5 w-3.5' />
                                                    {t('assets.action.download')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    className='gap-1 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50/10 hover:text-red-600 dark:hover:bg-red-500/10'
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
                                <div
                                    className={cn(
                                        'rounded-xl border px-3 py-2.5 text-xs font-semibold tracking-wide shadow-sm backdrop-blur-sm',
                                        storageTone
                                    )}>
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
                                        isDraggingAssets
                                            ? 'border-primary bg-primary/5 shadow-inner'
                                            : 'hover:border-border/80 hover:bg-muted/25'
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
                                        <Button
                                            type='button'
                                            size='sm'
                                            className='gap-1.5 rounded-xl font-semibold'
                                            onClick={() => fileInputRef.current?.click()}>
                                            <Upload className='h-4 w-4' />
                                            {t('assets.action.importFiles')}
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            className='border-border/60 gap-1.5 rounded-xl font-semibold'
                                            disabled={currentSourceFiles.length === 0}
                                            onClick={() =>
                                                void handleImportFiles(currentSourceFiles, 'current-source')
                                            }>
                                            <ImagePlus className='h-4 w-4' />
                                            {t('assets.action.saveCurrentSources')}
                                        </Button>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    size='sm'
                                                    className='border-border/60 gap-1 rounded-xl font-semibold'>
                                                    <MoreHorizontal className='h-4 w-4' />
                                                    {t('assets.action.manage')}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                align='start'
                                                className='border-border/40 bg-popover/85 w-56 rounded-xl p-1.5 shadow-xl backdrop-blur-md'>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    size='sm'
                                                    className='w-full justify-start gap-1.5 rounded-lg text-xs font-semibold'
                                                    onClick={handleExportAssetIndex}>
                                                    <Download className='h-4 w-4' />
                                                    {t('assets.action.exportIndex')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    size='sm'
                                                    className='w-full justify-start gap-1.5 rounded-lg text-xs font-semibold'
                                                    onClick={() => assetIndexInputRef.current?.click()}>
                                                    <Upload className='h-4 w-4' />
                                                    {t('assets.action.importIndex')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    size='sm'
                                                    className='w-full justify-start gap-1.5 rounded-lg text-xs font-semibold'
                                                    onClick={() => onOpenDrawer('assets')}>
                                                    <ExternalLink className='h-4 w-4' />
                                                    {t('workspace.surface.openDrawer')}
                                                </Button>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <p className='text-muted-foreground/60 px-0.5 text-xs'>{t('assets.dropHint')}</p>
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
                                            className='border-border/60 focus-visible:ring-primary/20 h-9.5 rounded-xl pl-9 text-sm'
                                            placeholder={t('assets.search.placeholder')}
                                        />
                                    </div>
                                    <div className='grid grid-cols-2 gap-2'>
                                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                            <SelectTrigger className='border-border/60 h-9.5 w-full rounded-xl text-xs font-medium'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className='rounded-xl'>
                                                <SelectItem value='all' className='rounded-lg'>
                                                    {t('assets.filter.allCategories')}
                                                </SelectItem>
                                                {categories.map((category) => (
                                                    <SelectItem
                                                        key={category.id}
                                                        value={category.id}
                                                        className='rounded-lg'>
                                                        {getCategoryLabel(category, t)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select value={kindFilter} onValueChange={setKindFilter}>
                                            <SelectTrigger className='border-border/60 h-9.5 w-full rounded-xl text-xs font-medium'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className='rounded-xl'>
                                                <SelectItem value='all' className='rounded-lg'>
                                                    {t('assets.filter.allTypes')}
                                                </SelectItem>
                                                <SelectItem value='image' className='rounded-lg'>
                                                    {t('assets.kind.image')}
                                                </SelectItem>
                                                <SelectItem value='video' className='rounded-lg'>
                                                    {t('assets.kind.video')}
                                                </SelectItem>
                                                <SelectItem value='design-file' className='rounded-lg'>
                                                    {t('assets.kind.designFile')}
                                                </SelectItem>
                                                <SelectItem value='document' className='rounded-lg'>
                                                    {t('assets.kind.document')}
                                                </SelectItem>
                                                <SelectItem value='archive' className='rounded-lg'>
                                                    {t('assets.kind.archive')}
                                                </SelectItem>
                                                <SelectItem value='unknown' className='rounded-lg'>
                                                    {t('assets.kind.unknown')}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className='mt-1 flex items-center justify-between gap-2'>
                                        <div className='bg-muted/40 border-border/20 flex items-center gap-1 rounded-lg border p-0.5'>
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='icon'
                                                className={cn(
                                                    'h-7 w-7 rounded-md p-0 transition-all',
                                                    viewMode === 'grid'
                                                        ? 'bg-background text-foreground shadow-sm'
                                                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/20'
                                                )}
                                                onClick={() => setViewMode('grid')}
                                                title={t('assets.view.grid') || '网格视图'}>
                                                <LayoutGrid className='h-3.5 w-3.5' />
                                            </Button>
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='icon'
                                                className={cn(
                                                    'h-7 w-7 rounded-md p-0 transition-all',
                                                    viewMode === 'list'
                                                        ? 'bg-background text-foreground shadow-sm'
                                                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/20'
                                                )}
                                                onClick={() => setViewMode('list')}
                                                title={t('assets.view.list') || '列表视图'}>
                                                <List className='h-3.5 w-3.5' />
                                            </Button>
                                        </div>

                                        {filteredAssets.length > 0 && (
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='sm'
                                                className='text-muted-foreground hover:text-foreground hover:bg-accent/40 h-7 rounded-lg px-2.5 text-[10px] font-bold shadow-none transition-all'
                                                onClick={handleToggleSelectAll}>
                                                {allFilteredAssetsSelected
                                                    ? safeT('assets.select.none', '取消全选')
                                                    : safeT('assets.select.all', '全选')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                {filteredAssets.length === 0 ? (
                                    <div className='border-border/50 bg-muted/20 flex min-h-52 flex-col items-center justify-center rounded-2xl border px-4 text-center'>
                                        <FolderPlus className='text-muted-foreground/60 mb-3 h-8 w-8' />
                                        <p className='text-sm font-semibold'>{t('assets.empty.title')}</p>
                                        <p className='text-muted-foreground/75 mt-1 max-w-[200px] text-xs leading-relaxed'>
                                            {t('assets.empty.description')}
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {viewMode === 'grid' ? (
                                            <div className='grid grid-cols-2 gap-3 xl:grid-cols-3'>
                                                {filteredAssets.map((item) => {
                                                    const isSelected = selectedAssetIds.has(item.id);
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className={cn(
                                                                'group bg-card/25 hover:bg-muted/15 hover:border-border/10 relative rounded-2xl border border-transparent p-1.5 text-left transition-all duration-300',
                                                                selectedAssetId === item.id &&
                                                                    'bg-muted/30 border-primary/20 shadow-primary/5 ring-primary/20 shadow-md ring-1'
                                                            )}>
                                                            {/* Checkbox 多选 */}
                                                            <div
                                                                className={cn(
                                                                    'pointer-events-auto absolute top-2.5 left-2.5 z-20 transition-opacity duration-200',
                                                                    selectedFilteredAssetCount > 0
                                                                        ? 'opacity-100'
                                                                        : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                                                                )}>
                                                                <input
                                                                    type='checkbox'
                                                                    className='border-border/80 text-primary focus:ring-primary/20 bg-background/80 accent-primary h-4 w-4 cursor-pointer rounded-md'
                                                                    checked={isSelected}
                                                                    onChange={(e) => {
                                                                        e.stopPropagation();
                                                                        handleToggleSelectAsset(item.id);
                                                                    }}
                                                                />
                                                            </div>

                                                            {/* 图片及快捷操作区域 */}
                                                            <div
                                                                className='relative cursor-pointer overflow-hidden rounded-xl'
                                                                onClick={() => {
                                                                    const idx = previewableAssets.findIndex(
                                                                        (x) => x.id === item.id
                                                                    );
                                                                    if (idx !== -1) {
                                                                        setPreviewAssetIndex(idx);
                                                                    } else {
                                                                        setSelectedAssetId(item.id);
                                                                    }
                                                                }}>
                                                                <AssetThumbnail
                                                                    item={item}
                                                                    selected={selectedAssetId === item.id}
                                                                />

                                                                {/* Hover 操作面板 */}
                                                                <div className='pointer-events-none absolute inset-0 z-10 flex flex-col justify-between rounded-xl bg-black/45 p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100'>
                                                                    <div className='flex justify-end'>
                                                                        <Button
                                                                            type='button'
                                                                            variant='ghost'
                                                                            size='icon'
                                                                            className={cn(
                                                                                'pointer-events-auto h-7 w-7 rounded-lg border border-white/10 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-all hover:bg-black/75',
                                                                                item.favorite &&
                                                                                    'text-red-500 hover:text-red-600'
                                                                            )}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                void handleToggleFavoriteForItem(item);
                                                                            }}
                                                                            title={t('assets.action.favorite')}>
                                                                            <Heart
                                                                                className={cn(
                                                                                    'h-3.5 w-3.5',
                                                                                    item.favorite && 'fill-current'
                                                                                )}
                                                                            />
                                                                        </Button>
                                                                    </div>
                                                                    <div className='flex items-center justify-center gap-1'>
                                                                        {isAssetLibraryImage(item) && (
                                                                            <Button
                                                                                type='button'
                                                                                variant='ghost'
                                                                                size='icon'
                                                                                className='pointer-events-auto h-7 w-7 rounded-lg border border-white/10 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-all hover:bg-violet-600'
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    void handleUseAsset(item);
                                                                                }}
                                                                                title={t('assets.action.sendToEdit')}>
                                                                                <Send className='h-3.5 w-3.5' />
                                                                            </Button>
                                                                        )}
                                                                        <Button
                                                                            type='button'
                                                                            variant='ghost'
                                                                            size='icon'
                                                                            className='pointer-events-auto h-7 w-7 rounded-lg border border-white/10 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-all hover:bg-black/75'
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                void handleDownloadAsset(item);
                                                                            }}
                                                                            title={t('assets.action.download')}>
                                                                            <Download className='h-3.5 w-3.5' />
                                                                        </Button>
                                                                        <Button
                                                                            type='button'
                                                                            variant='ghost'
                                                                            size='icon'
                                                                            className='pointer-events-auto h-7 w-7 rounded-lg border border-white/10 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-all hover:bg-black/75'
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setSelectedAssetId(item.id);
                                                                            }}
                                                                            title={t('common.edit') || '编辑'}>
                                                                            <Pencil className='h-3.5 w-3.5' />
                                                                        </Button>
                                                                        <Button
                                                                            type='button'
                                                                            variant='ghost'
                                                                            size='icon'
                                                                            className='hover:bg-red-650 pointer-events-auto h-7 w-7 rounded-lg border border-white/10 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-all hover:text-white'
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setDeleteAssetId(item.id);
                                                                            }}
                                                                            title={t('assets.action.delete')}>
                                                                            <Trash2 className='h-3.5 w-3.5' />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* 底部 DisplayName 等 */}
                                                            <div className='mt-2 min-w-0 px-1'>
                                                                <p
                                                                    className='text-foreground/90 group-hover:text-foreground truncate text-xs font-semibold transition-colors'
                                                                    data-i18n-skip='true'>
                                                                    {item.displayName}
                                                                </p>
                                                                <p className='text-muted-foreground/60 mt-0.5 truncate text-[10px] font-medium'>
                                                                    {formatAssetLibraryFileSize(item.size)}
                                                                    {item.favorite
                                                                        ? ` · ${t('assets.favorite.short')}`
                                                                        : ''}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className='border-border/20 bg-card/10 overflow-hidden rounded-2xl border shadow-sm'>
                                                <table className='w-full border-collapse text-left text-xs'>
                                                    <thead>
                                                        <tr className='border-border/20 bg-muted/20 text-muted-foreground border-b text-[10px] font-bold tracking-wider uppercase select-none'>
                                                            <th className='w-8 p-3 text-center'>
                                                                <input
                                                                    type='checkbox'
                                                                    className='border-border/80 text-primary accent-primary h-3.5 w-3.5 cursor-pointer rounded'
                                                                    checked={allFilteredAssetsSelected}
                                                                    onChange={handleToggleSelectAll}
                                                                />
                                                            </th>
                                                            <th className='w-12 p-3'>
                                                                {t('assets.list.preview') || '预览'}
                                                            </th>
                                                            <th className='p-3 font-semibold'>
                                                                {t('assets.list.name') || '名称'}
                                                            </th>
                                                            <th className='hidden p-3 font-semibold sm:table-cell'>
                                                                {t('assets.list.category') || '分类'}
                                                            </th>
                                                            <th className='hidden p-3 font-semibold md:table-cell'>
                                                                {t('assets.list.size') || '大小'}
                                                            </th>
                                                            <th className='p-3 text-right font-semibold'>
                                                                {t('assets.list.actions') || '操作'}
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className='divide-border/10 divide-y'>
                                                        {filteredAssets.map((item) => {
                                                            const isSelected = selectedAssetIds.has(item.id);
                                                            return (
                                                                <tr
                                                                    key={item.id}
                                                                    className={cn(
                                                                        'group hover:bg-muted/10 cursor-pointer transition-colors',
                                                                        isSelected && 'bg-primary/5 hover:bg-primary/10'
                                                                    )}
                                                                    onClick={() => {
                                                                        const idx = previewableAssets.findIndex(
                                                                            (x) => x.id === item.id
                                                                        );
                                                                        if (idx !== -1) {
                                                                            setPreviewAssetIndex(idx);
                                                                        } else {
                                                                            setSelectedAssetId(item.id);
                                                                        }
                                                                    }}>
                                                                    <td
                                                                        className='p-3 text-center'
                                                                        onClick={(e) => e.stopPropagation()}>
                                                                        <input
                                                                            type='checkbox'
                                                                            className='border-border/80 text-primary accent-primary h-3.5 w-3.5 cursor-pointer rounded'
                                                                            checked={isSelected}
                                                                            onChange={() =>
                                                                                handleToggleSelectAsset(item.id)
                                                                            }
                                                                        />
                                                                    </td>
                                                                    <td className='p-2'>
                                                                        <div className='border-border/30 bg-muted/40 relative h-8 w-8 overflow-hidden rounded-lg border'>
                                                                            <AssetThumbnail
                                                                                item={item}
                                                                                selected={false}
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                    <td className='min-w-0 p-3 font-medium'>
                                                                        <p
                                                                            className='text-foreground/90 max-w-[120px] truncate font-bold sm:max-w-[200px]'
                                                                            data-i18n-skip='true'>
                                                                            {item.displayName}
                                                                        </p>
                                                                        <p className='text-muted-foreground/60 mt-0.5 text-[10px] sm:hidden'>
                                                                            {formatAssetLibraryFileSize(item.size)}
                                                                        </p>
                                                                    </td>
                                                                    <td className='text-muted-foreground/80 hidden p-3 font-medium sm:table-cell'>
                                                                        <span className='bg-accent/60 text-foreground/80 border-border/20 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold'>
                                                                            {categoryById.get(item.categoryId)
                                                                                ? getCategoryLabel(
                                                                                      categoryById.get(
                                                                                          item.categoryId
                                                                                      )!,
                                                                                      t
                                                                                  )
                                                                                : item.categoryId}
                                                                        </span>
                                                                    </td>
                                                                    <td className='text-muted-foreground/80 hidden p-3 font-medium md:table-cell'>
                                                                        {formatAssetLibraryFileSize(item.size)}
                                                                    </td>
                                                                    <td
                                                                        className='p-2 text-right'
                                                                        onClick={(e) => e.stopPropagation()}>
                                                                        <div className='inline-flex items-center gap-1'>
                                                                            <Button
                                                                                type='button'
                                                                                variant='ghost'
                                                                                size='icon'
                                                                                className={cn(
                                                                                    'text-muted-foreground/60 hover:text-foreground hover:bg-accent/40 h-7 w-7 rounded-lg',
                                                                                    item.favorite &&
                                                                                        'text-red-500 hover:text-red-600'
                                                                                )}
                                                                                onClick={() =>
                                                                                    void handleToggleFavoriteForItem(
                                                                                        item
                                                                                    )
                                                                                }
                                                                                title={t('assets.action.favorite')}>
                                                                                <Heart
                                                                                    className={cn(
                                                                                        'h-3.5 w-3.5',
                                                                                        item.favorite && 'fill-current'
                                                                                    )}
                                                                                />
                                                                            </Button>
                                                                            {isAssetLibraryImage(item) && (
                                                                                <Button
                                                                                    type='button'
                                                                                    variant='ghost'
                                                                                    size='icon'
                                                                                    className='text-muted-foreground/60 hover:text-foreground hover:bg-accent/40 h-7 w-7 rounded-lg'
                                                                                    onClick={() =>
                                                                                        void handleUseAsset(item)
                                                                                    }
                                                                                    title={t(
                                                                                        'assets.action.sendToEdit'
                                                                                    )}>
                                                                                    <Send className='h-3.5 w-3.5' />
                                                                                </Button>
                                                                            )}
                                                                            <Button
                                                                                type='button'
                                                                                variant='ghost'
                                                                                size='icon'
                                                                                className='text-muted-foreground/60 hover:text-foreground hover:bg-accent/40 h-7 w-7 rounded-lg'
                                                                                onClick={() =>
                                                                                    void handleDownloadAsset(item)
                                                                                }
                                                                                title={t('assets.action.download')}>
                                                                                <Download className='h-3.5 w-3.5' />
                                                                            </Button>
                                                                            <Button
                                                                                type='button'
                                                                                variant='ghost'
                                                                                size='icon'
                                                                                className='text-muted-foreground/60 hover:text-foreground hover:bg-accent/40 h-7 w-7 rounded-lg'
                                                                                onClick={() =>
                                                                                    setSelectedAssetId(item.id)
                                                                                }
                                                                                title={t('common.edit') || '编辑'}>
                                                                                <Pencil className='h-3.5 w-3.5' />
                                                                            </Button>
                                                                            <Button
                                                                                type='button'
                                                                                variant='ghost'
                                                                                size='icon'
                                                                                className='h-7 w-7 rounded-lg text-red-500 hover:bg-red-50/10 hover:text-red-600 dark:hover:bg-red-500/10'
                                                                                onClick={() =>
                                                                                    setDeleteAssetId(item.id)
                                                                                }
                                                                                title={t('assets.action.delete')}>
                                                                                <Trash2 className='h-3.5 w-3.5' />
                                                                            </Button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {/* 批量操作悬浮条 */}
                                        {selectedFilteredAssetCount > 0 && (
                                            <div className='bg-background/80 dark:bg-muted/30 border-primary/20 animate-in fade-in slide-in-from-bottom-3 fixed bottom-5 left-1/2 z-40 flex w-[min(90%,26rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 shadow-2xl backdrop-blur-xl duration-300 dark:border-white/10'>
                                                <div className='flex min-w-0 flex-col'>
                                                    <span className='text-muted-foreground text-[10px] font-bold tracking-wider uppercase'>
                                                        {safeT('assets.batch.selected', '已选择')}
                                                    </span>
                                                    <span className='text-foreground mt-0.5 text-xs font-black tabular-nums'>
                                                        {selectedFilteredAssetCount}{' '}
                                                        {safeT('assets.batch.itemsCount', '项')}
                                                    </span>
                                                </div>
                                                <div className='flex shrink-0 items-center gap-1.5'>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                type='button'
                                                                variant='outline'
                                                                size='sm'
                                                                className='border-border/60 hover:bg-accent/40 h-8 gap-1 rounded-xl text-xs font-semibold shadow-none'>
                                                                <FolderPlus className='text-primary h-3.5 w-3.5' />
                                                                <span className='hidden sm:inline'>
                                                                    {safeT('assets.batch.move', '移动')}
                                                                </span>
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent
                                                            align='end'
                                                            className='border-border/40 bg-popover/90 w-48 rounded-xl p-1.5 shadow-xl backdrop-blur-md'>
                                                            <p className='text-muted-foreground/60 mb-1 px-2 py-1 text-[10px] font-bold tracking-wider uppercase'>
                                                                {safeT('assets.batch.moveTo', '移动到分类')}
                                                            </p>
                                                            <div className='scrollbar-none max-h-40 space-y-0.5 overflow-y-auto'>
                                                                {categories.map((category) => (
                                                                    <Button
                                                                        key={category.id}
                                                                        type='button'
                                                                        variant='ghost'
                                                                        size='sm'
                                                                        className='w-full justify-start rounded-lg px-2 py-1 text-xs font-semibold'
                                                                        onClick={() =>
                                                                            void handleBatchMoveCategory(category.id)
                                                                        }>
                                                                        {getCategoryLabel(category, t)}
                                                                    </Button>
                                                                ))}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>

                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                type='button'
                                                                variant='outline'
                                                                size='sm'
                                                                className='border-border/60 hover:bg-accent/40 h-8 gap-1 rounded-xl text-xs font-semibold shadow-none'>
                                                                <Star className='h-3.5 w-3.5 text-amber-500' />
                                                                <span className='hidden sm:inline'>
                                                                    {safeT('assets.batch.tag', '标签')}
                                                                </span>
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent
                                                            align='end'
                                                            className='border-border/40 bg-popover/90 w-56 space-y-2.5 rounded-xl p-3 shadow-xl backdrop-blur-md'>
                                                            <p className='text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase'>
                                                                {safeT('assets.batch.addTags', '批量添加标签')}
                                                            </p>
                                                            <Input
                                                                value={batchTagInput}
                                                                onChange={(e) => setBatchTagInput(e.target.value)}
                                                                placeholder={safeT(
                                                                    'assets.batch.tagsPlaceholder',
                                                                    '标签，英文逗号分隔'
                                                                )}
                                                                className='border-border/60 focus-visible:ring-primary/20 h-9 rounded-xl text-xs'
                                                            />
                                                            <div className='flex justify-end gap-1.5'>
                                                                <Button
                                                                    type='button'
                                                                    className='from-primary to-primary/95 text-primary-foreground h-8 rounded-xl bg-gradient-to-r text-xs font-semibold shadow-md'
                                                                    onClick={handleBatchAddTags}>
                                                                    {t('common.save') || '保存'}
                                                                </Button>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>

                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        className='h-8 gap-1.5 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50/10 hover:text-red-600 dark:hover:bg-red-500/10'
                                                        onClick={() => setIsBatchDeleteConfirmOpen(true)}>
                                                        <Trash2 className='h-3.5 w-3.5' />
                                                        <span className='hidden sm:inline'>
                                                            {safeT('assets.batch.delete', '删除')}
                                                        </span>
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value='inspiration' className='m-0 min-h-0 overflow-y-auto overscroll-contain'>
                    {iframeSite ? (
                        <div className='flex h-full min-h-[640px] flex-col'>
                            <div className='border-border/60 bg-background/95 flex shrink-0 flex-wrap items-center gap-2 border-b p-2.5 backdrop-blur'>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    className='rounded-xl font-semibold'
                                    onClick={() => setIframeSite(null)}>
                                    {t('workspace.inspiration.backToSites')}
                                </Button>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    className='border-border/60 gap-1.5 rounded-xl font-semibold'
                                    onClick={() => void openExternalUrl(iframeSite.url)}>
                                    <ExternalLink className='h-4 w-4' />
                                    {t('inspiration.action.openExternal')}
                                </Button>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    className='border-border/60 gap-1.5 rounded-xl font-semibold'
                                    onClick={() => {
                                        setIframeBusy(true);
                                        setIframeTimedOut(false);
                                        setIframeNoticeDismissed(false);
                                        setIframeReloadKey((current) => current + 1);
                                    }}>
                                    <RefreshCw className='h-4 w-4' />
                                    {t('inspiration.action.reload')}
                                </Button>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    className='border-border/60 gap-1.5 rounded-xl font-semibold'
                                    onClick={() => void copyTextToClipboard(iframeSite.url)}>
                                    <LinkIcon className='h-4 w-4' />
                                    {t('inspiration.action.copyUrl')}
                                </Button>
                            </div>
                            <div className='relative min-h-0 flex-1'>
                                {(iframeBusy || iframeTimedOut) && !iframeNoticeDismissed && (
                                    <div className='border-border/50 bg-background/95 absolute inset-x-3 top-3 z-10 rounded-xl border p-3.5 text-sm shadow-lg backdrop-blur-md'>
                                        <div className='flex items-start gap-2.5'>
                                            {iframeBusy ? (
                                                <RefreshCw className='text-muted-foreground/60 mt-0.5 h-4 w-4 animate-spin' />
                                            ) : (
                                                <AlertTriangle className='text-muted-foreground/60 mt-0.5 h-4 w-4' />
                                            )}
                                            <div className='min-w-0 flex-1'>
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
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='icon'
                                                className='text-muted-foreground/70 hover:text-foreground -mt-1 h-7 w-7 shrink-0 rounded-lg'
                                                onClick={() => {
                                                    setIframeBusy(false);
                                                    setIframeTimedOut(false);
                                                    setIframeNoticeDismissed(true);
                                                }}
                                                aria-label={t('inspiration.iframe.dismiss')}>
                                                <X className='h-3.5 w-3.5' />
                                            </Button>
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
                                        setIframeNoticeDismissed(false);
                                    }}
                                    onError={() => {
                                        setIframeBusy(false);
                                        setIframeTimedOut(true);
                                        setIframeNoticeDismissed(false);
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
                                        className='border-border/60 focus-visible:ring-primary/20 h-9.5 rounded-xl pl-9 text-sm'
                                        placeholder={t('inspiration.search.placeholder')}
                                    />
                                </div>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    className='border-border/60 h-9 gap-1.5 rounded-xl text-xs font-semibold'
                                    onClick={() => onOpenDrawer('inspiration')}>
                                    <MoreHorizontal className='h-4 w-4' />
                                    {t('inspiration.action.manageSites')}
                                </Button>
                            </div>
                            <div className='scrollbar-none flex gap-1.5 overflow-x-auto pb-2'>
                                <Button
                                    type='button'
                                    variant={activeInspirationCategoryId === 'all' ? 'secondary' : 'ghost'}
                                    className={cn(
                                        'h-7.5 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300',
                                        activeInspirationCategoryId === 'all'
                                            ? 'bg-primary text-primary-foreground shadow-primary/10 shadow-sm'
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
                                            'h-7.5 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300',
                                            activeInspirationCategoryId === category.id
                                                ? 'bg-primary text-primary-foreground shadow-primary/10 shadow-sm'
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
                                    <p className='text-sm font-semibold'>{t('inspiration.empty.title')}</p>
                                    <p className='text-muted-foreground/75 mt-1 max-w-[200px] text-xs leading-relaxed'>
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
                                                onClick={() => void handleOpenSite(site)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        void handleOpenSite(site);
                                                    }
                                                }}
                                                className='group bg-card/25 hover:bg-card/75 dark:bg-muted/3 dark:hover:bg-muted/12 border-border/40 hover:border-primary/20 relative flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-2.5 shadow-sm transition-all duration-300 select-none hover:shadow-md'>
                                                <InspirationSiteAvatar site={site} />
                                                <div className='flex min-w-0 flex-1 flex-col justify-center py-0.5 text-left'>
                                                    <div className='flex min-w-0 items-baseline gap-1.5'>
                                                        <h3
                                                            className='text-foreground/90 group-hover:text-foreground truncate text-sm font-bold transition-all duration-300 group-hover:translate-x-0.5'
                                                            data-i18n-skip='true'>
                                                            {site.title}
                                                        </h3>
                                                        <span
                                                            className='text-muted-foreground/45 hidden truncate text-[10px] font-medium tracking-wide uppercase transition-all duration-300 group-hover:translate-x-0.5 sm:inline'
                                                            data-i18n-skip='true'>
                                                            {validateInspirationUrl(site.url)
                                                                ? new URL(site.url).hostname
                                                                : site.url}
                                                        </span>
                                                    </div>
                                                    <p
                                                        className='text-muted-foreground/60 mt-1 line-clamp-1 text-[10px] font-semibold tracking-wider uppercase transition-all duration-300 group-hover:translate-x-0.5'
                                                        data-i18n-skip='true'>
                                                        {siteCategoryLabel}
                                                        {site.tags.length > 0 ? ` · ${site.tags.join(', ')}` : ''}
                                                    </p>
                                                </div>
                                                <div className='flex shrink-0 items-center gap-1'>
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='icon'
                                                        className='hover:bg-accent text-muted-foreground/60 hover:text-foreground h-8 w-8 rounded-lg transition-all duration-200'
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            updateSite(site.id, { pinned: !site.pinned });
                                                        }}
                                                        aria-label={t('inspiration.action.pin')}>
                                                        <Star
                                                            className={cn(
                                                                'h-3.5 w-3.5 transition-transform duration-300 hover:scale-110',
                                                                site.pinned &&
                                                                    'fill-current text-amber-500 hover:text-amber-600'
                                                            )}
                                                        />
                                                    </Button>
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='icon'
                                                        className='hover:bg-accent text-muted-foreground/60 hover:text-foreground h-8 w-8 rounded-lg transition-all duration-200'
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
                    <DialogContent className='border-border/40 bg-popover/90 max-w-md rounded-3xl border p-6 shadow-2xl backdrop-blur-md'>
                        <DialogHeader className='flex flex-col items-center gap-4 text-center'>
                            <div className='flex h-12 w-12 animate-pulse items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-500 shadow-inner shadow-red-500/5 dark:bg-red-500/15'>
                                <AlertTriangle className='h-5 w-5' />
                            </div>
                            <div className='space-y-1.5'>
                                <DialogTitle className='text-foreground/90 text-base font-bold tracking-tight'>
                                    {t('assets.delete.title')}
                                </DialogTitle>
                                <DialogDescription className='text-muted-foreground/80 mx-auto max-w-[280px] text-xs leading-relaxed font-medium sm:max-w-none'>
                                    {t('assets.delete.description')}
                                </DialogDescription>
                            </div>
                        </DialogHeader>
                        <DialogFooter className='mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
                            <Button
                                type='button'
                                variant='outline'
                                className='border-border/60 h-9.5 min-w-[5rem] rounded-xl text-xs font-semibold'
                                onClick={() => setDeleteAssetId(null)}>
                                {t('common.cancel')}
                            </Button>
                            <Button
                                type='button'
                                className='h-9.5 gap-1 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-xs font-semibold text-white shadow-sm hover:from-red-600 hover:to-red-700'
                                onClick={() => void handleDeleteSelected()}>
                                <Trash2 className='h-3.5 w-3.5' />
                                {t('assets.action.delete')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {isBatchDeleteConfirmOpen && (
                <Dialog open={true} onOpenChange={(nextOpen) => !nextOpen && setIsBatchDeleteConfirmOpen(false)}>
                    <DialogContent className='border-border/40 bg-popover/90 max-w-md rounded-3xl border p-6 shadow-2xl backdrop-blur-md'>
                        <DialogHeader className='flex flex-col items-center gap-4 text-center'>
                            <div className='flex h-12 w-12 animate-pulse items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-500 shadow-inner shadow-red-500/5 dark:bg-red-500/15'>
                                <AlertTriangle className='h-5 w-5' />
                            </div>
                            <div className='space-y-1.5'>
                                <DialogTitle className='text-foreground/90 text-base font-bold tracking-tight'>
                                    {safeT('assets.batchDelete.title', '确认批量删除物料？')}
                                </DialogTitle>
                                <DialogDescription className='text-muted-foreground/80 mx-auto max-w-[280px] text-xs leading-relaxed font-medium sm:max-w-none'>
                                    {safeT(
                                        'assets.batchDelete.description',
                                        `你已选中了 ${selectedFilteredAssetCount} 个物料。删除后它们将无法找回，你确定要继续吗？`,
                                        { count: selectedFilteredAssetCount }
                                    )}
                                </DialogDescription>
                            </div>
                        </DialogHeader>
                        <DialogFooter className='mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
                            <Button
                                type='button'
                                variant='outline'
                                className='border-border/60 h-9.5 min-w-[5rem] rounded-xl text-xs font-semibold'
                                onClick={() => setIsBatchDeleteConfirmOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button
                                type='button'
                                className='h-9.5 gap-1 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-xs font-semibold text-white shadow-sm hover:from-red-600 hover:to-red-700'
                                onClick={() => void handleBatchDelete()}>
                                <Trash2 className='h-3.5 w-3.5' />
                                {t('assets.action.delete')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            <ZoomViewer
                src={
                    previewAssetIndex !== null && previewableAssets[previewAssetIndex]
                        ? (previewUrls[previewableAssets[previewAssetIndex].id] ?? null)
                        : null
                }
                open={previewAssetIndex !== null}
                onClose={() => setPreviewAssetIndex(null)}
                onSendToEdit={
                    previewAssetIndex !== null && previewableAssets[previewAssetIndex]
                        ? () => {
                              const asset = previewableAssets[previewAssetIndex];
                              setPreviewAssetIndex(null);
                              void handleUseAsset(asset);
                          }
                        : undefined
                }
                images={zoomImages}
                currentIndex={previewAssetIndex ?? 0}
                onNavigate={(index) => {
                    setPreviewAssetIndex(index);
                }}
            />
        </>
    );
}
