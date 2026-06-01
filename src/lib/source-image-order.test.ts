import { describe, expect, it } from 'vitest';

import { moveSourceImageItem, reorderSourceImageSelection } from './source-image-order';

describe('source image ordering', () => {
    it('moves a source image item forward', () => {
        expect(moveSourceImageItem(['a', 'b', 'c', 'd'], 1, 3)).toEqual(['a', 'c', 'd', 'b']);
    });

    it('moves a source image item backward', () => {
        expect(moveSourceImageItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    });

    it('keeps file and preview order aligned', () => {
        const result = reorderSourceImageSelection(['file-1', 'file-2', 'file-3'], ['url-1', 'url-2', 'url-3'], 0, 2);

        expect(result.files).toEqual(['file-2', 'file-3', 'file-1']);
        expect(result.previewUrls).toEqual(['url-2', 'url-3', 'url-1']);
    });

    it('returns copied arrays for invalid indices without changing order', () => {
        const files = ['file-1', 'file-2'];
        const previews = ['url-1', 'url-2'];
        const result = reorderSourceImageSelection(files, previews, -1, 1);

        expect(result.files).toEqual(files);
        expect(result.previewUrls).toEqual(previews);
        expect(result.files).not.toBe(files);
        expect(result.previewUrls).not.toBe(previews);
    });
});
