export const PROMO_SLOT_DEFINITIONS = [
    {
        key: 'generation_form_header',
        name: '生成区头部',
        description: '输入/编辑卡片头部右侧',
        defaultIntervalMs: 5000,
        defaultTransition: 'fade'
    },
    {
        key: 'app_top_banner',
        name: '页面顶部',
        description: 'Logo 下方横幅',
        defaultIntervalMs: 5000,
        defaultTransition: 'fade'
    },
    {
        key: 'history_top_banner',
        name: '历史面板上方',
        description: '历史区横幅',
        defaultIntervalMs: 5000,
        defaultTransition: 'fade'
    }
] as const;

export const PROMO_TRANSITIONS = ['fade', 'slide', 'none'] as const;
export type PromoTransition = (typeof PROMO_TRANSITIONS)[number];

export const PROMO_DEVICE_VALUES = ['all', 'desktop', 'mobile'] as const;
export type PromoDevice = (typeof PROMO_DEVICE_VALUES)[number];

export const PROMO_ASPECT_RATIO_SOURCES = ['preset', 'custom', 'legacySlot'] as const;
export type PromoAspectRatioSource = (typeof PROMO_ASPECT_RATIO_SOURCES)[number];

export const PROMO_CONSTRAINT_SET_VERSION = 1;
export const PROMO_CONSTRAINT_LOGIC_VALUES = ['all'] as const;
export type PromoConstraintLogic = (typeof PROMO_CONSTRAINT_LOGIC_VALUES)[number];

export const PROMO_CONSTRAINT_TYPES = ['domain'] as const;
export type KnownPromoConstraintType = (typeof PROMO_CONSTRAINT_TYPES)[number];

export type PromoConstraint<TType extends string = string, TPayload = unknown> = {
    id: string;
    type: TType;
    enabled: boolean;
    label: string;
    summary: string;
    payload: TPayload;
};

export type PromoConstraintSet = {
    version: typeof PROMO_CONSTRAINT_SET_VERSION;
    logic: PromoConstraintLogic;
    constraints: PromoConstraint[];
};

export type PromoConstraintChip = {
    id: string;
    type: string;
    label: string;
    summary: string;
    severity?: 'normal' | 'warning';
};

export type PromoConstraintMatchStrength = 'all' | 'wildcard' | 'exact';

export type PromoConstraintEvaluationContext = {
    now?: Date;
    requestHost?: string | null;
    device?: PromoDevice;
    surface?: string | null;
    promoProfileId?: string | null;
    locale?: string | null;
    runtime?: 'web' | 'tauri-desktop' | 'tauri-mobile' | 'unknown';
};

export type PromoConstraintEvaluationResult = {
    matches: boolean;
    strength: number;
    strengthLabel: PromoConstraintMatchStrength;
    summary: string;
};

export const PROMO_DOMAIN_CONSTRAINT_ID = 'domain';
export const PROMO_MAX_DOMAIN_RULES = 50;
export const PROMO_MAX_DOMAIN_RULE_LENGTH = 253;

export type PromoDomainConstraintMode = 'all' | 'allowlist';

export type PromoAllowedDomainRule = {
    type: 'exact' | 'wildcard';
    host: string;
    port: number | null;
    label: string;
};

export type PromoDomainConstraintPayload = {
    mode: PromoDomainConstraintMode;
    rules: PromoAllowedDomainRule[];
};

export type PromoDomainRuleParseResult = {
    rules: PromoAllowedDomainRule[];
    errors: string[];
};

export type PromoAspectRatio = {
    width: number;
    height: number;
    label: string;
    source: PromoAspectRatioSource;
};

export type PromoAspectRatioPresetGroup =
    | 'square'
    | 'portrait'
    | 'landscape'
    | 'shareCard'
    | 'banner'
    | 'ultraWide';

export type PromoAspectRatioPreset = {
    id: string;
    label: string;
    width: number;
    height: number;
    group: PromoAspectRatioPresetGroup;
    recommendedSlots?: readonly string[];
};

export type PromoSlotKey = (typeof PROMO_SLOT_DEFINITIONS)[number]['key'];

export const PROMO_MAX_ASPECT_RATIO_EDGE = 20;

export const PROMO_ASPECT_RATIO_PRESETS = [
    { id: '1-1', label: '1:1', width: 1, height: 1, group: 'square' },
    { id: '4-5', label: '4:5', width: 4, height: 5, group: 'portrait' },
    { id: '3-4', label: '3:4', width: 3, height: 4, group: 'portrait' },
    { id: '2-3', label: '2:3', width: 2, height: 3, group: 'portrait' },
    { id: '9-16', label: '9:16', width: 9, height: 16, group: 'portrait' },
    { id: '5-4', label: '5:4', width: 5, height: 4, group: 'landscape' },
    { id: '4-3', label: '4:3', width: 4, height: 3, group: 'landscape' },
    { id: '3-2', label: '3:2', width: 3, height: 2, group: 'landscape' },
    { id: '16-9', label: '16:9', width: 16, height: 9, group: 'landscape' },
    { id: '191-100', label: '1.91:1', width: 191, height: 100, group: 'shareCard' },
    { id: '2-1', label: '2:1', width: 2, height: 1, group: 'shareCard' },
    {
        id: '3-1',
        label: '3:1',
        width: 3,
        height: 1,
        group: 'banner',
        recommendedSlots: ['app_top_banner', 'history_top_banner']
    },
    {
        id: '4-1',
        label: '4:1',
        width: 4,
        height: 1,
        group: 'banner',
        recommendedSlots: ['generation_form_header']
    },
    {
        id: '5-1',
        label: '5:1',
        width: 5,
        height: 1,
        group: 'banner',
        recommendedSlots: ['app_top_banner', 'history_top_banner']
    },
    {
        id: '10-1',
        label: '10:1',
        width: 10,
        height: 1,
        group: 'banner',
        recommendedSlots: ['app_top_banner', 'history_top_banner']
    },
    { id: '21-9', label: '21:9', width: 21, height: 9, group: 'ultraWide' },
    {
        id: '12-1',
        label: '12:1',
        width: 12,
        height: 1,
        group: 'ultraWide',
        recommendedSlots: ['app_top_banner', 'history_top_banner']
    }
] as const satisfies readonly PromoAspectRatioPreset[];

function gcd(a: number, b: number): number {
    let x = Math.abs(Math.trunc(a));
    let y = Math.abs(Math.trunc(b));
    while (y !== 0) {
        const next = x % y;
        x = y;
        y = next;
    }
    return x || 1;
}

function simplifyRatio(width: number, height: number): { width: number; height: number } | null {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    const roundedWidth = Math.round(width);
    const roundedHeight = Math.round(height);
    const divisor = gcd(roundedWidth, roundedHeight);
    const simplifiedWidth = roundedWidth / divisor;
    const simplifiedHeight = roundedHeight / divisor;
    const edgeRatio = Math.max(simplifiedWidth, simplifiedHeight) / Math.min(simplifiedWidth, simplifiedHeight);
    if (edgeRatio > PROMO_MAX_ASPECT_RATIO_EDGE) return null;
    return { width: simplifiedWidth, height: simplifiedHeight };
}

function findPresetByDimensions(width: number, height: number): PromoAspectRatioPreset | null {
    return PROMO_ASPECT_RATIO_PRESETS.find((preset) => preset.width === width && preset.height === height) || null;
}

export function formatPromoAspectRatioLabel(width: number, height: number): string {
    const preset = findPresetByDimensions(width, height);
    return preset?.label || `${width}:${height}`;
}

export function normalizePromoAspectRatio(
    width: number,
    height: number,
    source: PromoAspectRatioSource = 'custom'
): PromoAspectRatio | null {
    const simplified = simplifyRatio(width, height);
    if (!simplified) return null;
    return {
        width: simplified.width,
        height: simplified.height,
        label: formatPromoAspectRatioLabel(simplified.width, simplified.height),
        source
    };
}

export function parsePromoAspectRatio(
    value: string | null | undefined,
    source: PromoAspectRatioSource = 'custom'
): PromoAspectRatio | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/u);
    if (!match) return null;
    const widthText = match[1];
    const heightText = match[2];
    const widthPart = Number(widthText);
    const heightPart = Number(heightText);
    if (!Number.isFinite(widthPart) || !Number.isFinite(heightPart) || widthPart <= 0 || heightPart <= 0) return null;
    const widthDecimals = widthText.includes('.') ? widthText.split('.')[1]?.length || 0 : 0;
    const heightDecimals = heightText.includes('.') ? heightText.split('.')[1]?.length || 0 : 0;
    const scale = 10 ** Math.max(widthDecimals, heightDecimals);
    const normalizedWidth = Math.round(widthPart * scale);
    const normalizedHeight = Math.round(heightPart * scale);
    return normalizePromoAspectRatio(normalizedWidth, normalizedHeight, source);
}

export function serializePromoAspectRatioCss(aspectRatio: PromoAspectRatio | null | undefined): string {
    if (!aspectRatio || aspectRatio.width <= 0 || aspectRatio.height <= 0) return '4 / 1';
    return `${aspectRatio.width} / ${aspectRatio.height}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function normalizeConstraintText(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeConstraintEnabled(value: unknown): boolean {
    return typeof value === 'boolean' ? value : true;
}

export function createEmptyPromoConstraintSet(): PromoConstraintSet {
    return {
        version: PROMO_CONSTRAINT_SET_VERSION,
        logic: 'all',
        constraints: []
    };
}

function normalizePromoConstraint(value: unknown): PromoConstraint | null {
    const record = asRecord(value);
    if (!record) return null;
    const type = normalizeConstraintText(record.type);
    if (!type) return null;
    const id = normalizeConstraintText(record.id, type) || type;
    const label = normalizeConstraintText(record.label, type);
    const summary = normalizeConstraintText(record.summary, label);
    return {
        id,
        type,
        enabled: normalizeConstraintEnabled(record.enabled),
        label,
        summary,
        payload: record.payload
    };
}

export function normalizePromoConstraintSet(value: unknown): PromoConstraintSet | null {
    if (value === null || value === undefined || value === '') return createEmptyPromoConstraintSet();
    const record = asRecord(value);
    if (!record) return null;
    const logic = record.logic === 'all' ? 'all' : null;
    if (!logic) return null;
    const rawConstraints = Array.isArray(record.constraints) ? record.constraints : [];
    const constraints = rawConstraints.map(normalizePromoConstraint).filter((item): item is PromoConstraint => Boolean(item));
    return {
        version: PROMO_CONSTRAINT_SET_VERSION,
        logic,
        constraints
    };
}

export function parsePromoConstraintSetJson(value: string | null | undefined): PromoConstraintSet | null {
    const trimmed = value?.trim();
    if (!trimmed) return createEmptyPromoConstraintSet();
    try {
        return normalizePromoConstraintSet(JSON.parse(trimmed));
    } catch {
        return null;
    }
}

export function serializePromoConstraintSet(set: PromoConstraintSet | null | undefined): string | null {
    const normalized = normalizePromoConstraintSet(set);
    if (!normalized || normalized.constraints.length === 0) return null;
    return JSON.stringify(normalized);
}

export function normalizePromoConstraintSetForStorage(
    set: PromoConstraintSet | string | null | undefined
): PromoConstraintSet | null {
    const normalized = typeof set === 'string' ? parsePromoConstraintSetJson(set) : normalizePromoConstraintSet(set);
    if (!normalized) return null;

    const constraints: PromoConstraint[] = [];
    for (const constraint of normalized.constraints) {
        if (constraint.type === 'domain') {
            const payload = normalizePromoDomainConstraintPayload(constraint.payload);
            if (!payload) return null;
            const domainConstraint = createPromoDomainConstraint(payload);
            if (domainConstraint) constraints.push({ ...domainConstraint, enabled: constraint.enabled });
            continue;
        }
        constraints.push(constraint);
    }

    return {
        ...normalized,
        constraints
    };
}

export function serializePromoConstraintSetForStorage(set: PromoConstraintSet | string | null | undefined): string | null {
    const normalized = normalizePromoConstraintSetForStorage(set);
    if (!normalized || normalized.constraints.length === 0) return null;
    return JSON.stringify(normalized);
}

function splitDomainRuleInput(value: string): string[] {
    return value
        .split(/[\s,]+/u)
        .map((item) => item.trim())
        .filter(Boolean);
}

function stripTrailingDot(value: string): string {
    return value.endsWith('.') ? value.slice(0, -1) : value;
}

function normalizeHostForRule(hostname: string): string {
    return stripTrailingDot(hostname.trim().toLowerCase().replace(/^\[|\]$/gu, ''));
}

function parsePort(value: string): number | null {
    if (!value) return null;
    const port = Number(value);
    return Number.isInteger(port) && port > 0 && port <= 65535 ? port : NaN;
}

function labelForDomainRule(type: PromoAllowedDomainRule['type'], host: string, port: number | null): string {
    const prefix = type === 'wildcard' ? '*.' : '';
    return `${prefix}${host}${port ? `:${port}` : ''}`;
}

function parseExactDomainRule(rawInput: string): PromoAllowedDomainRule | string {
    const input = rawInput.trim();
    if (!input || input.length > PROMO_MAX_DOMAIN_RULE_LENGTH) return '域名规则长度不合法。';
    let parsed: URL;
    try {
        parsed = new URL(input.includes('://') ? input : `https://${input}`);
    } catch {
        return `域名规则不合法：${input}`;
    }
    if (parsed.username || parsed.password) return `域名规则不能包含用户名或密码：${input}`;
    const host = normalizeHostForRule(parsed.hostname);
    if (!host) return `域名规则缺少主机名：${input}`;
    if (host.includes('*')) return `通配符只能写成 *.example.com：${input}`;
    const port = parsePort(parsed.port);
    if (Number.isNaN(port)) return `端口不合法：${input}`;
    return {
        type: 'exact',
        host,
        port,
        label: labelForDomainRule('exact', host, port)
    };
}

function parseWildcardDomainRule(rawInput: string): PromoAllowedDomainRule | string {
    const input = rawInput.trim();
    if (!input || input.length > PROMO_MAX_DOMAIN_RULE_LENGTH) return '域名规则长度不合法。';
    const withoutProtocol = input.replace(/^[a-z][a-z\d+.-]*:\/\//iu, '');
    const authority = withoutProtocol.split(/[/?#]/u)[0] || '';
    if (authority.includes('@')) return `域名规则不能包含用户名或密码：${input}`;
    if (!authority.startsWith('*.')) return `通配符只能写成 *.example.com：${input}`;
    const baseAuthority = authority.slice(2);
    let parsed: URL;
    try {
        parsed = new URL(`https://${baseAuthority}`);
    } catch {
        return `域名规则不合法：${input}`;
    }
    const host = normalizeHostForRule(parsed.hostname);
    if (!host || host.includes('*')) return `域名规则不合法：${input}`;
    if (host.split('.').filter(Boolean).length < 2) return `通配域名范围过宽：${input}`;
    const port = parsePort(parsed.port);
    if (Number.isNaN(port)) return `端口不合法：${input}`;
    return {
        type: 'wildcard',
        host,
        port,
        label: labelForDomainRule('wildcard', host, port)
    };
}

export function parsePromoDomainRule(rawInput: string): PromoAllowedDomainRule | string {
    const trimmed = rawInput.trim();
    if (!trimmed) return '域名规则不能为空。';
    const normalizedForWildcard = trimmed.replace(/^[a-z][a-z\d+.-]*:\/\//iu, '');
    return normalizedForWildcard.startsWith('*.') ? parseWildcardDomainRule(trimmed) : parseExactDomainRule(trimmed);
}

export function parsePromoDomainRulesInput(value: string): PromoDomainRuleParseResult {
    const errors: string[] = [];
    const rules: PromoAllowedDomainRule[] = [];
    const seen = new Set<string>();
    for (const rawRule of splitDomainRuleInput(value)) {
        const parsed = parsePromoDomainRule(rawRule);
        if (typeof parsed === 'string') {
            errors.push(parsed);
            continue;
        }
        const key = `${parsed.type}:${parsed.host}:${parsed.port ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rules.push(parsed);
    }
    if (rules.length > PROMO_MAX_DOMAIN_RULES) {
        errors.push(`每个展示组最多保存 ${PROMO_MAX_DOMAIN_RULES} 条域名规则。`);
    }
    return {
        rules: rules.slice(0, PROMO_MAX_DOMAIN_RULES),
        errors
    };
}

function normalizeAllowedDomainRule(value: unknown): PromoAllowedDomainRule | null {
    const record = asRecord(value);
    if (!record) return null;
    const type = record.type === 'wildcard' ? 'wildcard' : record.type === 'exact' ? 'exact' : null;
    const host = normalizeHostForRule(typeof record.host === 'string' ? record.host : '');
    const rawPort = record.port === null || record.port === undefined || record.port === '' ? null : Number(record.port);
    const port = rawPort === null ? null : Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : NaN;
    if (!type || !host || Number.isNaN(port)) return null;
    if (host.includes('*') || host.length > PROMO_MAX_DOMAIN_RULE_LENGTH) return null;
    if (type === 'wildcard' && host.split('.').filter(Boolean).length < 2) return null;
    return {
        type,
        host,
        port,
        label: labelForDomainRule(type, host, port)
    };
}

export function normalizePromoDomainConstraintPayload(value: unknown): PromoDomainConstraintPayload | null {
    const record = asRecord(value);
    if (!record) return null;
    const mode = record.mode === 'allowlist' ? 'allowlist' : record.mode === 'all' ? 'all' : null;
    if (!mode) return null;
    const rules = Array.isArray(record.rules)
        ? record.rules.map(normalizeAllowedDomainRule).filter((rule): rule is PromoAllowedDomainRule => Boolean(rule))
        : [];
    if (mode === 'allowlist' && rules.length === 0) return null;
    return { mode, rules };
}

export function summarizePromoDomainConstraint(payload: PromoDomainConstraintPayload): string {
    if (payload.mode === 'all') return 'all';
    const labels = payload.rules.map((rule) => rule.label);
    if (labels.length <= 2) return labels.join(', ');
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}

export function createPromoDomainConstraint(payload: PromoDomainConstraintPayload): PromoConstraint<'domain', PromoDomainConstraintPayload> | null {
    const normalized = normalizePromoDomainConstraintPayload(payload);
    if (!normalized || normalized.mode === 'all') return null;
    return {
        id: PROMO_DOMAIN_CONSTRAINT_ID,
        type: 'domain',
        enabled: true,
        label: '显示域名',
        summary: summarizePromoDomainConstraint(normalized),
        payload: normalized
    };
}

export function getPromoDomainConstraint(set: PromoConstraintSet | string | null | undefined): PromoConstraint<'domain', PromoDomainConstraintPayload> | null {
    const normalized = typeof set === 'string' ? parsePromoConstraintSetJson(set) : normalizePromoConstraintSet(set);
    if (!normalized) return null;
    const constraint = normalized.constraints.find((item) => item.enabled && item.type === 'domain');
    const payload = normalizePromoDomainConstraintPayload(constraint?.payload);
    if (!constraint || !payload) return null;
    return {
        ...constraint,
        type: 'domain',
        summary: summarizePromoDomainConstraint(payload),
        payload
    };
}

export function updatePromoConstraintSetDomain(
    existing: PromoConstraintSet | string | null | undefined,
    payload: PromoDomainConstraintPayload
): PromoConstraintSet | null {
    const normalized = typeof existing === 'string' ? parsePromoConstraintSetJson(existing) : normalizePromoConstraintSet(existing);
    if (!normalized) return null;
    const domainConstraint = createPromoDomainConstraint(payload);
    const constraints = normalized.constraints.filter((item) => item.type !== 'domain');
    if (domainConstraint) constraints.push(domainConstraint);
    return {
        ...normalized,
        constraints
    };
}

export function getPromoConstraintChips(set: PromoConstraintSet | string | null | undefined): PromoConstraintChip[] {
    const normalized = typeof set === 'string' ? parsePromoConstraintSetJson(set) : normalizePromoConstraintSet(set);
    if (!normalized) {
        return [
            {
                id: 'invalid',
                type: 'invalid',
                label: '约束无效',
                summary: '约束配置无法解析',
                severity: 'warning'
            }
        ];
    }
    return normalized.constraints
        .filter((constraint) => constraint.enabled)
        .map<PromoConstraintChip>((constraint) => {
            if (constraint.type === 'domain') {
                const payload = normalizePromoDomainConstraintPayload(constraint.payload);
                if (!payload) {
                    return {
                        id: constraint.id,
                        type: constraint.type,
                        label: constraint.label || '显示域名',
                        summary: '域名规则无效',
                        severity: 'warning'
                    };
                }
                return {
                    id: constraint.id,
                    type: constraint.type,
                    label: constraint.label || '显示域名',
                    summary: summarizePromoDomainConstraint(payload)
                };
            }
            return {
                id: constraint.id,
                type: constraint.type,
                label: constraint.label || constraint.type,
                summary: constraint.summary || `未支持约束：${constraint.type}`,
                severity: PROMO_CONSTRAINT_TYPES.includes(constraint.type as KnownPromoConstraintType) ? 'normal' : 'warning'
            };
        });
}

function normalizeRequestHost(value: string | null | undefined): { host: string; port: number | null } | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    let parsed: URL;
    try {
        parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    } catch {
        return null;
    }
    const host = normalizeHostForRule(parsed.hostname);
    const port = parsePort(parsed.port);
    if (!host || Number.isNaN(port)) return null;
    return { host, port };
}

function domainRuleMatches(rule: PromoAllowedDomainRule, requestHost: { host: string; port: number | null }): boolean {
    if (rule.port !== null && rule.port !== requestHost.port) return false;
    if (rule.type === 'exact') return rule.host === requestHost.host;
    return requestHost.host.endsWith(`.${rule.host}`) && requestHost.host !== rule.host;
}

function evaluateDomainConstraint(
    payload: PromoDomainConstraintPayload,
    context: PromoConstraintEvaluationContext
): PromoConstraintEvaluationResult {
    if (payload.mode === 'all') {
        return { matches: true, strength: 0, strengthLabel: 'all', summary: '所有域名' };
    }
    const requestHost = normalizeRequestHost(context.requestHost);
    if (!requestHost) {
        return { matches: false, strength: 0, strengthLabel: 'all', summary: '域名未知' };
    }
    const matchingRule = payload.rules
        .filter((rule) => domainRuleMatches(rule, requestHost))
        .sort((a, b) => (a.type === b.type ? 0 : a.type === 'exact' ? -1 : 1))[0];
    if (!matchingRule) {
        return { matches: false, strength: 0, strengthLabel: 'all', summary: summarizePromoDomainConstraint(payload) };
    }
    const strength = matchingRule.type === 'exact' ? 30 : 20;
    return {
        matches: true,
        strength,
        strengthLabel: matchingRule.type === 'exact' ? 'exact' : 'wildcard',
        summary: matchingRule.label
    };
}

export function evaluatePromoConstraintSet(
    set: PromoConstraintSet | string | null | undefined,
    context: PromoConstraintEvaluationContext = {}
): PromoConstraintEvaluationResult {
    const normalized = typeof set === 'string' ? parsePromoConstraintSetJson(set) : normalizePromoConstraintSet(set);
    if (!normalized) {
        return { matches: false, strength: 0, strengthLabel: 'all', summary: '约束配置无法解析' };
    }

    let strength = 0;
    let strengthLabel: PromoConstraintMatchStrength = 'all';
    const summaries: string[] = [];
    for (const constraint of normalized.constraints) {
        if (!constraint.enabled) continue;
        if (constraint.type === 'domain') {
            const payload = normalizePromoDomainConstraintPayload(constraint.payload);
            if (!payload) {
                return { matches: false, strength: 0, strengthLabel: 'all', summary: '域名规则无效' };
            }
            const result = evaluateDomainConstraint(payload, context);
            if (!result.matches) return result;
            strength += result.strength;
            if (result.strengthLabel === 'exact') strengthLabel = 'exact';
            else if (result.strengthLabel === 'wildcard' && strengthLabel === 'all') strengthLabel = 'wildcard';
            summaries.push(result.summary);
            continue;
        }
        return {
            matches: false,
            strength: 0,
            strengthLabel: 'all',
            summary: constraint.summary || `未支持约束：${constraint.type}`
        };
    }

    return {
        matches: true,
        strength,
        strengthLabel,
        summary: summaries.join('；')
    };
}

export type PromoCreativeTarget = {
    recommendedRatio: string;
    recommendedPixels: string;
    minimumPixels: string;
    displaySize: string;
    safeArea: 'centered' | 'centerBand';
};

export type PromoSlotCreativeGuidance = {
    slotKey: PromoSlotKey;
    fitMode: 'contain';
    desktop: PromoCreativeTarget;
    mobile: PromoCreativeTarget;
};

export const PROMO_SLOT_CREATIVE_GUIDANCE = {
    generation_form_header: {
        slotKey: 'generation_form_header',
        fitMode: 'contain',
        desktop: {
            recommendedRatio: '4:1',
            recommendedPixels: '1200 x 300 px',
            minimumPixels: '960 x 240 px',
            displaySize: '188-248 x 47-62 px',
            safeArea: 'centered'
        },
        mobile: {
            recommendedRatio: '4:1',
            recommendedPixels: '960 x 240 px',
            minimumPixels: '800 x 200 px',
            displaySize: '144-252 x 36-63 px',
            safeArea: 'centered'
        }
    },
    app_top_banner: {
        slotKey: 'app_top_banner',
        fitMode: 'contain',
        desktop: {
            recommendedRatio: '10:1',
            recommendedPixels: '2000 x 200 px',
            minimumPixels: '1600 x 160 px',
            displaySize: '684-1500 x 68-150 px',
            safeArea: 'centerBand'
        },
        mobile: {
            recommendedRatio: '4:1',
            recommendedPixels: '1200 x 300 px',
            minimumPixels: '800 x 200 px',
            displaySize: '252-394 x 63-99 px',
            safeArea: 'centerBand'
        }
    },
    history_top_banner: {
        slotKey: 'history_top_banner',
        fitMode: 'contain',
        desktop: {
            recommendedRatio: '10:1',
            recommendedPixels: '2000 x 200 px',
            minimumPixels: '1600 x 160 px',
            displaySize: '684-1500 x 68-150 px',
            safeArea: 'centerBand'
        },
        mobile: {
            recommendedRatio: '4:1',
            recommendedPixels: '1200 x 300 px',
            minimumPixels: '800 x 200 px',
            displaySize: '252-394 x 63-99 px',
            safeArea: 'centerBand'
        }
    }
} as const satisfies Record<PromoSlotKey, PromoSlotCreativeGuidance>;

export function getPromoSlotCreativeGuidance(slotKey: string): PromoSlotCreativeGuidance | null {
    return (PROMO_SLOT_CREATIVE_GUIDANCE as Record<string, PromoSlotCreativeGuidance>)[slotKey] || null;
}

export function getDefaultPromoAspectRatioForSlot(slotKey: string): PromoAspectRatio {
    const guidance = getPromoSlotCreativeGuidance(slotKey);
    return (
        parsePromoAspectRatio(guidance?.desktop.recommendedRatio, 'legacySlot') || {
            width: 4,
            height: 1,
            label: '4:1',
            source: 'legacySlot'
        }
    );
}

export function getRecommendedPromoAspectRatioForSlot(slotKey: string): PromoAspectRatio {
    const fallback = getDefaultPromoAspectRatioForSlot(slotKey);
    return { ...fallback, source: 'preset' };
}

export function normalizePromoAspectRatioSource(value: string | null | undefined): PromoAspectRatioSource {
    return value === 'preset' || value === 'custom' || value === 'legacySlot' ? value : 'legacySlot';
}

export function buildPromoAspectRatio(
    width: number | null | undefined,
    height: number | null | undefined,
    label: string | null | undefined,
    source: string | null | undefined,
    fallbackSlotKey?: string | null
): PromoAspectRatio {
    const normalizedSource = normalizePromoAspectRatioSource(source);
    const normalized =
        typeof width === 'number' && typeof height === 'number'
            ? normalizePromoAspectRatio(width, height, normalizedSource)
            : null;
    if (normalized) {
        const trimmedLabel = label?.trim();
        return {
            ...normalized,
            label: trimmedLabel || normalized.label
        };
    }
    return getDefaultPromoAspectRatioForSlot(fallbackSlotKey || '');
}

export const PROMO_DEFAULT_INTERVAL_MS = 5000;
export const PROMO_MIN_INTERVAL_MS = 3000;
export const PROMO_DEFAULT_TRANSITION: PromoTransition = 'fade';
export const PROMO_TITLE_MAX_LENGTH = 120;
export const PROMO_ALT_MAX_LENGTH = 160;
export const PROMO_URL_MAX_LENGTH = 2048;
export const PROMO_ALLOWED_ITEM_FIELDS = [
    'title',
    'alt',
    'desktopImageUrl',
    'mobileImageUrl',
    'linkUrl',
    'device',
    'enabled',
    'sortOrder',
    'weight',
    'startsAt',
    'endsAt'
] as const;

export type PromoPlacementSource = 'share' | 'global' | 'legacy';

export type PromoPlacementItem = {
    title: string;
    alt: string;
    desktopImageUrl: string;
    mobileImageUrl: string;
    linkUrl: string;
    device: PromoDevice;
    sortOrder: number;
    weight: number;
};

export type PromoPlacement = {
    slotKey: PromoSlotKey | string;
    slotName: string;
    description?: string | null;
    enabled: boolean;
    intervalMs: number;
    transition: PromoTransition;
    source: PromoPlacementSource;
    aspectRatio?: PromoAspectRatio;
    items: PromoPlacementItem[];
};

export type PromoCapabilitySlot = {
    key: PromoSlotKey | string;
    name: string;
    description?: string | null;
    enabled: boolean;
    defaultIntervalMs: number;
    defaultTransition: PromoTransition;
};

export type PromoCapabilities = {
    shareProfilesEnabled: boolean;
    slots: PromoCapabilitySlot[];
    aspectRatios: {
        presets: readonly PromoAspectRatioPreset[];
        maxEdgeRatio: number;
    };
    constraints: {
        types: readonly {
            type: KnownPromoConstraintType;
            label: string;
            editor: 'domainAllowlist';
            defaultEnabled: boolean;
            maxRules: number;
        }[];
    };
    itemLimits: {
        titleMaxLength: number;
        altMaxLength: number;
        urlMaxLength: number;
        allowedFields: readonly string[];
    };
    carouselDefaults: {
        intervalMs: number;
        minIntervalMs: number;
        transition: PromoTransition;
    };
};
