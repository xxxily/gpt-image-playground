// Multi-tab task-completion notification (§3.7). When a task ends and the tab
// is hidden, paint a dot badge on the favicon and flash the document title.
// Both clear on `visibilitychange` to visible. Skipped on Tauri desktop.

import { isTauriDesktop } from '@/lib/desktop-runtime';

type BadgeKind = 'success' | 'error' | 'none';

const FAVICON_ID = 'app-favicon-dynamic';
const ORIGINAL_FAVICON_HREF = '/favicon.svg';
const TITLE_FLASH_INTERVAL_MS = 1500;
const BADGE_SIZE = 32;

let originalTitle: string | null = null;
let titleFlashTimer: number | null = null;
let titleFlashState: 'prefix' | 'original' = 'original';
let currentPrefix: string | null = null;
let visibilityListenerAttached = false;
let currentBadge: BadgeKind = 'none';

function safeWindow(): typeof window | null {
    return typeof window !== 'undefined' ? window : null;
}

function safeDocument(): typeof document | null {
    return typeof document !== 'undefined' ? document : null;
}

function captureOriginalTitle(): string {
    const doc = safeDocument();
    if (!doc) return '';
    if (originalTitle === null) {
        originalTitle = doc.title;
    }
    return originalTitle;
}

function restoreOriginalTitle(): void {
    const doc = safeDocument();
    if (!doc || originalTitle === null) return;
    doc.title = originalTitle;
}

function clearTitleFlash(): void {
    const win = safeWindow();
    if (titleFlashTimer !== null && win) {
        win.clearInterval(titleFlashTimer);
    }
    titleFlashTimer = null;
    currentPrefix = null;
    titleFlashState = 'original';
    restoreOriginalTitle();
}

function startTitleFlash(prefix: string): void {
    const doc = safeDocument();
    const win = safeWindow();
    if (!doc || !win) return;
    captureOriginalTitle();
    currentPrefix = prefix;
    if (titleFlashTimer !== null) {
        win.clearInterval(titleFlashTimer);
    }
    titleFlashState = 'prefix';
    doc.title = `${prefix}${originalTitle ?? ''}`;
    titleFlashTimer = win.setInterval(() => {
        if (!safeDocument()) return;
        if (titleFlashState === 'prefix') {
            doc.title = originalTitle ?? '';
            titleFlashState = 'original';
        } else {
            doc.title = `${currentPrefix ?? ''}${originalTitle ?? ''}`;
            titleFlashState = 'prefix';
        }
    }, TITLE_FLASH_INTERVAL_MS);
}

function removeFaviconBadge(): void {
    const doc = safeDocument();
    if (!doc) return;
    const injected = doc.getElementById(FAVICON_ID);
    if (injected?.parentNode) {
        injected.parentNode.removeChild(injected);
    }
    currentBadge = 'none';
}

function drawBadgeDataUrl(kind: 'success' | 'error', baseImage: HTMLImageElement): string | null {
    const doc = safeDocument();
    if (!doc) return null;
    try {
        const canvas = doc.createElement('canvas');
        canvas.width = BADGE_SIZE;
        canvas.height = BADGE_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(baseImage, 0, 0, BADGE_SIZE, BADGE_SIZE);
        const dotRadius = BADGE_SIZE / 4;
        const dotCx = BADGE_SIZE - dotRadius;
        const dotCy = BADGE_SIZE - dotRadius;
        ctx.beginPath();
        ctx.arc(dotCx, dotCy, dotRadius, 0, Math.PI * 2);
        // Tailwind emerald-500 / red-500 in hex (Canvas does not accept utility names).
        ctx.fillStyle = kind === 'success' ? '#10b981' : '#ef4444';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        return canvas.toDataURL('image/png');
    } catch {
        return null;
    }
}

function injectFavicon(dataUrl: string): void {
    const doc = safeDocument();
    if (!doc) return;
    const previous = doc.getElementById(FAVICON_ID);
    if (previous?.parentNode) {
        previous.parentNode.removeChild(previous);
    }
    const link = doc.createElement('link');
    link.id = FAVICON_ID;
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = dataUrl;
    doc.head.appendChild(link);
}

export function setFaviconBadge(kind: BadgeKind): void {
    const doc = safeDocument();
    if (!doc) return;
    if (kind === 'none') {
        removeFaviconBadge();
        return;
    }
    if (currentBadge === kind) return;
    currentBadge = kind;
    const img = new Image();
    img.onload = () => {
        const dataUrl = drawBadgeDataUrl(kind, img);
        if (dataUrl) injectFavicon(dataUrl);
    };
    img.onerror = () => {};
    img.src = ORIGINAL_FAVICON_HREF;
}

function attachVisibilityListenerOnce(): void {
    if (visibilityListenerAttached) return;
    const doc = safeDocument();
    if (!doc) return;
    visibilityListenerAttached = true;
    doc.addEventListener('visibilitychange', () => {
        if (!doc.hidden) {
            clearTitleFlash();
            removeFaviconBadge();
        }
    });
}

export interface TaskNotificationOptions {
    kind: 'success' | 'error';
    titlePrefix?: string;
}

export function notifyTaskCompletion(opts: TaskNotificationOptions): void {
    const doc = safeDocument();
    if (!doc) return;
    if (!doc.hidden) return;
    if (isTauriDesktop()) return;
    attachVisibilityListenerOnce();
    const prefix = opts.titlePrefix ?? (opts.kind === 'success' ? '(完成 ✓) ' : '(失败 ✗) ');
    startTitleFlash(prefix);
    setFaviconBadge(opts.kind);
}

export function clearTaskNotification(): void {
    clearTitleFlash();
    removeFaviconBadge();
}
