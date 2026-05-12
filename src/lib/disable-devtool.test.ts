import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { buildShareUrl } from './url-params';
import {
    getDisableDevtoolScope,
    isShareEntryUrl,
    shouldEnableDisableDevtoolForUrl
} from './disable-devtool';

describe('disable-devtool scope helpers', () => {
    const originalScope = process.env.NEXT_PUBLIC_DISABLE_DEVTOOL_SCOPE;

    beforeEach(() => {
        delete process.env.NEXT_PUBLIC_DISABLE_DEVTOOL_SCOPE;
    });

    afterEach(() => {
        if (originalScope === undefined) {
            delete process.env.NEXT_PUBLIC_DISABLE_DEVTOOL_SCOPE;
        } else {
            process.env.NEXT_PUBLIC_DISABLE_DEVTOOL_SCOPE = originalScope;
        }
    });

    it('defaults to none and normalizes supported values', () => {
        expect(getDisableDevtoolScope()).toBe('none');
        expect(getDisableDevtoolScope('ALL')).toBe('all');
        expect(getDisableDevtoolScope('share')).toBe('share');
        expect(getDisableDevtoolScope('invalid')).toBe('none');
    });

    it('detects share-entry urls from plain share params and secure payloads', () => {
        const plainShareUrl = buildShareUrl('https://example.com/', {
            prompt: 'hello world',
            model: 'gpt-image-2'
        });

        expect(isShareEntryUrl(new URL(plainShareUrl).search)).toBe(true);
        expect(isShareEntryUrl('?sdata=opaque')).toBe(true);
        expect(isShareEntryUrl('?promoProfileId=promo-profile-1')).toBe(true);
        expect(isShareEntryUrl('?foo=bar')).toBe(false);
    });

    it('only enables the deterrence on the configured scope', () => {
        const shareUrl = buildShareUrl('https://example.com/', {
            prompt: 'hello world',
            model: 'gpt-image-2'
        });

        expect(shouldEnableDisableDevtoolForUrl(shareUrl, 'none')).toBe(false);
        expect(shouldEnableDisableDevtoolForUrl('https://example.com/', 'share')).toBe(false);
        expect(shouldEnableDisableDevtoolForUrl(shareUrl, 'share')).toBe(true);
        expect(shouldEnableDisableDevtoolForUrl('https://example.com/', 'all')).toBe(true);
    });
});
