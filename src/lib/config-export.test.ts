import { describe, expect, it } from 'vitest';
import { CONFIG_SCHEMA_VERSION, buildExportedConfig, maskSecrets, validateImportedConfig } from './config-export';

describe('maskSecrets', () => {
    it('masks api keys and passwords', () => {
        const masked = maskSecrets({ openaiApiKey: 'sk-1', apiKey: 'sk-2', s3Secret: 'shh', name: 'plain' });
        expect(masked.openaiApiKey).toBe('<<masked>>');
        expect(masked.apiKey).toBe('<<masked>>');
        expect(masked.s3Secret).toBe('<<masked>>');
        expect(masked.name).toBe('plain');
    });

    it('recurses into nested objects', () => {
        const masked = maskSecrets({ provider: { api_key: 'sk', label: 'main' } });
        expect((masked.provider as Record<string, unknown>).api_key).toBe('<<masked>>');
        expect((masked.provider as Record<string, unknown>).label).toBe('main');
    });

    it('does not mask empty strings', () => {
        const masked = maskSecrets({ openaiApiKey: '' });
        expect(masked.openaiApiKey).toBe('');
    });
});

describe('buildExportedConfig', () => {
    it('includes secrets when includeSecrets=true', () => {
        const exported = buildExportedConfig({ config: { openaiApiKey: 'sk-1' }, includeSecrets: true });
        expect(exported.schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
        expect(exported.includesSecrets).toBe(true);
        expect(exported.config.openaiApiKey).toBe('sk-1');
    });

    it('masks secrets when includeSecrets=false', () => {
        const exported = buildExportedConfig({ config: { openaiApiKey: 'sk-1' }, includeSecrets: false });
        expect(exported.config.openaiApiKey).toBe('<<masked>>');
    });
});

describe('validateImportedConfig', () => {
    it('rejects non-object', () => {
        const r = validateImportedConfig('not-an-object');
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toBe('invalidJson');
    });

    it('rejects missing schemaVersion', () => {
        const r = validateImportedConfig({ config: {} });
        expect(r.ok).toBe(false);
    });

    it('rejects future schemaVersion', () => {
        const r = validateImportedConfig({ schemaVersion: CONFIG_SCHEMA_VERSION + 1, config: {} });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toBe('invalidSchema');
    });

    it('strips masked sentinel values', () => {
        const r = validateImportedConfig({
            schemaVersion: CONFIG_SCHEMA_VERSION,
            includesSecrets: false,
            config: { openaiApiKey: '<<masked>>', baseUrl: 'https://api.example.com' }
        });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.config).toEqual({ baseUrl: 'https://api.example.com' });
            expect(r.includesSecrets).toBe(false);
        }
    });

    it('accepts older schemaVersion with a warning', () => {
        const r = validateImportedConfig({ schemaVersion: 0 as number, config: {} });
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.warnings.length).toBeGreaterThan(0);
    });
});
