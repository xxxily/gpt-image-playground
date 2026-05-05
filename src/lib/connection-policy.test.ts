import { formatClientDirectLinkRestriction } from './connection-policy';
import { describe, expect, it } from 'vitest';

describe('connection policy', () => {
    it('redacts credentials, query, and hash fragments from direct-link restriction messages', () => {
        const message = formatClientDirectLinkRestriction({
            provider: 'seedream',
            source: 'UI',
            url: 'https://user:secret@example.com/v1/images?token=hidden#fragment'
        });

        expect(message).toContain('https://example.com/v1/images');
        expect(message).not.toContain('user');
        expect(message).not.toContain('secret');
        expect(message).not.toContain('token=hidden');
        expect(message).not.toContain('fragment');
    });
});
