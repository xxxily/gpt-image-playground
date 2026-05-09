import { afterEach, describe, expect, it } from 'vitest';
import { formatS3ServerRelayBlockedMessage, isS3ServerRelayAllowed } from '@/lib/s3-server';

const originalClientDirectLinkPriority = process.env.CLIENT_DIRECT_LINK_PRIORITY;
const originalPublicClientDirectLinkPriority = process.env.NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY;

afterEach(() => {
    if (originalClientDirectLinkPriority === undefined) {
        delete process.env.CLIENT_DIRECT_LINK_PRIORITY;
    } else {
        process.env.CLIENT_DIRECT_LINK_PRIORITY = originalClientDirectLinkPriority;
    }

    if (originalPublicClientDirectLinkPriority === undefined) {
        delete process.env.NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY;
    } else {
        process.env.NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY = originalPublicClientDirectLinkPriority;
    }
});

describe('S3 server relay policy', () => {
    it('allows server relay by default', () => {
        delete process.env.CLIENT_DIRECT_LINK_PRIORITY;
        delete process.env.NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY;

        expect(isS3ServerRelayAllowed()).toBe(true);
    });

    it('blocks server relay when direct link priority is enabled', () => {
        process.env.CLIENT_DIRECT_LINK_PRIORITY = 'true';
        delete process.env.NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY;

        expect(isS3ServerRelayAllowed()).toBe(false);
        expect(formatS3ServerRelayBlockedMessage()).toContain('云存储服务器中转不可用');
        expect(formatS3ServerRelayBlockedMessage()).toContain('桌面端');
    });
});
