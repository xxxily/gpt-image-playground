import {
    getClipboardImageFiles,
    getClipboardImageSources,
    getClipboardText,
    isImageFileLike
} from './clipboard-images';
import { describe, expect, it } from 'vitest';

function createClipboardDataTransfer(options: {
    files?: File[];
    items?: Array<{ kind: string; type: string; file: File | null }>;
    data?: Record<string, string>;
}): Pick<DataTransfer, 'items' | 'files' | 'getData'> {
    return {
        items: (options.items ?? []).map((item) => ({
            kind: item.kind,
            type: item.type,
            getAsFile: () => item.file
        })) as unknown as DataTransferItemList,
        files: (options.files ?? []) as unknown as FileList,
        getData: (type: string) => options.data?.[type] ?? ''
    };
}

describe('clipboard image helpers', () => {
    it('accepts image files with an empty mime type when the filename is image-like', () => {
        expect(isImageFileLike(new File(['x'], 'clipboard.png', { type: '' }))).toBe(true);
        expect(isImageFileLike(new File(['x'], 'clipboard.txt', { type: '' }))).toBe(false);
    });

    it('collects image files from clipboard items and files', () => {
        const itemFile = new File(['a'], 'item.png', { type: 'image/png' });
        const itemWithEmptyType = new File(['b'], 'item.webp', { type: '' });
        const fileListFile = new File(['c'], 'file.webp', { type: '' });
        const duplicateFile = new File(['a'], 'item.png', { type: 'image/png' });

        const dataTransfer = createClipboardDataTransfer({
            items: [
                { kind: 'file', type: 'image/png', file: itemFile },
                { kind: 'file', type: 'image/png', file: duplicateFile },
                { kind: 'file', type: 'image/webp', file: itemWithEmptyType },
                { kind: 'file', type: 'text/plain', file: null }
            ],
            files: [fileListFile, duplicateFile]
        });

        expect(getClipboardImageFiles(dataTransfer)).toEqual([itemFile, itemWithEmptyType, fileListFile]);
    });

    it('extracts image sources from clipboard html fragments', () => {
        const dataTransfer = createClipboardDataTransfer({
            data: {
                'text/html': '<img src="https://example.com/image.png" alt="preview">',
                'text/plain': '<img src="https://example.com/image.png" alt="preview">'
            }
        });

        expect(getClipboardImageSources(dataTransfer)).toEqual(['https://example.com/image.png']);
    });

    it('prefers the first non-empty clipboard text value', () => {
        const dataTransfer = createClipboardDataTransfer({
            data: {
                'text/plain': '',
                text: 'hello world',
                'text/uri-list': 'https://example.com/image.png'
            }
        });

        expect(getClipboardText(dataTransfer)).toBe('hello world');
    });
});
