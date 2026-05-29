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
import type {
    InspirationSite,
    InspirationSiteCategory,
    InspirationSiteOpenMode,
    InspirationSitesState
} from '@/types/inspiration-sites';
import {
    AlertTriangle,
    Archive,
    Boxes,
    ChevronLeft,
    Compass,
    Download,
    EyeOff,
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

export function AssetLibraryDrawer({
    open,
    onOpenChange,
    initialTab = 'assets',
    currentSourceFiles,
    onUseAssetFiles
}: AssetLibraryDrawerProps) {
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

    const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
    const [selectedAssetIds, setSelectedAssetIds] = React.useState<Set<string>>(new Set());
    const [previewAssetIndex, setPreviewAssetIndex] = React.useState<number | null>(null);
    const [batchTagInput, setBatchTagInput] = React.useState('');
    const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = React.useState(false);

    const [inspirationState, setInspirationState] = React.useState<InspirationSitesState>(() =>
        loadInspirationSitesState()
    );
    const [inspirationSearch, setInspirationSearch] = React.useState('');
    const [activeInspirationCategoryId, setActiveInspirationCategoryId] = React.useState('all');
    const [siteTitleDraft, setSiteTitleDraft] = React.useState('');
    const [siteUrlDraft, setSiteUrlDraft] = React.useState('');
    const [siteTagsDraft, setSiteTagsDraft] = React.useState('');
    const [siteCategoryDraft, setSiteCategoryDraft] = React.useState('design');
    const [siteOpenModeDraft, setSiteOpenModeDraft] =
        React.useState<Extract<InspirationSiteOpenMode, 'drawer' | 'external-browser'>>('external-browser');
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
            filename: asset.displayName || asset.originalFilename
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
        setSiteOpenModeDraft('external-browser');
    }, []);

    const getOpenModeLabel = React.useCallback(
        (mode: InspirationSiteOpenMode) =>
            mode === 'drawer' ? t('inspiration.openMode.iframe') : t('inspiration.openMode.external'),
        [t]
    );

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
                              defaultOpenMode: siteOpenModeDraft,
                              openModeUpdatedAt: Date.now(),
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
            defaultOpenMode: siteOpenModeDraft,
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
        siteOpenModeDraft,
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
        setSiteOpenModeDraft(site.defaultOpenMode === 'drawer' ? 'drawer' : 'external-browser');
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
                        <Tabs
                            value={activeTab}
                            onValueChange={(value) => setActiveTab(value as 'assets' | 'inspiration')}
                            className='h-full gap-0'>
                            <div className='border-border/60 bg-background/95 sticky top-0 z-10 border-b px-4 py-3 backdrop-blur sm:px-5'>
                                <TabsList className='w-full rounded-xl sm:w-auto'>
                                    <TabsTrigger
                                        value='assets'
                                        className='flex-1 gap-1.5 rounded-lg text-xs font-semibold sm:flex-none'>
                                        <Boxes className='h-3.5 w-3.5' />
                                        {t('assets.tab.assets')}
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value='inspiration'
                                        className='flex-1 gap-1.5 rounded-lg text-xs font-semibold sm:flex-none'>
                                        <Compass className='h-3.5 w-3.5' />
                                        {t('assets.tab.inspiration')}
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value='assets' className='m-0 h-full overflow-hidden'>
                                <div className='grid h-[calc(100dvh-7.5rem)] grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden'>
                                    <section
                                        className={cn(
                                            'border-border/50 scrollbar-none h-full min-w-0 overflow-y-auto border-b p-4 sm:p-5 lg:border-r lg:border-b-0',
                                            selectedAsset && 'hidden lg:block'
                                        )}>
                                        <div
                                            className={cn(
                                                'mb-4 rounded-xl border px-3 py-2.5 text-xs font-semibold tracking-wide shadow-sm backdrop-blur-sm',
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
                                                'border-border/60 bg-muted/15 mb-4 flex flex-col gap-3 rounded-2xl border border-dashed p-4 transition-all duration-300',
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
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <p className='text-muted-foreground/60 px-0.5 text-xs'>
                                                {t('assets.dropHint')}
                                            </p>
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
                                        <div className='mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_10rem_8rem]'>
                                            <div className='relative'>
                                                <Search className='text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                                                <Input
                                                    value={search}
                                                    onChange={(event) => setSearch(event.target.value)}
                                                    className='border-border/60 focus-visible:ring-primary/20 h-9.5 rounded-xl pl-9 text-sm'
                                                    placeholder={t('assets.search.placeholder')}
                                                />
                                            </div>
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
                                        <div className='mb-4 flex items-center justify-between gap-2'>
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
                                        {filteredAssets.length === 0 ? (
                                            <div className='border-border/50 bg-muted/20 flex min-h-56 flex-col items-center justify-center rounded-2xl border p-4 text-center'>
                                                <FolderPlus className='text-muted-foreground/60 mb-3 h-8 w-8' />
                                                <p className='text-sm font-semibold'>{t('assets.empty.title')}</p>
                                                <p className='text-muted-foreground/75 mt-1 max-w-xs text-xs leading-relaxed'>
                                                    {t('assets.empty.description')}
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                {viewMode === 'grid' ? (
                                                    <div className='grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3 xl:grid-cols-4'>
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
                                                                                        void handleToggleFavoriteForItem(
                                                                                            item
                                                                                        );
                                                                                    }}
                                                                                    title={t('assets.action.favorite')}>
                                                                                    <Heart
                                                                                        className={cn(
                                                                                            'h-3.5 w-3.5',
                                                                                            item.favorite &&
                                                                                                'fill-current'
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
                                                    <div className='border-border/20 bg-card/10 mb-4 overflow-hidden rounded-2xl border shadow-sm'>
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
                                                                    <th className='hidden p-3 font-semibold lg:table-cell'>
                                                                        {t('assets.list.date') || '创建时间'}
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
                                                                                isSelected &&
                                                                                    'bg-primary/5 hover:bg-primary/10'
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
                                                                                    {formatAssetLibraryFileSize(
                                                                                        item.size
                                                                                    )}
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
                                                                            <td className='text-muted-foreground/60 hidden p-3 lg:table-cell'>
                                                                                {formatDate(item.createdAt, language)}
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
                                                                                        title={t(
                                                                                            'assets.action.favorite'
                                                                                        )}>
                                                                                        <Heart
                                                                                            className={cn(
                                                                                                'h-3.5 w-3.5',
                                                                                                item.favorite &&
                                                                                                    'fill-current'
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
                                                                                                void handleUseAsset(
                                                                                                    item
                                                                                                )
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
                                                                                            void handleDownloadAsset(
                                                                                                item
                                                                                            )
                                                                                        }
                                                                                        title={t(
                                                                                            'assets.action.download'
                                                                                        )}>
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
                                                                                        title={
                                                                                            t('common.edit') || '编辑'
                                                                                        }>
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
                                                                                        title={t(
                                                                                            'assets.action.delete'
                                                                                        )}>
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
                                                    <div className='bg-background/80 dark:bg-muted/30 border-primary/20 animate-in fade-in slide-in-from-bottom-3 absolute bottom-5 left-1/2 z-40 flex w-[min(90%,28rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 shadow-2xl backdrop-blur-xl duration-300 dark:border-white/10'>
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
                                                                        className='border-border/60 hover:bg-accent/40 h-8.5 gap-1.5 rounded-xl text-xs font-semibold shadow-none'>
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
                                                                                    void handleBatchMoveCategory(
                                                                                        category.id
                                                                                    )
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
                                                                        className='border-border/60 hover:bg-accent/40 h-8.5 gap-1.5 rounded-xl text-xs font-semibold shadow-none'>
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
                                                                        onChange={(e) =>
                                                                            setBatchTagInput(e.target.value)
                                                                        }
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
                                                                className='h-8.5 gap-1.5 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50/10 hover:text-red-600 dark:hover:bg-red-500/10'
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
                                    </section>
                                    <aside
                                        className={cn(
                                            'bg-muted/5 scrollbar-none h-full min-w-0 overflow-y-auto p-4 sm:p-5',
                                            !selectedAsset && 'hidden lg:block'
                                        )}>
                                        {selectedAsset ? (
                                            <div className='animate-in fade-in slide-in-from-right-3 space-y-4 duration-200'>
                                                <div className='border-border/10 mb-4 border-b pb-3 lg:hidden'>
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='sm'
                                                        className='text-muted-foreground hover:text-foreground hover:bg-accent/60 h-8.5 gap-1.5 rounded-xl px-3 text-xs font-bold shadow-none transition-all duration-200'
                                                        onClick={() => setSelectedAssetId(null)}>
                                                        <ChevronLeft className='h-4 w-4' />
                                                        {t('common.back')}
                                                    </Button>
                                                </div>
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
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='icon'
                                                        className='hover:bg-accent h-8 w-8 rounded-lg'
                                                        onClick={handleToggleFavorite}
                                                        aria-label={t('assets.action.favorite')}>
                                                        <Heart
                                                            className={cn(
                                                                'h-4 w-4 transition-transform duration-300 hover:scale-110',
                                                                selectedAsset.favorite && 'fill-current text-red-500'
                                                            )}
                                                        />
                                                    </Button>
                                                </div>
                                                <div className='space-y-3.5'>
                                                    <div className='space-y-1.5'>
                                                        <Label
                                                            htmlFor='asset-name'
                                                            className='text-muted-foreground/70 px-0.5 text-[10px] font-bold tracking-wider uppercase'>
                                                            {t('assets.field.name')}
                                                        </Label>
                                                        <Input
                                                            id='asset-name'
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
                                                            onChange={(event) =>
                                                                setCustomCategoryDraft(event.target.value)
                                                            }
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
                                                            htmlFor='asset-tags'
                                                            className='text-muted-foreground/70 px-0.5 text-[10px] font-bold tracking-wider uppercase'>
                                                            {t('assets.field.tags')}
                                                        </Label>
                                                        <Input
                                                            id='asset-tags'
                                                            value={tagDraft}
                                                            onChange={(event) => setTagDraft(event.target.value)}
                                                            placeholder={t('assets.field.tagsPlaceholder')}
                                                            className='border-border/60 focus-visible:ring-primary/20 h-9.5 rounded-xl text-xs font-medium'
                                                        />
                                                    </div>
                                                    <div className='space-y-1.5'>
                                                        <Label
                                                            htmlFor='asset-note'
                                                            className='text-muted-foreground/70 px-0.5 text-[10px] font-bold tracking-wider uppercase'>
                                                            {t('assets.field.note')}
                                                        </Label>
                                                        <Textarea
                                                            id='asset-note'
                                                            value={noteDraft}
                                                            onChange={(event) => setNoteDraft(event.target.value)}
                                                            placeholder={t('assets.field.notePlaceholder')}
                                                            className='border-border/60 focus-visible:ring-primary/20 min-h-20 resize-none rounded-xl p-3 text-xs font-medium'
                                                        />
                                                    </div>
                                                    <div className='bg-muted/20 dark:bg-muted/10 border-border/10 grid grid-cols-2 gap-2 rounded-xl border p-3 text-xs'>
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
                                            </div>
                                        ) : (
                                            <div className='text-muted-foreground/45 animate-in fade-in flex h-full flex-col items-center justify-center p-6 text-center duration-200'>
                                                <Boxes className='mb-3 h-8 w-8 opacity-45' />
                                                <p className='text-xs font-semibold'>
                                                    {t('assets.details.empty') || '选择一个素材以查看详情'}
                                                </p>
                                            </div>
                                        )}
                                    </aside>
                                </div>
                            </TabsContent>

                            <TabsContent value='inspiration' className='m-0 h-full overflow-hidden'>
                                <div className='grid h-[calc(100dvh-7.5rem)] grid-cols-1 gap-4 overflow-y-auto p-4 sm:p-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:overflow-hidden'>
                                    <aside className='scrollbar-none h-full min-w-0 overflow-y-auto'>
                                        <div className='scrollbar-none flex gap-1.5 overflow-x-auto pb-2 lg:block lg:space-y-1.5 lg:overflow-visible lg:pb-0'>
                                            <Button
                                                type='button'
                                                variant={activeInspirationCategoryId === 'all' ? 'secondary' : 'ghost'}
                                                className={cn(
                                                    'h-9 shrink-0 justify-start gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 lg:w-full',
                                                    activeInspirationCategoryId === 'all'
                                                        ? 'bg-primary text-primary-foreground shadow-primary/10 shadow-sm'
                                                        : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
                                                )}
                                                onClick={() => setActiveInspirationCategoryId('all')}>
                                                {t('inspiration.category.all')}
                                            </Button>
                                            {inspirationCategories.map((category) => (
                                                <Button
                                                    key={category.id}
                                                    type='button'
                                                    variant={
                                                        activeInspirationCategoryId === category.id
                                                            ? 'secondary'
                                                            : 'ghost'
                                                    }
                                                    className={cn(
                                                        'h-9 shrink-0 justify-start gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 lg:w-full',
                                                        activeInspirationCategoryId === category.id
                                                            ? 'bg-primary text-primary-foreground shadow-primary/10 shadow-sm'
                                                            : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
                                                    )}
                                                    onClick={() => setActiveInspirationCategoryId(category.id)}>
                                                    {getCategoryLabel(category, t)}
                                                </Button>
                                            ))}
                                        </div>
                                    </aside>
                                    <section className='scrollbar-none h-full min-w-0 overflow-y-auto pb-8'>
                                        <div className='mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between'>
                                            <div className='relative min-w-0 flex-1'>
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
                                                className='border-border/60 h-9 shrink-0 gap-1.5 rounded-xl text-xs font-semibold'
                                                onClick={handleOpenSiteManager}>
                                                <MoreHorizontal className='h-4 w-4' />
                                                {t('inspiration.action.manageSites')}
                                            </Button>
                                        </div>
                                        {visibleSites.length === 0 ? (
                                            <div className='border-border/50 bg-muted/20 flex min-h-56 flex-col items-center justify-center rounded-2xl border p-4 text-center'>
                                                <Compass className='text-muted-foreground/60 mb-3 h-8 w-8' />
                                                <p className='text-sm font-semibold'>{t('inspiration.empty.title')}</p>
                                                <p className='text-muted-foreground/75 mt-1 max-w-xs text-xs leading-relaxed'>
                                                    {t('inspiration.empty.description')}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className='grid gap-3 pb-4 sm:grid-cols-2 xl:grid-cols-3'>
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
                                                            onClick={() => void handleOpenSite(site, 'drawer')}
                                                            onKeyDown={(event) => {
                                                                if (event.key === 'Enter' || event.key === ' ') {
                                                                    event.preventDefault();
                                                                    void handleOpenSite(site, 'drawer');
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
                                                                    {site.tags.length > 0
                                                                        ? ` · ${site.tags.join(', ')}`
                                                                        : ''}
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
                                                                        void handleOpenSite(site, 'external');
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
                                    </section>
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
                                    <p className='text-muted-foreground mt-1 text-xs'>
                                        {t('inspiration.add.description')}
                                    </p>
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='site-title'>{t('inspiration.field.title')}</Label>
                                    <Input
                                        id='site-title'
                                        value={siteTitleDraft}
                                        onChange={(event) => setSiteTitleDraft(event.target.value)}
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='site-url'>{t('inspiration.field.url')}</Label>
                                    <Input
                                        id='site-url'
                                        value={siteUrlDraft}
                                        onChange={(event) => setSiteUrlDraft(event.target.value)}
                                        placeholder='https://'
                                        aria-invalid={
                                            siteUrlDraft.trim() ? !validateInspirationUrl(siteUrlDraft) : undefined
                                        }
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
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        onClick={handleAddInspirationCategory}>
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
                                <div className='space-y-2'>
                                    <Label>{t('inspiration.field.openMode')}</Label>
                                    <Select
                                        value={siteOpenModeDraft}
                                        onValueChange={(value) =>
                                            setSiteOpenModeDraft(
                                                value === 'drawer' ? 'drawer' : 'external-browser'
                                            )
                                        }>
                                        <SelectTrigger className='w-full'>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value='external-browser'>
                                                {t('inspiration.openMode.external')}
                                            </SelectItem>
                                            <SelectItem value='drawer'>{t('inspiration.openMode.iframe')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className='text-muted-foreground text-xs'>
                                        {t('inspiration.field.openModeDescription')}
                                    </p>
                                </div>
                                <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                                    <Button type='button' className='w-full' onClick={handleSaveSite}>
                                        <Plus className='h-4 w-4' />
                                        {editingSiteId ? t('common.save') : t('inspiration.action.addSite')}
                                    </Button>
                                    {editingSiteId && (
                                        <Button
                                            type='button'
                                            variant='outline'
                                            className='w-full'
                                            onClick={resetSiteDrafts}>
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
                                        onClick={() =>
                                            downloadJson(
                                                'gpt-image-playground-inspiration-sites.json',
                                                inspirationState
                                            )
                                        }>
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
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        className='justify-start sm:col-span-2'
                                        onClick={handleRestoreDefaultInspiration}>
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
                                        const siteCategoryLabel = siteCategory
                                            ? getCategoryLabel(siteCategory, t)
                                            : site.categoryId;
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
                                                        {site.enabled
                                                            ? `${siteCategoryLabel} · ${getOpenModeLabel(site.defaultOpenMode)}`
                                                            : t('inspiration.status.hidden')}
                                                    </p>
                                                </div>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    size='icon'
                                                    className='h-8 w-8'
                                                    onClick={() => handleEditSite(site)}
                                                    aria-label={t('common.edit')}>
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
                                                                sites: inspirationState.sites.filter(
                                                                    (item) => item.id !== site.id
                                                                )
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
                        <DrawerTitle data-i18n-skip='true'>
                            {iframeSite?.title ?? t('inspiration.browser.title')}
                        </DrawerTitle>
                        <DrawerDescription data-i18n-skip='true'>{iframeSite?.url ?? ''}</DrawerDescription>
                        {iframeSite && (
                            <div className='mt-3 flex flex-wrap gap-2'>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    onClick={() => void openExternalUrl(iframeSite.url)}>
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
                                <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    onClick={() => void copyTextToClipboard(iframeSite.url)}>
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
                                                    {iframeTimedOut
                                                        ? t('inspiration.iframe.timeoutTitle')
                                                        : t('inspiration.iframe.loadingTitle')}
                                                </p>
                                                <p className='text-muted-foreground mt-1 text-xs'>
                                                    {iframeTimedOut
                                                        ? t('inspiration.iframe.timeoutDescription')
                                                        : t('inspiration.iframe.loadingDescription')}
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
