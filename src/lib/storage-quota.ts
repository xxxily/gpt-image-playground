// localStorage quota detection (§16.3). Cross-browser-aware:
// - Chrome/Edge throw DOMException with name 'QuotaExceededError'
// - Firefox uses 'NS_ERROR_DOM_QUOTA_REACHED'
// - Safari private mode may use code 22 with no name
// On detection, dispatch a single 'storage-quota-exceeded' CustomEvent so the
// page-level notice provider can surface ONE warning instead of one-per-write.

export const STORAGE_QUOTA_EVENT = 'app-storage-quota-exceeded';

export interface StorageQuotaEventDetail {
    scope: string;
    rawMessage: string;
}

export function isQuotaExceededError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const candidate = err as { name?: string; code?: number };
    if (candidate.name === 'QuotaExceededError' || candidate.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
    if (candidate.code === 22 || candidate.code === 1014) return true;
    return false;
}

let dispatchedSinceVisible = false;

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) dispatchedSinceVisible = false;
    });
}

export function reportStorageQuotaIfApplicable(err: unknown, scope: string): boolean {
    if (!isQuotaExceededError(err)) return false;
    if (typeof window === 'undefined') return true;
    if (dispatchedSinceVisible) return true;
    dispatchedSinceVisible = true;
    try {
        const detail: StorageQuotaEventDetail = {
            scope,
            rawMessage: err instanceof Error ? err.message : String(err)
        };
        window.dispatchEvent(new CustomEvent<StorageQuotaEventDetail>(STORAGE_QUOTA_EVENT, { detail }));
    } catch (dispatchErr) {
        console.warn('[storage-quota] failed to dispatch event', dispatchErr);
    }
    return true;
}
