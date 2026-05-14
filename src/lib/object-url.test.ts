import { describe, expect, it } from 'vitest';
import { getRemovedBlobObjectUrls, isBlobObjectUrl, revokeBlobObjectUrls } from './object-url';

describe('object-url helpers', () => {
    it('detects blob object URLs only', () => {
        expect(isBlobObjectUrl('blob:http://localhost/id')).toBe(true);
        expect(isBlobObjectUrl(' BLOB:https://example.test/id ')).toBe(true);
        expect(isBlobObjectUrl('data:image/png;base64,abc')).toBe(false);
        expect(isBlobObjectUrl('https://example.test/image.png')).toBe(false);
    });

    it('returns only blob URLs that are no longer present', () => {
        expect(
            getRemovedBlobObjectUrls(
                ['blob:http://localhost/1', 'blob:http://localhost/2', 'data:image/png;base64,abc'],
                ['blob:http://localhost/1', 'blob:http://localhost/3', 'data:image/png;base64,abc'],
            ),
        ).toEqual(['blob:http://localhost/2']);
    });

    it('preserves retained duplicate blob URLs by count', () => {
        expect(
            getRemovedBlobObjectUrls(
                ['blob:http://localhost/1', 'blob:http://localhost/1'],
                ['blob:http://localhost/1'],
            ),
        ).toEqual(['blob:http://localhost/1']);
    });

    it('revokes each removed blob URL once and ignores non-blob URLs', () => {
        const revoked: string[] = [];

        revokeBlobObjectUrls(
            ['blob:http://localhost/1', 'data:image/png;base64,abc', 'blob:http://localhost/1'],
            (url) => revoked.push(url),
        );

        expect(revoked).toEqual(['blob:http://localhost/1']);
    });
});
