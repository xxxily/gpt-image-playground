export const NOTICE_PERSIST_STORAGE_KEY = 'app.notice.dismissed.v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function readDismissedNoticeKeys(storage: StorageLike | null | undefined): Set<string> {
    if (!storage) return new Set();
    try {
        const raw = storage.getItem(NOTICE_PERSIST_STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'));
    } catch {
        return new Set();
    }
}

export function writeDismissedNoticeKeys(storage: StorageLike | null | undefined, keys: Set<string>): void {
    if (!storage) return;
    try {
        storage.setItem(NOTICE_PERSIST_STORAGE_KEY, JSON.stringify(Array.from(keys)));
    } catch {
        return;
    }
}
