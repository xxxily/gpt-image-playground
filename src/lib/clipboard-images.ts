const IMAGE_FILE_EXTENSIONS = new Set([
    'png',
    'jpg',
    'jpeg',
    'webp',
    'gif',
    'bmp',
    'avif',
    'svg',
    'ico',
    'tif',
    'tiff'
]);

const IMAGE_SOURCE_PROTOCOLS = new Set(['blob:', 'data:', 'file:']);

function addSourceCandidate(sources: Set<string>, value: string | null | undefined): void {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    sources.add(trimmed);
}

function hasImageFileExtension(filename: string): boolean {
    const extension = filename.split('.').pop()?.trim().toLowerCase();
    return !!extension && IMAGE_FILE_EXTENSIONS.has(extension);
}

function isImageSourceCandidate(value: string, allowRemoteHttp: boolean): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;

    for (const protocol of IMAGE_SOURCE_PROTOCOLS) {
        if (trimmed.toLowerCase().startsWith(protocol)) return true;
    }

    try {
        const url = new URL(trimmed);
        return allowRemoteHttp && (url.protocol === 'http:' || url.protocol === 'https:');
    } catch {
        return false;
    }
}

function extractImageSourcesFromHtml(html: string): string[] {
    const trimmed = html.trim();
    if (!trimmed) return [];

    const sources = new Set<string>();

    const tryAdd = (value: string | null | undefined) => {
        if (value && isImageSourceCandidate(value, true)) {
            addSourceCandidate(sources, value);
        }
    };

    if (typeof DOMParser !== 'undefined') {
        try {
            const document = new DOMParser().parseFromString(trimmed, 'text/html');
            for (const image of Array.from(document.querySelectorAll('img'))) {
                tryAdd(image.getAttribute('src'));
                tryAdd(image.getAttribute('data-src'));

                const srcset = image.getAttribute('srcset');
                if (srcset) {
                    for (const entry of srcset.split(',')) {
                        const candidate = entry.trim().split(/\s+/u)[0];
                        tryAdd(candidate);
                    }
                }
            }
        } catch {
            // Fall back to regex parsing below.
        }
    }

    if (sources.size === 0) {
        const attrPatterns = [/\b(?:src|data-src)\s*=\s*(["'])(.*?)\1/giu, /\b(?:src|data-src)\s*=\s*([^\s"'<>]+)/giu];
        for (const pattern of attrPatterns) {
            for (const match of trimmed.matchAll(pattern)) {
                tryAdd(match[2] ?? match[1]);
            }
        }

        const srcsetPattern = /\bsrcset\s*=\s*(["'])(.*?)\1/giu;
        for (const match of trimmed.matchAll(srcsetPattern)) {
            const srcset = match[2] ?? '';
            for (const entry of srcset.split(',')) {
                const candidate = entry.trim().split(/\s+/u)[0];
                tryAdd(candidate);
            }
        }
    }

    return Array.from(sources);
}

function extractPlainTextFromHtml(html: string): string {
    const trimmed = html.trim();
    if (!trimmed) return '';

    if (typeof DOMParser !== 'undefined') {
        try {
            const document = new DOMParser().parseFromString(trimmed, 'text/html');
            const text = document.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
            if (text) return text;
        } catch {
            // Fall back to regex stripping below.
        }
    }

    return trimmed
        .replace(/<script[\s\S]*?<\/script>/giu, ' ')
        .replace(/<style[\s\S]*?<\/style>/giu, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractFirstUriListValue(value: string): string {
    for (const line of value.split(/\r?\n/u)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        return trimmed;
    }
    return '';
}

function isLikelyImageUrl(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;

    try {
        const url = new URL(trimmed);
        return /\.(png|jpe?g|webp|gif|bmp|avif|svg|ico|tiff?)(?:[?#].*)?$/iu.test(url.pathname + url.search);
    } catch {
        return /\.(png|jpe?g|webp|gif|bmp|avif|svg|ico|tiff?)(?:[?#].*)?$/iu.test(trimmed);
    }
}

function extractImageSourcesFromText(text: string): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    if (/\b(?:src|data-src|srcset)\s*=/iu.test(trimmed) || /<img\b/iu.test(trimmed)) {
        return extractImageSourcesFromHtml(trimmed);
    }

    if (isImageSourceCandidate(trimmed, false)) {
        return [trimmed];
    }

    return [];
}

export function isImageFileLike(file: Pick<File, 'name' | 'type'>): boolean {
    if (file.type.trim().startsWith('image/')) return true;
    return hasImageFileExtension(file.name);
}

export function getClipboardImageFiles(dataTransfer: Pick<DataTransfer, 'items' | 'files'>): File[] {
    const imageFiles: File[] = [];
    const seen = new Set<string>();

    const pushFile = (file: File | null | undefined, typeHint?: string) => {
        if (!file) return;
        if (!isImageFileLike(file) && !typeHint?.trim().startsWith('image/')) return;

        const normalizedType = file.type.trim() || typeHint?.trim() || '';
        const signature = [file.name.trim(), file.size, normalizedType].join('\u0000');
        if (seen.has(signature)) return;

        seen.add(signature);
        imageFiles.push(file);
    };

    for (const item of Array.from(dataTransfer.items)) {
        if (item.kind !== 'file') continue;
        pushFile(item.getAsFile(), item.type);
    }

    for (const file of Array.from(dataTransfer.files)) {
        pushFile(file);
    }

    return imageFiles;
}

export function getClipboardText(
    dataTransfer: Pick<DataTransfer, 'getData'>,
    imageSources: readonly string[] = []
): string {
    const imageSourceSet = new Set(imageSources.map((source) => source.trim()).filter(Boolean));
    const candidates = [
        dataTransfer.getData('text/plain'),
        dataTransfer.getData('text'),
        extractFirstUriListValue(dataTransfer.getData('text/uri-list')),
        extractPlainTextFromHtml(dataTransfer.getData('text/html'))
    ];

    for (const candidate of candidates) {
        const trimmed = candidate.trim();
        if (!trimmed) continue;
        if (imageSourceSet.size > 0 && (imageSourceSet.has(trimmed) || isLikelyImageUrl(trimmed))) continue;
        return trimmed;
    }

    return '';
}

export function getClipboardImageSources(dataTransfer: Pick<DataTransfer, 'getData'>): string[] {
    const sources = new Set<string>();

    for (const type of ['text/html', 'text/plain', 'text', 'text/uri-list'] as const) {
        const value = dataTransfer.getData(type);
        for (const source of extractImageSourcesFromText(value)) {
            sources.add(source);
        }
    }

    return Array.from(sources);
}
