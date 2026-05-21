import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/desktop-runtime', () => ({
    isTauriDesktop: () => false
}));

describe('tab-notification', () => {
    let notifyTaskCompletion: typeof import('./tab-notification').notifyTaskCompletion;
    let clearTaskNotification: typeof import('./tab-notification').clearTaskNotification;
    let flashDocumentTitle: typeof import('./tab-notification').flashDocumentTitle;

    let mockTitle = 'GPT Image Playground';
    let mockHidden = false;
    let listeners: Array<(e: Event) => void> = [];
    let intervalId = 0;

    beforeEach(() => {
        vi.useFakeTimers();
        mockTitle = 'GPT Image Playground';
        mockHidden = false;
        listeners = [];
        intervalId = 0;

        const mockDocument = {
            get title() { return mockTitle; },
            set title(v: string) { mockTitle = v; },
            get hidden() { return mockHidden; },
            set hidden(v: boolean) { mockHidden = v; },
            createElement: () => ({ id: '', rel: '', type: '', href: '', parentNode: null }),
            getElementById: () => null,
            head: { appendChild: () => {}, removeChild: () => {} },
            addEventListener: (_type: string, fn: (e: Event) => void) => listeners.push(fn),
            dispatchEvent: () => true
        };
        const mockWindow = {
            clearInterval: vi.fn(),
            setInterval: vi.fn((() => ++intervalId) as () => number) as unknown as typeof window.setInterval,
            document: mockDocument,
            Image: class MockImage {
                src = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
            }
        };

        vi.stubGlobal('document', mockDocument);
        vi.stubGlobal('window', mockWindow);
        vi.stubGlobal('Image', mockWindow.Image);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    async function loadModule() {
        vi.resetModules();
        const mod = await import('./tab-notification');
        notifyTaskCompletion = mod.notifyTaskCompletion;
        clearTaskNotification = mod.clearTaskNotification;
        flashDocumentTitle = mod.flashDocumentTitle;
        return mod;
    }

    it('starts title flash with success prefix when tab is hidden', async () => {
        await loadModule();
        mockHidden = true;
        notifyTaskCompletion({ kind: 'success' });
        expect(mockTitle).toMatch(/完成|Done|✓/);
    });

    it('starts title flash with error prefix when tab is hidden', async () => {
        await loadModule();
        mockHidden = true;
        notifyTaskCompletion({ kind: 'error' });
        expect(mockTitle).toMatch(/失败|Failed|✗/);
    });

    it('does nothing when document is visible', async () => {
        const originalTitle = mockTitle;
        await loadModule();
        notifyTaskCompletion({ kind: 'success' });
        expect(mockTitle).toBe(originalTitle);
    });

    it('clears notification and restores original title', async () => {
        await loadModule();
        mockHidden = true;
        const originalTitle = 'GPT Image Playground';
        notifyTaskCompletion({ kind: 'success' });
        expect(mockTitle).not.toBe(originalTitle);

        clearTaskNotification();
        expect(mockTitle).toBe(originalTitle);
    });

    it('clears on visibilitychange to visible', async () => {
        await loadModule();
        mockHidden = true;
        const originalTitle = 'GPT Image Playground';
        notifyTaskCompletion({ kind: 'success' });
        expect(mockTitle).not.toBe(originalTitle);

        mockHidden = false;
        for (const listener of listeners) {
            listener(new Event('visibilitychange'));
        }
        expect(mockTitle).toBe(originalTitle);
    });

    it('cancel function from flashDocumentTitle restores title', async () => {
        await loadModule();
        const originalTitle = 'GPT Image Playground';
        const cancel = flashDocumentTitle('(Test) ', 1500);
        expect(mockTitle).not.toBe(originalTitle);

        cancel();
        expect(mockTitle).toBe(originalTitle);
    });
});
