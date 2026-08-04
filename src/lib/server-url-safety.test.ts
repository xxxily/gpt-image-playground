import { isPublicNetworkAddress, validatePublicHttpBaseUrl } from './server-url-safety';
import { describe, expect, it } from 'vitest';

describe('validatePublicHttpBaseUrl', () => {
    it('allows public http and https API endpoints', () => {
        expect(validatePublicHttpBaseUrl('https://api.example.com/v1')).toEqual({
            ok: true,
            normalizedUrl: 'https://api.example.com/v1'
        });
        expect(validatePublicHttpBaseUrl('relay.example.com/v1')).toEqual({
            ok: true,
            normalizedUrl: 'https://relay.example.com/v1'
        });
    });

    it('rejects non-http protocols and embedded credentials', () => {
        expect(validatePublicHttpBaseUrl('file:///etc/passwd').ok).toBe(false);
        expect(validatePublicHttpBaseUrl('https://user:pass@api.example.com/v1').ok).toBe(false);
    });

    it('rejects localhost and metadata hostnames', () => {
        expect(validatePublicHttpBaseUrl('http://localhost:3000/v1').ok).toBe(false);
        expect(validatePublicHttpBaseUrl('http://localhost.:3000/v1').ok).toBe(false);
        expect(validatePublicHttpBaseUrl('http://metadata.google.internal/v1').ok).toBe(false);
    });

    it('rejects private, loopback, link-local, and reserved IPv4 ranges', () => {
        expect(validatePublicHttpBaseUrl('http://127.0.0.1/v1').ok).toBe(false);
        expect(validatePublicHttpBaseUrl('http://10.0.0.5/v1').ok).toBe(false);
        expect(validatePublicHttpBaseUrl('http://172.16.0.5/v1').ok).toBe(false);
        expect(validatePublicHttpBaseUrl('http://192.168.1.10/v1').ok).toBe(false);
        expect(validatePublicHttpBaseUrl('http://169.254.169.254/v1').ok).toBe(false);
        expect(validatePublicHttpBaseUrl('http://224.0.0.1/v1').ok).toBe(false);
        expect(validatePublicHttpBaseUrl('http://198.18.0.1/v1').ok).toBe(false);
        expect(validatePublicHttpBaseUrl('http://203.0.113.10/v1').ok).toBe(false);
    });

    it('rejects loopback and private IPv6 ranges', () => {
        expect(validatePublicHttpBaseUrl('http://[::1]/v1').ok).toBe(false);
        expect(validatePublicHttpBaseUrl('http://[fe80::1]/v1').ok).toBe(false);
        expect(validatePublicHttpBaseUrl('http://[fd00::1]/v1').ok).toBe(false);
        expect(validatePublicHttpBaseUrl('http://[2001:db8::1]/v1').ok).toBe(false);
    });

    it('identifies only globally routable literal addresses as public', () => {
        expect(isPublicNetworkAddress('8.8.8.8')).toBe(true);
        expect(isPublicNetworkAddress('2606:4700:4700::1111')).toBe(true);
        expect(isPublicNetworkAddress('192.0.2.1')).toBe(false);
        expect(isPublicNetworkAddress('::ffff:127.0.0.1')).toBe(false);
        expect(isPublicNetworkAddress('not-an-ip')).toBe(false);
    });
});
