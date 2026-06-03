import { isAboveOrAtBreakpoint } from '@/lib/breakpoints';

export type ServerRuntimeConfig = {
    clientDirectLinkPriority?: boolean;
};

export type DesktopRemoteImageResponse = {
    bytes: number[];
    contentType: string;
};

export function parseServerRuntimeConfig(value: unknown): ServerRuntimeConfig {
    if (typeof value !== 'object' || value === null || !('clientDirectLinkPriority' in value)) return {};

    const { clientDirectLinkPriority } = value;
    return typeof clientDirectLinkPriority === 'boolean' ? { clientDirectLinkPriority } : {};
}

export function isEditablePasteTarget(target: EventTarget | null): boolean {
    if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;

    const tagName = target.tagName.toLowerCase();
    return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isLargeLayout(): boolean {
    return isAboveOrAtBreakpoint('lg');
}
