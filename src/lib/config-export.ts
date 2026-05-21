// Config import/export (§8.5). Wraps the localStorage app-config dump with
// schema versioning, optional secret masking, and backward-compatible
// validation for older exports. Pure: no DOM, no fetch.

export const CONFIG_SCHEMA_VERSION = 1;

const SECRET_PATTERN = /(api[_-]?key|secret|password|access[_-]?key|accesssecret)/i;
const MASKED_PLACEHOLDER = '<<masked>>';

export interface ExportedConfig {
    schemaVersion: number;
    exportedAt: string;
    includesSecrets: boolean;
    config: Record<string, unknown>;
}

export interface ImportValidationOk {
    ok: true;
    config: Record<string, unknown>;
    schemaVersion: number;
    includesSecrets: boolean;
    warnings: string[];
}

export interface ImportValidationError {
    ok: false;
    error: string;
}

export function maskSecrets(config: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
        if (SECRET_PATTERN.test(key) && typeof value === 'string' && value.length > 0) {
            masked[key] = MASKED_PLACEHOLDER;
        } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            masked[key] = maskSecrets(value as Record<string, unknown>);
        } else {
            masked[key] = value;
        }
    }
    return masked;
}

export function buildExportedConfig(opts: {
    config: Record<string, unknown>;
    includeSecrets: boolean;
}): ExportedConfig {
    return {
        schemaVersion: CONFIG_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        includesSecrets: opts.includeSecrets,
        config: opts.includeSecrets ? opts.config : maskSecrets(opts.config)
    };
}

export function validateImportedConfig(raw: unknown): ImportValidationOk | ImportValidationError {
    if (!raw || typeof raw !== 'object') {
        return { ok: false, error: 'invalidJson' };
    }
    const record = raw as Record<string, unknown>;
    const version = record.schemaVersion;
    if (typeof version !== 'number' || !Number.isInteger(version)) {
        return { ok: false, error: 'invalidSchema' };
    }
    if (version > CONFIG_SCHEMA_VERSION) {
        return { ok: false, error: 'invalidSchema' };
    }
    const config = record.config;
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return { ok: false, error: 'invalidSchema' };
    }
    const includesSecrets = record.includesSecrets === true;
    const warnings: string[] = [];
    if (version < CONFIG_SCHEMA_VERSION) {
        warnings.push(`schema v${version} → v${CONFIG_SCHEMA_VERSION}`);
    }
    const filtered = stripMaskedValues(config as Record<string, unknown>);
    return { ok: true, config: filtered, schemaVersion: version, includesSecrets, warnings };
}

function stripMaskedValues(config: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
        if (value === MASKED_PLACEHOLDER) continue;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            out[key] = stripMaskedValues(value as Record<string, unknown>);
        } else {
            out[key] = value;
        }
    }
    return out;
}

export function triggerJsonDownload(filename: string, payload: unknown): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    try {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.warn('[config-export] download failed', err);
    }
}
