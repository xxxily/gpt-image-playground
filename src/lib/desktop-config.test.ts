import {
    buildDesktopProxyConfig,
    compareSemver,
    desktopProxyConfigFromAppConfig,
    isNewerVersion,
    isValidProxyUrl,
    normalizeDesktopProxyUrl,
    normalizeDesktopProxyMode,
} from './desktop-config';
import { DEFAULT_CONFIG } from './config';
import { describe, expect, it } from 'vitest';

describe('normalizeDesktopProxyMode', () => {
    it('accepts valid modes', () => {
        expect(normalizeDesktopProxyMode('disabled')).toBe('disabled');
        expect(normalizeDesktopProxyMode('system')).toBe('system');
        expect(normalizeDesktopProxyMode('manual')).toBe('manual');
    });

    it('defaults to disabled for unknown values', () => {
        expect(normalizeDesktopProxyMode('unknown')).toBe('disabled');
        expect(normalizeDesktopProxyMode('')).toBe('disabled');
        expect(normalizeDesktopProxyMode(42)).toBe('disabled');
        expect(normalizeDesktopProxyMode(null)).toBe('disabled');
        expect(normalizeDesktopProxyMode(undefined)).toBe('disabled');
    });
});

describe('normalizeDesktopProxyUrl', () => {
    it('keeps explicit proxy URL schemes unchanged', () => {
        expect(normalizeDesktopProxyUrl('http://127.0.0.1:7890')).toBe('http://127.0.0.1:7890');
        expect(normalizeDesktopProxyUrl('socks5h://127.0.0.1:1080')).toBe('socks5h://127.0.0.1:1080');
    });

    it('defaults bare host:port values to HTTP proxy syntax', () => {
        expect(normalizeDesktopProxyUrl('127.0.0.1:7890')).toBe('http://127.0.0.1:7890');
        expect(normalizeDesktopProxyUrl('  proxy.example.com:3128  ')).toBe('http://proxy.example.com:3128');
    });

    it('returns empty string for blank values', () => {
        expect(normalizeDesktopProxyUrl('')).toBe('');
        expect(normalizeDesktopProxyUrl('   ')).toBe('');
    });
});

describe('isValidProxyUrl', () => {
    it('accepts http and https URLs', () => {
        expect(isValidProxyUrl('http://127.0.0.1:7890')).toBe(true);
        expect(isValidProxyUrl('https://proxy.example.com:3128')).toBe(true);
        expect(isValidProxyUrl('https://proxy.example.com/path')).toBe(true);
    });

    it('accepts socks proxy URLs supported by the desktop backend', () => {
        expect(isValidProxyUrl('socks5://localhost:1080')).toBe(true);
        expect(isValidProxyUrl('socks5h://user:pass@proxy.example.com:1080')).toBe(true);
    });

    it('accepts bare host:port proxy addresses', () => {
        expect(isValidProxyUrl('127.0.0.1:7890')).toBe(true);
        expect(isValidProxyUrl('proxy.example.com:3128')).toBe(true);
    });

    it('rejects unsupported protocols', () => {
        expect(isValidProxyUrl('ftp://files.example.com')).toBe(false);
        expect(isValidProxyUrl('file:///etc/hosts')).toBe(false);
    });

    it('rejects malformed strings', () => {
        expect(isValidProxyUrl('http://')).toBe(false);
        expect(isValidProxyUrl('')).toBe(false);
        expect(isValidProxyUrl(' ')).toBe(false);
    });
});

describe('buildDesktopProxyConfig', () => {
    it('returns disabled for disabled mode', () => {
        expect(buildDesktopProxyConfig('disabled', '')).toEqual({ mode: 'disabled' });
        expect(buildDesktopProxyConfig('disabled', 'http://proxy:8080')).toEqual({ mode: 'disabled' });
    });

    it('returns system for system mode', () => {
        expect(buildDesktopProxyConfig('system', '')).toEqual({ mode: 'system' });
    });

    it('returns manual with URL for valid manual config', () => {
        expect(buildDesktopProxyConfig('manual', 'http://127.0.0.1:7890')).toEqual(
            { mode: 'manual', url: 'http://127.0.0.1:7890' }
        );
    });

    it('normalizes bare manual proxy URLs before IPC serialization', () => {
        expect(buildDesktopProxyConfig('manual', '127.0.0.1:7890')).toEqual(
            { mode: 'manual', url: 'http://127.0.0.1:7890' }
        );
    });

    it('falls back to disabled for manual with empty URL', () => {
        expect(buildDesktopProxyConfig('manual', '')).toEqual({ mode: 'disabled' });
        expect(buildDesktopProxyConfig('manual', '   ')).toEqual({ mode: 'disabled' });
    });

    it('trims whitespace from manual URLs', () => {
        expect(buildDesktopProxyConfig('manual', '  http://proxy:8080  ')).toEqual(
            { mode: 'manual', url: 'http://proxy:8080' }
        );
    });

    it('serializes in the internally tagged shape expected by Rust serde', () => {
        expect(JSON.parse(JSON.stringify(buildDesktopProxyConfig('manual', 'socks5://127.0.0.1:1080')))).toEqual(
            { mode: 'manual', url: 'socks5://127.0.0.1:1080' }
        );
    });
});

describe('compareSemver', () => {
    it('handles equal versions', () => {
        expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
        expect(compareSemver('2.3.1', '2.3.1')).toBe(0);
    });

    it('detects newer major version', () => {
        expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
        expect(compareSemver('3.0.0', '1.0.0')).toBe(1);
    });

    it('detects newer minor version', () => {
        expect(compareSemver('1.2.0', '1.3.0')).toBe(-1);
        expect(compareSemver('1.5.0', '1.2.0')).toBe(1);
    });

    it('detects newer patch version', () => {
        expect(compareSemver('1.0.2', '1.0.3')).toBe(-1);
        expect(compareSemver('1.0.9', '1.0.1')).toBe(1);
    });

    it('handles v-prefix', () => {
        expect(compareSemver('v1.0.0', 'v1.0.0')).toBe(0);
        expect(compareSemver('v1.0.0', 'v2.0.0')).toBe(-1);
    });

    it('handles different segment lengths', () => {
        expect(compareSemver('1.0', '1.0.0')).toBe(0);
        expect(compareSemver('2.0', '2.0.1')).toBe(-1);
        expect(compareSemver('1', '1.0.0')).toBe(0);
    });
});

describe('isNewerVersion', () => {
    it('returns true when latest is newer', () => {
        expect(isNewerVersion('1.0.0', '1.1.0')).toBe(true);
        expect(isNewerVersion('1.2.0', '2.0.0')).toBe(true);
    });

    it('returns false when current is same or newer', () => {
        expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
        expect(isNewerVersion('2.0.0', '1.5.0')).toBe(false);
    });
});

describe('desktopProxyConfigFromAppConfig', () => {
    it('builds disabled config from default config', () => {
        const result = desktopProxyConfigFromAppConfig(DEFAULT_CONFIG);
        expect(result).toEqual({ mode: 'disabled' });
    });

    it('builds manual config when fields are set', () => {
        const config = {
            ...DEFAULT_CONFIG,
            desktopProxyMode: 'manual' as const,
            desktopProxyUrl: 'http://127.0.0.1:7890'
        };
        expect(desktopProxyConfigFromAppConfig(config)).toEqual(
            { mode: 'manual', url: 'http://127.0.0.1:7890' }
        );
    });

    it('normalizes bare manual proxy URL from persisted config', () => {
        const config = {
            ...DEFAULT_CONFIG,
            desktopProxyMode: 'manual' as const,
            desktopProxyUrl: '127.0.0.1:7890'
        };
        expect(desktopProxyConfigFromAppConfig(config)).toEqual(
            { mode: 'manual', url: 'http://127.0.0.1:7890' }
        );
    });

    it('falls back to disabled for missing URL in manual mode', () => {
        const config = {
            ...DEFAULT_CONFIG,
            desktopProxyMode: 'manual' as const,
            desktopProxyUrl: ''
        };
        expect(desktopProxyConfigFromAppConfig(config)).toEqual({ mode: 'disabled' });
    });

    it('builds system config', () => {
        const config = {
            ...DEFAULT_CONFIG,
            desktopProxyMode: 'system' as const,
            desktopProxyUrl: ''
        };
        expect(desktopProxyConfigFromAppConfig(config)).toEqual({ mode: 'system' });
    });
});
