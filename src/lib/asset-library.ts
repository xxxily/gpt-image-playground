import { db } from '@/lib/db';
import { generateId } from '@/lib/id';
import type {
    AssetLibraryBlobRecord,
    AssetLibraryCategory,
    AssetLibraryImportResult,
    AssetLibraryImportSource,
    AssetLibraryItem,
    AssetLibraryKind
} from '@/types/asset-library';

const CUSTOM_CATEGORIES_STORAGE_KEY = 'gpt-image-playground-asset-library-custom-categories';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'svg', 'ico', 'tif', 'tiff']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv']);
const DESIGN_EXTENSIONS = new Set(['psd', 'ai', 'fig', 'sketch', 'xd']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'txt', 'md', 'doc', 'docx']);
const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz']);

export const ASSET_LIBRARY_CHANGED_EVENT = 'asset-library-changed';

export const DEFAULT_ASSET_LIBRARY_CATEGORY_ID = 'uncategorized';

const ASSET_LIBRARY_KINDS: AssetLibraryKind[] = ['image', 'video', 'design-file', 'document', 'archive', 'unknown'];

const ASSET_LIBRARY_SOURCES = new Set<AssetLibraryImportSource>([
    'file-picker',
    'drop',
    'paste',
    'folder',
    'history',
    'current-source',
    'import',
    'restored'
]);

export const DEFAULT_ASSET_LIBRARY_CATEGORIES: AssetLibraryCategory[] = [
    { id: 'uncategorized', builtIn: true, order: 0, labelKey: 'assets.category.uncategorized' },
    { id: 'brand', builtIn: true, order: 10, labelKey: 'assets.category.brand' },
    { id: 'character', builtIn: true, order: 20, labelKey: 'assets.category.character' },
    { id: 'product', builtIn: true, order: 30, labelKey: 'assets.category.product' },
    { id: 'background', builtIn: true, order: 40, labelKey: 'assets.category.background' },
    { id: 'texture', builtIn: true, order: 50, labelKey: 'assets.category.texture' },
    { id: 'composition', builtIn: true, order: 60, labelKey: 'assets.category.composition' },
    { id: 'temporary', builtIn: true, order: 70, labelKey: 'assets.category.temporary' }
];

function dispatchAssetLibraryChanged(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(ASSET_LIBRARY_CHANGED_EVENT));
}

function getExtension(filename: string): string {
    return filename.split('.').pop()?.trim().toLowerCase() ?? '';
}

function safeFilePart(filename: string): string {
    const cleaned = filename
        .trim()
        .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
        .replace(/\s+/g, ' ')
        .slice(0, 120);
    return cleaned || 'asset';
}

function normalizeTag(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}

function uniqueTags(tags: readonly string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const tag of tags) {
        const normalized = normalizeTag(tag);
        if (!normalized) continue;
        const key = normalized.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
    }
    return result;
}

function normalizeImportedTags(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return uniqueTags(value.filter((item): item is string => typeof item === 'string'));
}

function normalizeNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeAssetKind(value: unknown): AssetLibraryKind {
    return typeof value === 'string' && ASSET_LIBRARY_KINDS.includes(value as AssetLibraryKind)
        ? value as AssetLibraryKind
        : 'unknown';
}

function normalizeAssetSource(value: unknown): AssetLibraryImportSource {
    return typeof value === 'string' && ASSET_LIBRARY_SOURCES.has(value as AssetLibraryImportSource)
        ? value as AssetLibraryImportSource
        : 'import';
}

function getAssetKind(file: Pick<File, 'name' | 'type'>): AssetLibraryKind {
    const mimeType = file.type.trim().toLowerCase();
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return 'document';
    if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('archive')) return 'archive';

    const extension = getExtension(file.name);
    if (IMAGE_EXTENSIONS.has(extension)) return 'image';
    if (VIDEO_EXTENSIONS.has(extension)) return 'video';
    if (DESIGN_EXTENSIONS.has(extension)) return 'design-file';
    if (DOCUMENT_EXTENSIONS.has(extension)) return 'document';
    if (ARCHIVE_EXTENSIONS.has(extension)) return 'archive';
    return 'unknown';
}

export function isAssetLibraryImage(item: Pick<AssetLibraryItem, 'kind' | 'mimeType' | 'originalFilename'>): boolean {
    if (item.kind === 'image') return true;
    if (item.mimeType.trim().toLowerCase().startsWith('image/')) return true;
    return IMAGE_EXTENSIONS.has(getExtension(item.originalFilename));
}

export async function computeAssetSha256(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
    if (!getAssetKind(file).startsWith('image')) return {};
    if (typeof createImageBitmap !== 'function') return {};
    try {
        const bitmap = await createImageBitmap(file);
        const dimensions = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return dimensions;
    } catch {
        return {};
    }
}

export function loadAssetLibraryCategories(): AssetLibraryCategory[] {
    if (typeof window === 'undefined') return DEFAULT_ASSET_LIBRARY_CATEGORIES;

    try {
        const stored = window.localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
        const parsed: unknown = stored ? JSON.parse(stored) : [];
        const customCategories = Array.isArray(parsed)
            ? parsed
                  .map((value): AssetLibraryCategory | null => {
                      if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
                      const record = value as Record<string, unknown>;
                      if (typeof record.id !== 'string' || !record.id.trim()) return null;
                      if (typeof record.name !== 'string' || !record.name.trim()) return null;
                      return {
                          id: record.id,
                          name: record.name.trim(),
                          builtIn: false,
                          order: typeof record.order === 'number' ? record.order : 1000
                      };
                  })
                  .filter((category): category is AssetLibraryCategory => Boolean(category))
            : [];
        return [...DEFAULT_ASSET_LIBRARY_CATEGORIES, ...customCategories].sort((a, b) => a.order - b.order);
    } catch (error) {
        console.warn('Failed to load asset library categories:', error);
        return DEFAULT_ASSET_LIBRARY_CATEGORIES;
    }
}

export function saveCustomAssetLibraryCategory(name: string): AssetLibraryCategory | null {
    if (typeof window === 'undefined') return null;
    const trimmed = name.trim();
    if (!trimmed) return null;

    const current = loadAssetLibraryCategories().filter((category) => !category.builtIn);
    const duplicate = current.find((category) => category.name?.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
    if (duplicate) return duplicate;

    const category: AssetLibraryCategory = {
        id: generateId('asset-category'),
        name: trimmed,
        builtIn: false,
        order: 1000 + current.length
    };
    const next = [...current, category];
    window.localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(next));
    dispatchAssetLibraryChanged();
    return category;
}

function saveCustomAssetLibraryCategories(categories: readonly AssetLibraryCategory[]): void {
    if (typeof window === 'undefined') return;
    const customCategories = categories
        .filter((category) => !category.builtIn && category.name?.trim())
        .map((category, index) => ({
            id: category.id.trim(),
            name: category.name?.trim() || category.id.trim(),
            builtIn: false,
            order: typeof category.order === 'number' ? category.order : 1000 + index
        }));
    window.localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(customCategories));
}

function normalizeImportedCategory(value: unknown): AssetLibraryCategory | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (typeof record.id !== 'string' || !record.id.trim()) return null;
    if (record.builtIn === true) return null;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!name) return null;
    return {
        id: record.id.trim(),
        name,
        builtIn: false,
        order: normalizeNumber(record.order, 1000)
    };
}

function normalizeImportedAssetItem(value: unknown, categoryIds: ReadonlySet<string>): AssetLibraryItem | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (!id) return null;
    const displayName = typeof record.displayName === 'string' ? record.displayName.trim() : '';
    const originalFilename = typeof record.originalFilename === 'string' ? record.originalFilename.trim() : displayName;
    if (!displayName && !originalFilename) return null;

    const now = Date.now();
    const categoryId =
        typeof record.categoryId === 'string' && categoryIds.has(record.categoryId)
            ? record.categoryId
            : DEFAULT_ASSET_LIBRARY_CATEGORY_ID;
    const blobKey = typeof record.blobKey === 'string' && record.blobKey.trim()
        ? record.blobKey.trim()
        : `missing-${id}`;

    return {
        id,
        displayName: displayName || originalFilename || 'Untitled asset',
        originalFilename: originalFilename || displayName || 'untitled',
        kind: normalizeAssetKind(record.kind),
        mimeType: typeof record.mimeType === 'string' && record.mimeType.trim() ? record.mimeType.trim() : 'application/octet-stream',
        size: normalizeNumber(record.size, 0),
        sha256: typeof record.sha256 === 'string' && record.sha256.trim() ? record.sha256.trim() : undefined,
        width: normalizeOptionalNumber(record.width),
        height: normalizeOptionalNumber(record.height),
        durationSeconds: normalizeOptionalNumber(record.durationSeconds),
        categoryId,
        tags: normalizeImportedTags(record.tags),
        favorite: Boolean(record.favorite),
        note: typeof record.note === 'string' && record.note.trim() ? record.note.trim() : undefined,
        source: normalizeAssetSource(record.source),
        sourceUrl: typeof record.sourceUrl === 'string' && record.sourceUrl.trim() ? record.sourceUrl.trim() : undefined,
        blobKey,
        thumbnailKey: typeof record.thumbnailKey === 'string' && record.thumbnailKey.trim() ? record.thumbnailKey.trim() : undefined,
        syncStatus: 'failed',
        remoteKey: typeof record.remoteKey === 'string' && record.remoteKey.trim() ? record.remoteKey.trim() : undefined,
        createdAt: normalizeNumber(record.createdAt, now),
        updatedAt: normalizeNumber(record.updatedAt, now),
        lastUsedAt: normalizeOptionalNumber(record.lastUsedAt),
        usageCount: normalizeOptionalNumber(record.usageCount)
    };
}

export type AssetLibraryIndexImportResult = {
    categoriesAdded: number;
    categoriesUpdated: number;
    itemsAdded: number;
    itemsUpdated: number;
    rejected: number;
};

export async function importAssetLibraryIndex(value: unknown): Promise<AssetLibraryIndexImportResult> {
    const result: AssetLibraryIndexImportResult = {
        categoriesAdded: 0,
        categoriesUpdated: 0,
        itemsAdded: 0,
        itemsUpdated: 0,
        rejected: 0
    };
    const record = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
    if (!record) throw new Error('Invalid asset library index.');

    const categoryMap = new Map<string, AssetLibraryCategory>();
    for (const category of loadAssetLibraryCategories()) {
        categoryMap.set(category.id, category);
    }
    const importedCategories = Array.isArray(record.categories)
        ? record.categories.map(normalizeImportedCategory).filter((category): category is AssetLibraryCategory => Boolean(category))
        : [];

    for (const category of importedCategories) {
        const existing = categoryMap.get(category.id);
        if (!existing) {
            result.categoriesAdded += 1;
            categoryMap.set(category.id, category);
        } else if (!existing.builtIn && (existing.name !== category.name || existing.order !== category.order)) {
            result.categoriesUpdated += 1;
            categoryMap.set(category.id, { ...existing, ...category });
        }
    }

    saveCustomAssetLibraryCategories(Array.from(categoryMap.values()));

    const categoryIds = new Set(categoryMap.keys());
    const importedItems = Array.isArray(record.items) ? record.items : [];
    const normalizedItems = importedItems
        .map((item) => normalizeImportedAssetItem(item, categoryIds))
        .filter((item): item is AssetLibraryItem => {
            if (item) return true;
            result.rejected += 1;
            return false;
        });

    await db.transaction('rw', db.assetLibraryItems, async () => {
        for (const item of normalizedItems) {
            const existing = await db.assetLibraryItems.get(item.id);
            if (existing) {
                await db.assetLibraryItems.update(existing.id, {
                    displayName: item.displayName,
                    originalFilename: item.originalFilename,
                    kind: item.kind,
                    mimeType: item.mimeType,
                    size: item.size,
                    sha256: item.sha256,
                    width: item.width,
                    height: item.height,
                    durationSeconds: item.durationSeconds,
                    categoryId: item.categoryId,
                    tags: item.tags,
                    favorite: item.favorite,
                    note: item.note,
                    sourceUrl: item.sourceUrl,
                    thumbnailKey: item.thumbnailKey,
                    remoteKey: item.remoteKey ?? existing.remoteKey,
                    updatedAt: Date.now(),
                    lastUsedAt: item.lastUsedAt,
                    usageCount: item.usageCount
                });
                result.itemsUpdated += 1;
                continue;
            }
            await db.assetLibraryItems.put(item);
            result.itemsAdded += 1;
        }
    });

    dispatchAssetLibraryChanged();
    return result;
}

export async function listAssetLibraryItems(): Promise<AssetLibraryItem[]> {
    const items = await db.assetLibraryItems.toArray();
    return items.sort((a, b) => (b.lastUsedAt ?? b.updatedAt) - (a.lastUsedAt ?? a.updatedAt));
}

export async function getAssetLibraryBlob(item: Pick<AssetLibraryItem, 'blobKey'>): Promise<Blob | null> {
    const record = await db.assetLibraryBlobs.get(item.blobKey);
    return record?.blob ?? null;
}

export async function getAssetLibraryFile(item: AssetLibraryItem): Promise<File | null> {
    const blob = await getAssetLibraryBlob(item);
    if (!blob) return null;
    const filename = safeFilePart(item.displayName || item.originalFilename);
    return new File([blob], filename, { type: blob.type || item.mimeType || 'application/octet-stream' });
}

export async function importAssetFilesToLibrary(
    files: readonly File[],
    options: {
        source: AssetLibraryImportSource;
        categoryId?: string;
        tags?: readonly string[];
        note?: string;
        sourceUrl?: string;
        skipDuplicates?: boolean;
    }
): Promise<AssetLibraryImportResult> {
    const result: AssetLibraryImportResult = { added: [], skippedDuplicates: [], rejected: [] };
    const categoryId = options.categoryId || DEFAULT_ASSET_LIBRARY_CATEGORY_ID;
    const tags = uniqueTags(options.tags ?? []);

    for (const file of files) {
        if (!(file instanceof File)) {
            result.rejected.push({ filename: 'unknown', reason: 'Unsupported file object.' });
            continue;
        }
        if (file.size <= 0) {
            result.rejected.push({ filename: file.name || 'unnamed', reason: 'Empty file.' });
            continue;
        }

        const kind = getAssetKind(file);
        const sha256 = await computeAssetSha256(file);
        const existing = await db.assetLibraryItems.where('sha256').equals(sha256).first();
        if (existing && options.skipDuplicates !== false) {
            result.skippedDuplicates.push(existing);
            continue;
        }

        const now = Date.now();
        const id = generateId('asset');
        const blobKey = `${id}-${sha256.slice(0, 12)}-${safeFilePart(file.name)}`;
        const dimensions = kind === 'image' ? await readImageDimensions(file) : {};
        const mimeType = file.type || 'application/octet-stream';
        const item: AssetLibraryItem = {
            id,
            displayName: file.name || 'Untitled asset',
            originalFilename: file.name || 'untitled',
            kind,
            mimeType,
            size: file.size,
            sha256,
            ...dimensions,
            categoryId,
            tags,
            favorite: false,
            note: options.note?.trim() || undefined,
            source: options.source,
            sourceUrl: options.sourceUrl?.trim() || undefined,
            blobKey,
            syncStatus: 'local_only',
            createdAt: now,
            updatedAt: now
        };
        const blobRecord: AssetLibraryBlobRecord = {
            blobKey,
            blob: file,
            size: file.size,
            mimeType,
            sha256,
            lastModifiedLocal: now
        };

        await db.transaction('rw', db.assetLibraryItems, db.assetLibraryBlobs, async () => {
            await db.assetLibraryBlobs.put(blobRecord);
            await db.assetLibraryItems.put(item);
        });
        result.added.push(item);
    }

    if (result.added.length > 0) dispatchAssetLibraryChanged();
    return result;
}

export async function updateAssetLibraryItem(
    id: string,
    updates: Partial<Pick<AssetLibraryItem, 'displayName' | 'categoryId' | 'tags' | 'favorite' | 'note'>>
): Promise<void> {
    const normalizedUpdates: Partial<AssetLibraryItem> = { ...updates, updatedAt: Date.now() };
    if (updates.tags) normalizedUpdates.tags = uniqueTags(updates.tags);
    if (updates.displayName !== undefined) normalizedUpdates.displayName = updates.displayName.trim() || 'Untitled asset';
    if (updates.note !== undefined) normalizedUpdates.note = updates.note.trim() || undefined;
    await db.assetLibraryItems.update(id, normalizedUpdates);
    dispatchAssetLibraryChanged();
}

export async function markAssetLibraryItemUsed(id: string): Promise<void> {
    const item = await db.assetLibraryItems.get(id);
    if (!item) return;
    await db.assetLibraryItems.update(id, {
        lastUsedAt: Date.now(),
        usageCount: (item.usageCount ?? 0) + 1,
        updatedAt: Date.now()
    });
    dispatchAssetLibraryChanged();
}

export async function deleteAssetLibraryItems(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const idList = [...ids];
    const items = await db.assetLibraryItems.bulkGet(idList);
    const blobKeys = items
        .map((item) => item?.blobKey)
        .filter((blobKey): blobKey is string => typeof blobKey === 'string' && blobKey.length > 0);

    await db.transaction('rw', db.assetLibraryItems, db.assetLibraryBlobs, async () => {
        await db.assetLibraryItems.bulkDelete(idList);
        if (blobKeys.length > 0) await db.assetLibraryBlobs.bulkDelete(blobKeys);
    });
    dispatchAssetLibraryChanged();
}

export function formatAssetLibraryFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export async function estimateAssetLibraryStorage(): Promise<{ usage?: number; quota?: number; ratio?: number }> {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return {};
    try {
        const estimate = await navigator.storage.estimate();
        const usage = typeof estimate.usage === 'number' ? estimate.usage : undefined;
        const quota = typeof estimate.quota === 'number' ? estimate.quota : undefined;
        return {
            usage,
            quota,
            ratio: usage !== undefined && quota ? usage / quota : undefined
        };
    } catch {
        return {};
    }
}
