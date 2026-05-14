export function isBlobObjectUrl(url: string): boolean {
    return url.trim().toLowerCase().startsWith('blob:');
}

export function getRemovedBlobObjectUrls(previousUrls: readonly string[], currentUrls: readonly string[]): string[] {
    const currentCounts = new Map<string, number>();

    for (const url of currentUrls) {
        if (!isBlobObjectUrl(url)) continue;
        currentCounts.set(url, (currentCounts.get(url) ?? 0) + 1);
    }

    const removedUrls: string[] = [];

    for (const url of previousUrls) {
        if (!isBlobObjectUrl(url)) continue;

        const remainingCount = currentCounts.get(url) ?? 0;
        if (remainingCount > 0) {
            currentCounts.set(url, remainingCount - 1);
            continue;
        }

        removedUrls.push(url);
    }

    return removedUrls;
}

export function revokeBlobObjectUrls(
    urls: Iterable<string>,
    revokeObjectUrl: (url: string) => void = (url) => URL.revokeObjectURL(url),
): void {
    const revoked = new Set<string>();

    for (const url of urls) {
        if (!isBlobObjectUrl(url) || revoked.has(url)) continue;

        revoked.add(url);
        revokeObjectUrl(url);
    }
}
