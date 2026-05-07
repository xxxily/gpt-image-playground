import { formatClientDirectLinkRestriction } from './connection-policy';
import { DESKTOP_APP_GUIDANCE_MESSAGE } from './desktop-guidance';
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

    it('adds desktop app guidance to direct-link priority restriction messages', () => {
        const message = formatClientDirectLinkRestriction({
            provider: 'openai',
            source: 'ENV',
            url: 'https://relay.example.com/v1'
        });

        expect(message).toContain('服务器中转不可用');
        expect(message).toContain(DESKTOP_APP_GUIDANCE_MESSAGE);
    });
});
