'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatClientDirectLinkRestriction, getClientDirectLinkRestriction } from '@/lib/connection-policy';
import { loadConfig, saveConfig, type AppConfig } from '@/lib/config';
import { getProviderLabel, normalizeCustomImageModels, type CustomImageModelCapabilities, type ImageProviderId, type StoredCustomImageModel } from '@/lib/model-registry';
import { SEEDREAM_DEFAULT_BASE_URL, SENSENOVA_DEFAULT_BASE_URL } from '@/lib/provider-config';
import {
    DEFAULT_PROMPT_POLISH_MODEL,
    DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
    DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
    DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT,
    DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
    PROMPT_POLISH_THINKING_EFFORT_OPTIONS,
    normalizePromptPolishThinkingEffortFormat,
    type PromptPolishThinkingEffortFormat
} from '@/lib/prompt-polish-core';
import { DEFAULT_PROMPT_HISTORY_LIMIT, normalizePromptHistoryLimit } from '@/lib/prompt-history';
import {
    AlertTriangle,
    ChevronDown,
    Cpu,
    Database,
    Eye,
    EyeOff,
    Globe,
    Key,
    Plus,
    Radio,
    History,
    Settings,
    Sparkles,
    Trash2,
    Wifi
} from 'lucide-react';
import * as React from 'react';

type SettingsDialogProps = {
    onConfigChange: (config: Partial<AppConfig>) => void;
};

type InitialConfig = {
    apiKey: string;
    apiBaseUrl: string;
    geminiApiKey: string;
    geminiApiBaseUrl: string;
    sensenovaApiKey: string;
    sensenovaApiBaseUrl: string;
    seedreamApiKey: string;
    seedreamApiBaseUrl: string;
    customImageModels: StoredCustomImageModel[];
    polishingApiKey: string;
    polishingApiBaseUrl: string;
    polishingModelId: string;
    polishingPrompt: string;
    polishingThinkingEnabled: boolean;
    polishingThinkingEffort: string;
    polishingThinkingEffortFormat: PromptPolishThinkingEffortFormat;
    storageMode: string;
    connectionMode: string;
    maxConcurrentTasks: number;
    promptHistoryLimit: number;
};

function statusBadge(label: string, tone: 'green' | 'blue' | 'amber') {
    const toneClass = tone === 'green'
        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
        : tone === 'blue'
            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300'
            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    const dotClass = tone === 'green' ? 'bg-emerald-500' : tone === 'blue' ? 'bg-blue-500' : 'bg-amber-500';

    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
            {label}
        </span>
    );
}

const polishingThinkingFormatLabels: Record<PromptPolishThinkingEffortFormat, string> = {
    openai: 'OpenAI 兼容',
    anthropic: 'Anthropic 兼容',
    both: '兼容模式'
};

const polishingThinkingFormatDescriptions: Record<PromptPolishThinkingEffortFormat, string> = {
    openai: '发送 thinking.type 与 reasoning_effort。',
    anthropic: '发送 thinking.type 与 output_config.effort。',
    both: '同时发送三种字段，适合明确支持混合参数的中转。'
};

function ProviderSection({
    title,
    description,
    icon,
    children,
    defaultOpen = false
}: {
    title: string;
    description: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = React.useState(defaultOpen);

    return (
        <section className='rounded-2xl border border-border bg-card/80 shadow-sm dark:bg-white/[0.025]'>
            <button
                type='button'
                onClick={() => setOpen((value) => !value)}
                className='flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                aria-expanded={open}>
                <span className='min-w-0'>
                    <span className='flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground'>
                        {icon && <span className='text-muted-foreground' aria-hidden='true'>{icon}</span>}
                        {title}
                    </span>
                    <span className='mt-1 block text-sm text-muted-foreground'>{description}</span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className='space-y-4 border-t border-border p-4'>{children}</div>}
        </section>
    );
}

function SecretInput({
    id,
    value,
    onChange,
    visible,
    onVisibleChange,
    placeholder
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    visible: boolean;
    onVisibleChange: () => void;
    placeholder: string;
}) {
    return (
        <div className='relative'>
            <Input
                id={id}
                name={`${id}-not-password`}
                type={visible ? 'text' : 'password'}
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                spellCheck={false}
                autoComplete='one-time-code'
                autoCorrect='off'
                autoCapitalize='none'
                data-1p-ignore='true'
                data-bwignore='true'
                data-lpignore='true'
                className='h-10 rounded-xl bg-background pr-10 text-foreground'
            />
            <button
                type='button'
                onClick={onVisibleChange}
                className='absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
                aria-label={visible ? '隐藏 API Key' : '显示 API Key'}>
                {visible ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
            </button>
        </div>
    );
}

function providerLabel(provider: ImageProviderId): string {
    return getProviderLabel(provider);
}

export function SettingsDialog({ onConfigChange }: SettingsDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [apiKey, setApiKey] = React.useState('');
    const [showApiKey, setShowApiKey] = React.useState(false);
    const [apiBaseUrl, setApiBaseUrl] = React.useState('');
    const [geminiApiKey, setGeminiApiKey] = React.useState('');
    const [showGeminiApiKey, setShowGeminiApiKey] = React.useState(false);
    const [geminiApiBaseUrl, setGeminiApiBaseUrl] = React.useState('');
    const [sensenovaApiKey, setSensenovaApiKey] = React.useState('');
    const [showSensenovaApiKey, setShowSensenovaApiKey] = React.useState(false);
    const [sensenovaApiBaseUrl, setSensenovaApiBaseUrl] = React.useState('');
    const [seedreamApiKey, setSeedreamApiKey] = React.useState('');
    const [showSeedreamApiKey, setShowSeedreamApiKey] = React.useState(false);
    const [seedreamApiBaseUrl, setSeedreamApiBaseUrl] = React.useState('');
    const [polishingApiKey, setPolishingApiKey] = React.useState('');
    const [showPolishingApiKey, setShowPolishingApiKey] = React.useState(false);
    const [polishingApiBaseUrl, setPolishingApiBaseUrl] = React.useState('');
    const [polishingModelId, setPolishingModelId] = React.useState(DEFAULT_PROMPT_POLISH_MODEL);
    const [polishingPrompt, setPolishingPrompt] = React.useState(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT);
    const [polishingThinkingEnabled, setPolishingThinkingEnabled] = React.useState(DEFAULT_PROMPT_POLISH_THINKING_ENABLED);
    const [polishingThinkingEffort, setPolishingThinkingEffort] = React.useState(DEFAULT_PROMPT_POLISH_THINKING_EFFORT);
    const [polishingThinkingEffortFormat, setPolishingThinkingEffortFormat] = React.useState<PromptPolishThinkingEffortFormat>(
        DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT
    );
    const [customImageModels, setCustomImageModels] = React.useState<StoredCustomImageModel[]>([]);
    const [newModelId, setNewModelId] = React.useState('');
    const [newModelProvider, setNewModelProvider] = React.useState<ImageProviderId>('openai');
    const [storageMode, setStorageMode] = React.useState<'fs' | 'indexeddb' | 'auto'>('auto');
    const [connectionMode, setConnectionMode] = React.useState<'proxy' | 'direct'>('proxy');
    const [saved, setSaved] = React.useState(false);
    const [hasEnvApiKey, setHasEnvApiKey] = React.useState(false);
    const [hasEnvApiBaseUrl, setHasEnvApiBaseUrl] = React.useState(false);
    const [envApiBaseUrl, setEnvApiBaseUrl] = React.useState('');
    const [hasEnvGeminiApiKey, setHasEnvGeminiApiKey] = React.useState(false);
    const [hasEnvGeminiApiBaseUrl, setHasEnvGeminiApiBaseUrl] = React.useState(false);
    const [envGeminiApiBaseUrl, setEnvGeminiApiBaseUrl] = React.useState('');
    const [hasEnvSensenovaApiKey, setHasEnvSensenovaApiKey] = React.useState(false);
    const [hasEnvSensenovaApiBaseUrl, setHasEnvSensenovaApiBaseUrl] = React.useState(false);
    const [envSensenovaApiBaseUrl, setEnvSensenovaApiBaseUrl] = React.useState('');
    const [hasEnvSeedreamApiKey, setHasEnvSeedreamApiKey] = React.useState(false);
    const [hasEnvSeedreamApiBaseUrl, setHasEnvSeedreamApiBaseUrl] = React.useState(false);
    const [envSeedreamApiBaseUrl, setEnvSeedreamApiBaseUrl] = React.useState('');
    const [hasEnvPolishingApiKey, setHasEnvPolishingApiKey] = React.useState(false);
    const [hasEnvPolishingApiBaseUrl, setHasEnvPolishingApiBaseUrl] = React.useState(false);
    const [envPolishingApiBaseUrl, setEnvPolishingApiBaseUrl] = React.useState('');
    const [envPolishingModelId, setEnvPolishingModelId] = React.useState('');
    const [hasEnvPolishingPrompt, setHasEnvPolishingPrompt] = React.useState(false);
    const [envPolishingThinkingEnabled, setEnvPolishingThinkingEnabled] = React.useState('');
    const [envPolishingThinkingEffort, setEnvPolishingThinkingEffort] = React.useState('');
    const [envPolishingThinkingEffortFormat, setEnvPolishingThinkingEffortFormat] = React.useState('');
    const [hasEnvStorageMode, setHasEnvStorageMode] = React.useState(false);
    const [clientDirectLinkPriority, setClientDirectLinkPriority] = React.useState(false);
    const [serverHasAppPassword, setServerHasAppPassword] = React.useState(false);
    const [initialConfig, setInitialConfig] = React.useState<InitialConfig>({
        apiKey: '',
        apiBaseUrl: '',
        geminiApiKey: '',
        geminiApiBaseUrl: '',
        sensenovaApiKey: '',
        sensenovaApiBaseUrl: '',
        seedreamApiKey: '',
        seedreamApiBaseUrl: '',
        customImageModels: [],
        polishingApiKey: '',
        polishingApiBaseUrl: '',
        polishingModelId: DEFAULT_PROMPT_POLISH_MODEL,
        polishingPrompt: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
        polishingThinkingEnabled: DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
        polishingThinkingEffort: DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
        polishingThinkingEffortFormat: DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT,
        storageMode: 'auto',
        connectionMode: 'proxy',
        maxConcurrentTasks: 3,
        promptHistoryLimit: DEFAULT_PROMPT_HISTORY_LIMIT
    });
    const [maxConcurrentTasks, setMaxConcurrentTasks] = React.useState(3);
    const [promptHistoryLimit, setPromptHistoryLimit] = React.useState(DEFAULT_PROMPT_HISTORY_LIMIT);

    React.useEffect(() => {
        if (!open) return;

        const config = loadConfig();
        const normalizedCustomModels = normalizeCustomImageModels(config.customImageModels);
        setApiKey(config.openaiApiKey || '');
        setApiBaseUrl(config.openaiApiBaseUrl || '');
        setGeminiApiKey(config.geminiApiKey || '');
        setGeminiApiBaseUrl(config.geminiApiBaseUrl || '');
        setSensenovaApiKey(config.sensenovaApiKey || '');
        setSensenovaApiBaseUrl(config.sensenovaApiBaseUrl || '');
        setSeedreamApiKey(config.seedreamApiKey || '');
        setSeedreamApiBaseUrl(config.seedreamApiBaseUrl || '');
        setPolishingApiKey(config.polishingApiKey || '');
        setPolishingApiBaseUrl(config.polishingApiBaseUrl || '');
        setPolishingModelId(config.polishingModelId || DEFAULT_PROMPT_POLISH_MODEL);
        setPolishingPrompt(config.polishingPrompt || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT);
        setPolishingThinkingEnabled(config.polishingThinkingEnabled);
        setPolishingThinkingEffort(config.polishingThinkingEffort || DEFAULT_PROMPT_POLISH_THINKING_EFFORT);
        setPolishingThinkingEffortFormat(normalizePromptPolishThinkingEffortFormat(config.polishingThinkingEffortFormat));
        setCustomImageModels(normalizedCustomModels);
        setStorageMode(config.imageStorageMode || 'auto');
        setConnectionMode(config.connectionMode || 'proxy');
        setMaxConcurrentTasks(config.maxConcurrentTasks || 3);
        setPromptHistoryLimit(normalizePromptHistoryLimit(config.promptHistoryLimit));
        setNewModelId('');
        setNewModelProvider('openai');
        setInitialConfig({
            apiKey: config.openaiApiKey || '',
            apiBaseUrl: config.openaiApiBaseUrl || '',
            geminiApiKey: config.geminiApiKey || '',
            geminiApiBaseUrl: config.geminiApiBaseUrl || '',
            sensenovaApiKey: config.sensenovaApiKey || '',
            sensenovaApiBaseUrl: config.sensenovaApiBaseUrl || '',
            seedreamApiKey: config.seedreamApiKey || '',
            seedreamApiBaseUrl: config.seedreamApiBaseUrl || '',
            customImageModels: normalizedCustomModels,
            polishingApiKey: config.polishingApiKey || '',
            polishingApiBaseUrl: config.polishingApiBaseUrl || '',
            polishingModelId: config.polishingModelId || DEFAULT_PROMPT_POLISH_MODEL,
            polishingPrompt: config.polishingPrompt || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
            polishingThinkingEnabled: config.polishingThinkingEnabled,
            polishingThinkingEffort: config.polishingThinkingEffort || DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
            polishingThinkingEffortFormat: normalizePromptPolishThinkingEffortFormat(config.polishingThinkingEffortFormat),
            storageMode: config.imageStorageMode || 'auto',
            connectionMode: config.connectionMode || 'proxy',
            maxConcurrentTasks: config.maxConcurrentTasks || 3,
            promptHistoryLimit: normalizePromptHistoryLimit(config.promptHistoryLimit)
        });
        setSaved(false);
        fetch('/api/config')
            .then((response) => response.json())
            .then((data) => {
                setHasEnvApiKey(data.hasEnvApiKey || false);
                setHasEnvApiBaseUrl(!!data.envApiBaseUrl);
                setEnvApiBaseUrl(typeof data.envApiBaseUrl === 'string' ? data.envApiBaseUrl : '');
                setHasEnvGeminiApiKey(data.hasEnvGeminiApiKey || false);
                setHasEnvGeminiApiBaseUrl(!!data.envGeminiApiBaseUrl);
                setEnvGeminiApiBaseUrl(typeof data.envGeminiApiBaseUrl === 'string' ? data.envGeminiApiBaseUrl : '');
                setHasEnvSensenovaApiKey(data.hasEnvSensenovaApiKey || false);
                setHasEnvSensenovaApiBaseUrl(!!data.envSensenovaApiBaseUrl);
                setEnvSensenovaApiBaseUrl(typeof data.envSensenovaApiBaseUrl === 'string' ? data.envSensenovaApiBaseUrl : '');
                setHasEnvSeedreamApiKey(data.hasEnvSeedreamApiKey || false);
                setHasEnvSeedreamApiBaseUrl(!!data.envSeedreamApiBaseUrl);
                setEnvSeedreamApiBaseUrl(typeof data.envSeedreamApiBaseUrl === 'string' ? data.envSeedreamApiBaseUrl : '');
                setHasEnvPolishingApiKey(data.hasEnvPolishingApiKey || false);
                setHasEnvPolishingApiBaseUrl(!!data.envPolishingApiBaseUrl);
                setEnvPolishingApiBaseUrl(typeof data.envPolishingApiBaseUrl === 'string' ? data.envPolishingApiBaseUrl : '');
                setEnvPolishingModelId(typeof data.envPolishingModelId === 'string' ? data.envPolishingModelId : '');
                setHasEnvPolishingPrompt(data.hasEnvPolishingPrompt || false);
                setEnvPolishingThinkingEnabled(typeof data.envPolishingThinkingEnabled === 'string' ? data.envPolishingThinkingEnabled : '');
                setEnvPolishingThinkingEffort(typeof data.envPolishingThinkingEffort === 'string' ? data.envPolishingThinkingEffort : '');
                setEnvPolishingThinkingEffortFormat(typeof data.envPolishingThinkingEffortFormat === 'string' ? data.envPolishingThinkingEffortFormat : '');
                setHasEnvStorageMode(!!data.envStorageMode);
                setClientDirectLinkPriority(data.clientDirectLinkPriority || false);
                setServerHasAppPassword(data.hasAppPassword || false);
            })
            .catch((error: unknown) => {
                console.warn('Failed to load server configuration:', error);
                setClientDirectLinkPriority(false);
            });
    }, [open]);

    const addCustomModel = React.useCallback(() => {
        const id = newModelId.trim();
        if (!id) return;

        setCustomImageModels((current) => {
            const withoutDuplicate = current.filter((model) => model.id !== id);
            return normalizeCustomImageModels([...withoutDuplicate, { id, provider: newModelProvider }]);
        });
        setNewModelId('');
    }, [newModelId, newModelProvider]);

    const handleNewModelIdChange = React.useCallback((value: string) => {
        setNewModelId(value);
        const normalized = value.trim().toLowerCase();
        if (normalized.startsWith('gemini-')) {
            setNewModelProvider('google');
        } else if (normalized.startsWith('sensenova-')) {
            setNewModelProvider('sensenova');
        } else if (normalized.startsWith('doubao-seedream-') || normalized.startsWith('doubao-seededit-')) {
            setNewModelProvider('seedream');
        }
    }, []);

    const removeCustomModel = React.useCallback((id: string) => {
        setCustomImageModels((current) => current.filter((model) => model.id !== id));
    }, []);

    const updateCustomModelProvider = React.useCallback((id: string, provider: ImageProviderId) => {
        setCustomImageModels((current) => current.map((model) => model.id === id ? { ...model, provider } : model));
    }, []);

    const updateCustomModelCapability = React.useCallback((id: string, capability: keyof CustomImageModelCapabilities, enabled: boolean | string) => {
        setCustomImageModels((current) => current.map((model) => model.id === id ? {
            ...model,
            capabilities: { ...(model.capabilities ?? {}), [capability]: !!enabled }
        } : model));
    }, []);

    const updateCustomModelDefaultSize = React.useCallback((id: string, defaultSize: string) => {
        setCustomImageModels((current) => current.map((model) => model.id === id ? {
            ...model,
            defaultSize: defaultSize.trim() || undefined
        } : model));
    }, []);

    const updateCustomModelSizePreset = React.useCallback((id: string, preset: 'square' | 'landscape' | 'portrait', value: string) => {
        setCustomImageModels((current) => current.map((model) => {
            if (model.id !== id) return model;
            const nextPresets = { ...(model.sizePresets ?? {}) };
            const trimmed = value.trim();
            if (trimmed) {
                nextPresets[preset] = trimmed;
            } else {
                delete nextPresets[preset];
            }
            return {
                ...model,
                sizePresets: Object.keys(nextPresets).length > 0 ? nextPresets : undefined
            };
        }));
    }, []);

    const directLinkRestriction = React.useMemo(
        () => getClientDirectLinkRestriction({
            enabled: clientDirectLinkPriority,
            openaiApiBaseUrl: apiBaseUrl,
            envOpenaiApiBaseUrl: envApiBaseUrl,
            polishingApiBaseUrl,
            envPolishingApiBaseUrl,
            geminiApiBaseUrl,
            envGeminiApiBaseUrl,
            sensenovaApiBaseUrl,
            envSensenovaApiBaseUrl,
            seedreamApiBaseUrl,
            envSeedreamApiBaseUrl
        }),
        [apiBaseUrl, clientDirectLinkPriority, envApiBaseUrl, envGeminiApiBaseUrl, envPolishingApiBaseUrl, envSeedreamApiBaseUrl, envSensenovaApiBaseUrl, geminiApiBaseUrl, polishingApiBaseUrl, seedreamApiBaseUrl, sensenovaApiBaseUrl]
    );
    const directLinkRestrictionMessage = directLinkRestriction ? formatClientDirectLinkRestriction(directLinkRestriction) : '';

    React.useEffect(() => {
        if (directLinkRestriction && connectionMode !== 'direct') {
            setConnectionMode('direct');
        }
    }, [connectionMode, directLinkRestriction]);

    const handleSave = () => {
        const normalizedCustomModels = normalizeCustomImageModels(customImageModels);
        const savedConnectionMode = directLinkRestriction ? 'direct' : connectionMode;
        const newConfig: Partial<AppConfig> = {};
        if (apiKey !== initialConfig.apiKey) newConfig.openaiApiKey = apiKey;
        if (apiBaseUrl !== initialConfig.apiBaseUrl) newConfig.openaiApiBaseUrl = apiBaseUrl;
        if (geminiApiKey !== initialConfig.geminiApiKey) newConfig.geminiApiKey = geminiApiKey;
        if (geminiApiBaseUrl !== initialConfig.geminiApiBaseUrl) newConfig.geminiApiBaseUrl = geminiApiBaseUrl;
        if (sensenovaApiKey !== initialConfig.sensenovaApiKey) newConfig.sensenovaApiKey = sensenovaApiKey;
        if (sensenovaApiBaseUrl !== initialConfig.sensenovaApiBaseUrl) newConfig.sensenovaApiBaseUrl = sensenovaApiBaseUrl;
        if (seedreamApiKey !== initialConfig.seedreamApiKey) newConfig.seedreamApiKey = seedreamApiKey;
        if (seedreamApiBaseUrl !== initialConfig.seedreamApiBaseUrl) newConfig.seedreamApiBaseUrl = seedreamApiBaseUrl;
        if (polishingApiKey !== initialConfig.polishingApiKey) newConfig.polishingApiKey = polishingApiKey;
        if (polishingApiBaseUrl !== initialConfig.polishingApiBaseUrl) newConfig.polishingApiBaseUrl = polishingApiBaseUrl;
        if (polishingModelId !== initialConfig.polishingModelId) newConfig.polishingModelId = polishingModelId;
        if (polishingPrompt !== initialConfig.polishingPrompt) newConfig.polishingPrompt = polishingPrompt;
        if (polishingThinkingEnabled !== initialConfig.polishingThinkingEnabled) newConfig.polishingThinkingEnabled = polishingThinkingEnabled;
        if (polishingThinkingEffort !== initialConfig.polishingThinkingEffort) newConfig.polishingThinkingEffort = polishingThinkingEffort.trim() || DEFAULT_PROMPT_POLISH_THINKING_EFFORT;
        if (polishingThinkingEffortFormat !== initialConfig.polishingThinkingEffortFormat) newConfig.polishingThinkingEffortFormat = polishingThinkingEffortFormat;
        if (JSON.stringify(normalizedCustomModels) !== JSON.stringify(initialConfig.customImageModels)) {
            newConfig.customImageModels = normalizedCustomModels;
        }
        if (storageMode !== initialConfig.storageMode) newConfig.imageStorageMode = storageMode;
        if (savedConnectionMode !== initialConfig.connectionMode) newConfig.connectionMode = savedConnectionMode;
        if (maxConcurrentTasks !== initialConfig.maxConcurrentTasks) newConfig.maxConcurrentTasks = maxConcurrentTasks;
        if (promptHistoryLimit !== initialConfig.promptHistoryLimit) newConfig.promptHistoryLimit = promptHistoryLimit;

        if (directLinkRestriction?.provider === 'openai' && !directLinkRestriction.serviceLabel && !apiBaseUrl && envApiBaseUrl) {
            newConfig.openaiApiBaseUrl = envApiBaseUrl;
        }
        if (directLinkRestriction?.provider === 'google' && !geminiApiBaseUrl && envGeminiApiBaseUrl) {
            newConfig.geminiApiBaseUrl = envGeminiApiBaseUrl;
        }
        if (directLinkRestriction?.provider === 'sensenova' && !sensenovaApiBaseUrl && envSensenovaApiBaseUrl) {
            newConfig.sensenovaApiBaseUrl = envSensenovaApiBaseUrl;
        }
        if (directLinkRestriction?.provider === 'seedream' && !seedreamApiBaseUrl && envSeedreamApiBaseUrl) {
            newConfig.seedreamApiBaseUrl = envSeedreamApiBaseUrl;
        }
        if (directLinkRestriction?.serviceLabel === '提示词润色' && !polishingApiBaseUrl && envPolishingApiBaseUrl) {
            newConfig.polishingApiBaseUrl = envPolishingApiBaseUrl;
        }

        if (savedConnectionMode === 'direct') {
            const effectiveApiKey = apiKey || (hasEnvApiKey ? '(env)' : '');
            const effectiveBaseUrl = apiBaseUrl || envApiBaseUrl || (hasEnvApiBaseUrl ? '(env)' : '');
            const effectiveGeminiApiKey = geminiApiKey || (hasEnvGeminiApiKey ? '(env)' : '');
            const effectiveSensenovaApiKey = sensenovaApiKey || (hasEnvSensenovaApiKey ? '(env)' : '');
            const effectiveSeedreamApiKey = seedreamApiKey || (hasEnvSeedreamApiKey ? '(env)' : '');
            const effectivePolishingApiKey = polishingApiKey || (hasEnvPolishingApiKey ? '(env)' : '');
            if ((!effectiveApiKey || effectiveApiKey === '(env)') && (!effectiveGeminiApiKey || effectiveGeminiApiKey === '(env)') && (!effectiveSensenovaApiKey || effectiveSensenovaApiKey === '(env)') && (!effectiveSeedreamApiKey || effectiveSeedreamApiKey === '(env)') && (!effectivePolishingApiKey || effectivePolishingApiKey === '(env)')) {
                alert('直连模式需要在浏览器配置 OpenAI、Gemini 或提示词润色 API Key，请在上方填写。');
                return;
            }
            if (effectiveApiKey && effectiveApiKey !== '(env)' && !effectiveGeminiApiKey && (!effectiveBaseUrl || effectiveBaseUrl === '(env)')) {
                alert('直连模式需要配置 API Base URL（第三方中转地址），请在上方填写。');
                return;
            }
        }

        saveConfig(newConfig);
        onConfigChange(newConfig);
        setSaved(true);
        setTimeout(() => setOpen(false), 600);
    };

    const handleReset = () => {
        const resetRestriction = getClientDirectLinkRestriction({
            enabled: clientDirectLinkPriority,
            envOpenaiApiBaseUrl: envApiBaseUrl,
            envPolishingApiBaseUrl,
            envGeminiApiBaseUrl,
            envSensenovaApiBaseUrl,
            envSeedreamApiBaseUrl
        });
        const resetConnectionMode = resetRestriction ? 'direct' : 'proxy';

        localStorage.removeItem('gpt-image-playground-config');
        setApiKey('');
        setApiBaseUrl('');
        setGeminiApiKey('');
        setGeminiApiBaseUrl('');
        setSensenovaApiKey('');
        setSensenovaApiBaseUrl('');
        setSeedreamApiKey('');
        setSeedreamApiBaseUrl('');
        setPolishingApiKey('');
        setPolishingApiBaseUrl('');
        setPolishingModelId(DEFAULT_PROMPT_POLISH_MODEL);
        setPolishingPrompt(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT);
        setPolishingThinkingEnabled(DEFAULT_PROMPT_POLISH_THINKING_ENABLED);
        setPolishingThinkingEffort(DEFAULT_PROMPT_POLISH_THINKING_EFFORT);
        setPolishingThinkingEffortFormat(DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT);
        setCustomImageModels([]);
        setStorageMode('auto');
        setConnectionMode(resetConnectionMode);
        setMaxConcurrentTasks(3);
        setPromptHistoryLimit(DEFAULT_PROMPT_HISTORY_LIMIT);
        onConfigChange({
            openaiApiKey: '',
            openaiApiBaseUrl: '',
            geminiApiKey: '',
            geminiApiBaseUrl: '',
            sensenovaApiKey: '',
            sensenovaApiBaseUrl: '',
            seedreamApiKey: '',
            seedreamApiBaseUrl: '',
            polishingApiKey: '',
            polishingApiBaseUrl: '',
            polishingModelId: DEFAULT_PROMPT_POLISH_MODEL,
            polishingPrompt: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
            polishingThinkingEnabled: DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
            polishingThinkingEffort: DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
            polishingThinkingEffortFormat: DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT,
            customImageModels: [],
            imageStorageMode: 'auto',
            connectionMode: resetConnectionMode,
            maxConcurrentTasks: 3,
            promptHistoryLimit: DEFAULT_PROMPT_HISTORY_LIMIT
        });
        setSaved(true);
        setTimeout(() => setOpen(false), 600);
    };

    const storageOptions = [
        { value: 'auto', label: '自动检测' },
        { value: 'fs', label: '文件系统' },
        { value: 'indexeddb', label: 'IndexedDB' }
    ];

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant='ghost'
                    size='icon'
                    className='text-foreground/60 hover:bg-accent hover:text-foreground'
                    aria-label='Settings'>
                    <Settings className='h-4 w-4' />
                </Button>
            </DialogTrigger>
            <DialogContent className='h-dvh max-h-dvh w-screen max-w-none overflow-y-auto overscroll-contain rounded-none border-border bg-background p-0 text-foreground shadow-xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[min(760px,calc(100vw-2rem))] sm:max-w-[760px] sm:rounded-2xl'>
                <div className='border-b border-border bg-card/70 px-5 py-4 pr-12 sm:px-6'>
                    <DialogHeader>
                        <DialogTitle className='text-xl font-semibold'>系统配置</DialogTitle>
                        <DialogDescription>
                            按供应商管理 API、模型和运行参数。UI 配置优先于 .env 文件。
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className='space-y-5 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6'>
                    <ProviderSection title='OpenAI' description='官方 OpenAI 或 OpenAI 兼容端点。' icon={<Globe className='h-4 w-4' />}>
                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label htmlFor='openai-api-key' className='flex items-center gap-2'>
                                    <Key className='h-4 w-4 text-muted-foreground' />
                                    OpenAI API Key
                                </Label>
                                {apiKey ? statusBadge('UI', 'green') : hasEnvApiKey ? statusBadge('ENV', 'blue') : null}
                            </div>
                            <SecretInput
                                id='openai-api-key'
                                value={apiKey}
                                onChange={setApiKey}
                                visible={showApiKey}
                                onVisibleChange={() => setShowApiKey((value) => !value)}
                                placeholder='sk-…'
                            />
                            {hasEnvApiKey && <p className='text-xs text-muted-foreground'>.env 中已配置，当前为空时使用 ENV 值。</p>}
                        </div>

                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label htmlFor='openai-base-url' className='flex items-center gap-2'>
                                    <Globe className='h-4 w-4 text-muted-foreground' />
                                    OpenAI API Base URL
                                    <span className='text-xs font-normal text-muted-foreground'>(可选)</span>
                                </Label>
                                {apiBaseUrl ? statusBadge('UI', 'green') : hasEnvApiBaseUrl ? statusBadge('ENV', 'blue') : null}
                            </div>
                            <Input
                                id='openai-base-url'
                                type='url'
                                placeholder='https://api.openai.com/v1'
                                value={apiBaseUrl}
                                onChange={(event) => setApiBaseUrl(event.target.value)}
                                autoComplete='off'
                                className='h-10 rounded-xl bg-background text-foreground'
                            />
                            {hasEnvApiBaseUrl && <p className='text-xs text-muted-foreground'>.env 中已配置，当前为空时使用 ENV 值。</p>}
                        </div>
                    </ProviderSection>

                    <ProviderSection title='Google Gemini' description='Nano Banana 2 与后续 Gemini 图像模型。' icon={<Sparkles className='h-4 w-4' />}>
                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label htmlFor='gemini-api-key' className='flex items-center gap-2'>
                                    <Key className='h-4 w-4 text-muted-foreground' />
                                    Gemini API Key
                                </Label>
                                {geminiApiKey ? statusBadge('UI', 'green') : hasEnvGeminiApiKey ? statusBadge('ENV', 'blue') : null}
                            </div>
                            <SecretInput
                                id='gemini-api-key'
                                value={geminiApiKey}
                                onChange={setGeminiApiKey}
                                visible={showGeminiApiKey}
                                onVisibleChange={() => setShowGeminiApiKey((value) => !value)}
                                placeholder='AIza…'
                            />
                            {hasEnvGeminiApiKey && <p className='text-xs text-muted-foreground'>.env 中已配置 GEMINI_API_KEY，当前为空时使用 ENV 值。</p>}
                        </div>

                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label htmlFor='gemini-base-url' className='flex items-center gap-2'>
                                    <Globe className='h-4 w-4 text-muted-foreground' />
                                    Gemini API Base URL
                                    <span className='text-xs font-normal text-muted-foreground'>(可选)</span>
                                </Label>
                                {geminiApiBaseUrl ? statusBadge('UI', 'green') : hasEnvGeminiApiBaseUrl ? statusBadge('ENV', 'blue') : null}
                            </div>
                            <Input
                                id='gemini-base-url'
                                type='url'
                                placeholder='https://generativelanguage.googleapis.com/v1beta'
                                value={geminiApiBaseUrl}
                                onChange={(event) => setGeminiApiBaseUrl(event.target.value)}
                                autoComplete='off'
                                className='h-10 rounded-xl bg-background text-foreground'
                            />
                            <p className='text-xs text-muted-foreground'>用于 Gemini Nano Banana 2 和后续 Google Gemini 图像模型。</p>
                        </div>
                    </ProviderSection>

                    <ProviderSection title='Seedream / 火山方舟' description='豆包 Seedream 文生图、图生图和组图接口。' icon={<Sparkles className='h-4 w-4' />}>
                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label htmlFor='seedream-api-key' className='flex items-center gap-2'>
                                    <Key className='h-4 w-4 text-muted-foreground' />
                                    Seedream API Key
                                </Label>
                                {seedreamApiKey ? statusBadge('UI', 'green') : hasEnvSeedreamApiKey ? statusBadge('ENV', 'blue') : null}
                            </div>
                            <SecretInput
                                id='seedream-api-key'
                                value={seedreamApiKey}
                                onChange={setSeedreamApiKey}
                                visible={showSeedreamApiKey}
                                onVisibleChange={() => setShowSeedreamApiKey((value) => !value)}
                                placeholder='VolcEngine Ark API Key'
                            />
                            {hasEnvSeedreamApiKey && <p className='text-xs text-muted-foreground'>.env 中已配置 SEEDREAM_API_KEY，当前为空时使用 ENV 值。</p>}
                        </div>

                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label htmlFor='seedream-base-url' className='flex items-center gap-2'>
                                    <Globe className='h-4 w-4 text-muted-foreground' />
                                    Seedream API Base URL
                                    <span className='text-xs font-normal text-muted-foreground'>(可选)</span>
                                </Label>
                                {seedreamApiBaseUrl ? statusBadge('UI', 'green') : hasEnvSeedreamApiBaseUrl ? statusBadge('ENV', 'blue') : statusBadge('默认', 'amber')}
                            </div>
                            <Input
                                id='seedream-base-url'
                                type='url'
                                placeholder={envSeedreamApiBaseUrl || SEEDREAM_DEFAULT_BASE_URL}
                                value={seedreamApiBaseUrl}
                                onChange={(event) => setSeedreamApiBaseUrl(event.target.value)}
                                autoComplete='off'
                                className='h-10 rounded-xl bg-background text-foreground'
                            />
                            <p className='text-xs text-muted-foreground'>支持 2K/3K/4K 和 WxH；水印、Seed、Guidance、组图和联网搜索等参数可在高级选项中快捷配置。</p>
                        </div>
                    </ProviderSection>

                    <ProviderSection title='SenseNova' description='商汤 SenseNova U1 Fast 信息图生成接口。' icon={<Sparkles className='h-4 w-4' />}>
                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label htmlFor='sensenova-api-key' className='flex items-center gap-2'>
                                    <Key className='h-4 w-4 text-muted-foreground' />
                                    SenseNova API Key
                                </Label>
                                {sensenovaApiKey ? statusBadge('UI', 'green') : hasEnvSensenovaApiKey ? statusBadge('ENV', 'blue') : null}
                            </div>
                            <SecretInput
                                id='sensenova-api-key'
                                value={sensenovaApiKey}
                                onChange={setSensenovaApiKey}
                                visible={showSensenovaApiKey}
                                onVisibleChange={() => setShowSensenovaApiKey((value) => !value)}
                                placeholder='SenseNova bearer token'
                            />
                            {hasEnvSensenovaApiKey && <p className='text-xs text-muted-foreground'>.env 中已配置 SENSENOVA_API_KEY，当前为空时使用 ENV 值。</p>}
                        </div>

                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label htmlFor='sensenova-base-url' className='flex items-center gap-2'>
                                    <Globe className='h-4 w-4 text-muted-foreground' />
                                    SenseNova API Base URL
                                    <span className='text-xs font-normal text-muted-foreground'>(可选)</span>
                                </Label>
                                {sensenovaApiBaseUrl ? statusBadge('UI', 'green') : hasEnvSensenovaApiBaseUrl ? statusBadge('ENV', 'blue') : statusBadge('默认', 'amber')}
                            </div>
                            <Input
                                id='sensenova-base-url'
                                type='url'
                                placeholder={envSensenovaApiBaseUrl || SENSENOVA_DEFAULT_BASE_URL}
                                value={sensenovaApiBaseUrl}
                                onChange={(event) => setSensenovaApiBaseUrl(event.target.value)}
                                autoComplete='off'
                                className='h-10 rounded-xl bg-background text-foreground'
                            />
                            <p className='text-xs text-muted-foreground'>内置模型 sensenova-u1-fast 默认使用独立图片生成接口，不支持图像输入。</p>
                        </div>
                    </ProviderSection>

                    <ProviderSection title='提示词润色' description='配置用于润色输入提示词的 OpenAI-compatible 文本模型。' icon={<Sparkles className='h-4 w-4' />}>
                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label htmlFor='polishing-api-key' className='flex items-center gap-2'>
                                    <Key className='h-4 w-4 text-muted-foreground' />
                                    润色 API Key
                                    <span className='text-xs font-normal text-muted-foreground'>(可选)</span>
                                </Label>
                                {polishingApiKey ? statusBadge('UI', 'green') : hasEnvPolishingApiKey ? statusBadge('ENV', 'blue') : statusBadge('复用 OpenAI', 'amber')}
                            </div>
                            <SecretInput
                                id='polishing-api-key'
                                value={polishingApiKey}
                                onChange={setPolishingApiKey}
                                visible={showPolishingApiKey}
                                onVisibleChange={() => setShowPolishingApiKey((value) => !value)}
                                placeholder='留空时复用 OpenAI API Key 或 POLISHING_API_KEY'
                            />
                            <p className='text-xs text-muted-foreground'>留空时优先使用 .env 的 POLISHING_API_KEY，其次复用 OpenAI API Key。</p>
                        </div>

                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label htmlFor='polishing-base-url' className='flex items-center gap-2'>
                                    <Globe className='h-4 w-4 text-muted-foreground' />
                                    润色 API Base URL
                                    <span className='text-xs font-normal text-muted-foreground'>(可选)</span>
                                </Label>
                                {polishingApiBaseUrl ? statusBadge('UI', 'green') : hasEnvPolishingApiBaseUrl ? statusBadge('ENV', 'blue') : statusBadge('复用 OpenAI', 'amber')}
                            </div>
                            <Input
                                id='polishing-base-url'
                                type='url'
                                placeholder='https://api.openai.com/v1'
                                value={polishingApiBaseUrl}
                                onChange={(event) => setPolishingApiBaseUrl(event.target.value)}
                                autoComplete='off'
                                className='h-10 rounded-xl bg-background text-foreground'
                            />
                            <p className='text-xs text-muted-foreground'>支持 OpenAI-compatible Chat Completions 端点；若直链优先开启且这里是非官方地址，会锁定客户端直连。</p>
                        </div>

                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label htmlFor='polishing-model-id' className='flex items-center gap-2'>
                                    <Cpu className='h-4 w-4 text-muted-foreground' />
                                    润色模型 ID
                                </Label>
                                {polishingModelId !== DEFAULT_PROMPT_POLISH_MODEL ? statusBadge('UI', 'green') : envPolishingModelId ? statusBadge('ENV', 'blue') : statusBadge('默认', 'amber')}
                            </div>
                            <Input
                                id='polishing-model-id'
                                value={polishingModelId}
                                onChange={(event) => setPolishingModelId(event.target.value)}
                                placeholder={envPolishingModelId || DEFAULT_PROMPT_POLISH_MODEL}
                                autoComplete='off'
                                spellCheck={false}
                                className='h-10 rounded-xl bg-background font-mono text-foreground'
                            />
                        </div>

                        <div className='space-y-3 rounded-xl border border-border bg-background/55 p-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label className='flex items-center gap-2'>
                                    <Cpu className='h-4 w-4 text-muted-foreground' />
                                    润色思考模式
                                </Label>
                                {polishingThinkingEnabled ? statusBadge('已开启', 'green') : envPolishingThinkingEnabled ? statusBadge('ENV', 'blue') : statusBadge('关闭', 'amber')}
                            </div>
                            <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                                <button
                                    type='button'
                                    onClick={() => setPolishingThinkingEnabled(false)}
                                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${!polishingThinkingEnabled ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                    关闭思考
                                </button>
                                <button
                                    type='button'
                                    onClick={() => setPolishingThinkingEnabled(true)}
                                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${polishingThinkingEnabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                    开启思考
                                </button>
                            </div>
                            <div className='grid gap-3 sm:grid-cols-2'>
                                <div className='space-y-2'>
                                    <Label htmlFor='polishing-thinking-format' className='text-xs text-muted-foreground'>思考强度参数格式</Label>
                                    <Select
                                        value={polishingThinkingEffortFormat}
                                        onValueChange={(value) => setPolishingThinkingEffortFormat(normalizePromptPolishThinkingEffortFormat(value))}
                                        disabled={!polishingThinkingEnabled}>
                                        <SelectTrigger id='polishing-thinking-format' className='h-10 rounded-xl bg-background text-foreground disabled:cursor-not-allowed disabled:opacity-50'>
                                            <SelectValue placeholder='选择兼容格式' />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(polishingThinkingFormatLabels).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='polishing-thinking-effort' className='text-xs text-muted-foreground'>思考强度</Label>
                                    <Input
                                        id='polishing-thinking-effort'
                                        list='polishing-thinking-effort-presets'
                                        value={polishingThinkingEffort}
                                        onChange={(event) => setPolishingThinkingEffort(event.target.value)}
                                        placeholder={envPolishingThinkingEffort || DEFAULT_PROMPT_POLISH_THINKING_EFFORT}
                                        autoComplete='off'
                                        spellCheck={false}
                                        disabled={!polishingThinkingEnabled}
                                        className='h-10 rounded-xl bg-background font-mono text-foreground disabled:cursor-not-allowed disabled:opacity-50'
                                    />
                                    <datalist id='polishing-thinking-effort-presets'>
                                        {PROMPT_POLISH_THINKING_EFFORT_OPTIONS.map((option) => (
                                            <option key={option} value={option} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>
                            <p className='text-xs text-muted-foreground'>
                                开启后会发送 <span className='font-mono'>thinking.type</span>，并按格式附加
                                <span className='font-mono'> reasoning_effort</span> 或 <span className='font-mono'>output_config.effort</span>。
                                支持输入自定义强度值；部分模型或严格端点可能不支持这些参数。
                            </p>
                            {polishingThinkingEnabled && (
                                <p className='text-xs text-muted-foreground'>{polishingThinkingFormatDescriptions[polishingThinkingEffortFormat]}</p>
                            )}
                            {(envPolishingThinkingEnabled || envPolishingThinkingEffort || envPolishingThinkingEffortFormat) && (
                                <p className='text-xs text-muted-foreground'>.env 可配置 POLISHING_THINKING_ENABLED / POLISHING_THINKING_EFFORT / POLISHING_THINKING_EFFORT_FORMAT。</p>
                            )}
                        </div>

                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label htmlFor='polishing-system-prompt' className='flex items-center gap-2'>
                                    <Sparkles className='h-4 w-4 text-muted-foreground' />
                                    润色提示词
                                </Label>
                                {polishingPrompt !== DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT ? statusBadge('UI', 'green') : hasEnvPolishingPrompt ? statusBadge('ENV', 'blue') : statusBadge('默认', 'amber')}
                            </div>
                            <Textarea
                                id='polishing-system-prompt'
                                value={polishingPrompt}
                                onChange={(event) => setPolishingPrompt(event.target.value)}
                                placeholder={DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT}
                                className='min-h-40 rounded-xl bg-background text-sm text-foreground'
                            />
                            <p className='text-xs text-muted-foreground'>这里是发给润色模型的系统提示词；按钮会把当前输入作为“原始提示词”一起发送。</p>
                        </div>
                    </ProviderSection>

                    <ProviderSection title='自定义模型 ID' description='官方新模型发布后，可先添加 ID 并选择兼容供应商，表单会立即可选。' icon={<Sparkles className='h-4 w-4' />}>
                        <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px_auto]'>
                            <Input
                                value={newModelId}
                                onChange={(event) => handleNewModelIdChange(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        addCustomModel();
                                    }
                                }}
                                placeholder='例如 gemini-4-flash-image 或 my-image-model'
                                autoComplete='off'
                                spellCheck={false}
                                className='h-10 rounded-xl bg-background text-foreground'
                            />
                            <Select value={newModelProvider} onValueChange={(value) => setNewModelProvider(value as ImageProviderId)}>
                                <SelectTrigger className='h-10 rounded-xl bg-background text-foreground'>
                                    <SelectValue placeholder='选择供应商' />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='openai'>OpenAI Compatible</SelectItem>
                                    <SelectItem value='google'>Google Gemini</SelectItem>
                                    <SelectItem value='seedream'>Seedream</SelectItem>
                                    <SelectItem value='sensenova'>SenseNova</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button type='button' onClick={addCustomModel} disabled={!newModelId.trim()} className='h-10 rounded-xl bg-violet-600 text-white hover:bg-violet-500'>
                                <Plus className='mr-1.5 h-4 w-4' />
                                添加
                            </Button>
                        </div>

                        {customImageModels.length > 0 ? (
                            <div className='space-y-2'>
                                {customImageModels.map((model) => (
                                    <div key={model.id} className='space-y-3 rounded-xl border border-border bg-background/70 p-3'>
                                        <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                                            <div className='min-w-0 flex-1'>
                                                <p className='truncate font-mono text-sm text-foreground'>{model.id}</p>
                                                <p className='text-xs text-muted-foreground'>{providerLabel(model.provider)}</p>
                                            </div>
                                            <Select value={model.provider} onValueChange={(value) => updateCustomModelProvider(model.id, value as ImageProviderId)}>
                                                <SelectTrigger className='h-9 rounded-xl bg-background text-foreground sm:w-[190px]'>
                                                    <SelectValue placeholder='供应商' />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value='openai'>OpenAI Compatible</SelectItem>
                                                    <SelectItem value='google'>Google Gemini</SelectItem>
                                                    <SelectItem value='seedream'>Seedream</SelectItem>
                                                    <SelectItem value='sensenova'>SenseNova</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button type='button' variant='ghost' size='icon' onClick={() => removeCustomModel(model.id)} className='h-9 w-9 text-muted-foreground hover:bg-red-500/10 hover:text-red-600' aria-label={`删除模型 ${model.id}`}>
                                                <Trash2 className='h-4 w-4' />
                                            </Button>
                                        </div>
                                        <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                                            {([
                                                ['supportsCustomSize', '允许自定义尺寸'],
                                                ['supportsEditing', '支持图片编辑'],
                                                ['supportsMask', '支持蒙版'],
                                                ['supportsQuality', '支持质量参数'],
                                                ['supportsOutputFormat', '支持输出格式'],
                                                ['supportsBackground', '支持背景参数'],
                                                ['supportsModeration', '支持审核参数'],
                                                ['supportsCompression', '支持压缩率'],
                                                ['supportsStreaming', '支持流式预览']
                                            ] as const).map(([capability, label]) => (
                                                <div key={capability} className='flex items-center gap-2'>
                                                    <Checkbox
                                                        id={`custom-${capability}-${model.id}`}
                                                        checked={model.capabilities?.[capability] === true}
                                                        onCheckedChange={(checked) => updateCustomModelCapability(model.id, capability, checked)}
                                                    />
                                                    <Label htmlFor={`custom-${capability}-${model.id}`} className='cursor-pointer text-xs text-muted-foreground'>{label}</Label>
                                                </div>
                                            ))}
                                        </div>
                                        <div className='grid gap-2 sm:grid-cols-4'>
                                            <Input
                                                value={model.defaultSize ?? ''}
                                                onChange={(event) => updateCustomModelDefaultSize(model.id, event.target.value)}
                                                placeholder='默认尺寸 2K 或 2048x2048'
                                                className='h-9 rounded-xl bg-background text-xs text-foreground sm:col-span-1'
                                            />
                                            <Input
                                                value={model.sizePresets?.square ?? ''}
                                                onChange={(event) => updateCustomModelSizePreset(model.id, 'square', event.target.value)}
                                                placeholder='正方形 2048x2048'
                                                className='h-9 rounded-xl bg-background text-xs text-foreground'
                                            />
                                            <Input
                                                value={model.sizePresets?.landscape ?? ''}
                                                onChange={(event) => updateCustomModelSizePreset(model.id, 'landscape', event.target.value)}
                                                placeholder='横向 2560x1440'
                                                className='h-9 rounded-xl bg-background text-xs text-foreground'
                                            />
                                            <Input
                                                value={model.sizePresets?.portrait ?? ''}
                                                onChange={(event) => updateCustomModelSizePreset(model.id, 'portrait', event.target.value)}
                                                placeholder='纵向 1440x2560'
                                                className='h-9 rounded-xl bg-background text-xs text-foreground'
                                            />
                                        </div>
                                        <p className='text-xs text-muted-foreground'>可为自定义模型覆盖能力、默认尺寸和预设；常用供应商参数会在生成表单中显示，JSON 仅作为新参数临时兜底。</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className='rounded-xl border border-dashed border-border bg-background/60 p-3 text-sm text-muted-foreground'>还没有自定义模型。系统预置模型仍会正常显示。</p>
                        )}
                    </ProviderSection>

                    <ProviderSection title='运行与存储' description='配置 API 连接、并发任务数量和图片存储模式。' icon={<Settings className='h-4 w-4' />}>
                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label className='flex items-center gap-2'>
                                    <Radio className='h-4 w-4 text-muted-foreground' />
                                    API 连接模式
                                </Label>
                                {statusBadge(connectionMode === 'proxy' ? '服务器中转' : '客户端直连', connectionMode === 'proxy' ? 'green' : 'amber')}
                            </div>
                            <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                                <button
                                    type='button'
                                    onClick={() => {
                                        if (!directLinkRestriction) setConnectionMode('proxy');
                                    }}
                                    disabled={!!directLinkRestriction}
                                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${connectionMode === 'proxy' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                    <Wifi className='h-4 w-4' />
                                    服务器中转
                                </button>
                                <button
                                    type='button'
                                    onClick={() => setConnectionMode('direct')}
                                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${connectionMode === 'direct' ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                    <Wifi className='h-4 w-4 rotate-45' />
                                    客户端直连
                                </button>
                            </div>
                            {directLinkRestriction && (
                                <div className='rounded-xl border border-sky-500/25 bg-sky-500/10 p-3'>
                                    <div className='flex gap-2'>
                                        <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300' />
                                        <div className='space-y-1 text-xs text-sky-800 dark:text-sky-200/90'>
                                            <p className='font-medium'>已锁定客户端直连</p>
                                            <p>{directLinkRestrictionMessage}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {connectionMode === 'direct' ? (
                                <div className='rounded-xl border border-amber-500/25 bg-amber-500/10 p-3'>
                                    <div className='flex gap-2'>
                                        <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300' />
                                        <div className='space-y-1 text-xs text-amber-800 dark:text-amber-200/90'>
                                            <p className='font-medium'>直连模式注意事项</p>
                                            <ul className='list-inside list-disc space-y-0.5 text-amber-800/80 dark:text-amber-200/75'>
                                                <li>浏览器会直接访问供应商或中转服务，API Key 会在 Network 面板可见。</li>
                                                <li>OpenAI 兼容端点通常需要 CORS 支持；Google Gemini 可使用官方 REST 端点。</li>
                                                <li>{serverHasAppPassword ? '服务器配置了 APP_PASSWORD，直连模式将绕过密码验证。' : '直连模式不经过服务器，不会触发 APP_PASSWORD 验证。'}</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className='text-xs text-muted-foreground'>请求经服务器转发，API Key 不在浏览器暴露，更安全。</p>
                            )}
                        </div>

                        <div className='space-y-3'>
                            <div className='flex items-center gap-2'>
                                <Label htmlFor='max-concurrent-tasks' className='flex items-center gap-2'>
                                    <Cpu className='h-4 w-4 text-muted-foreground' />
                                    并发任务数
                                </Label>
                                <span className='inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300'>{maxConcurrentTasks}</span>
                            </div>
                            <div className='flex items-center gap-4'>
                                <input
                                    id='max-concurrent-tasks'
                                    type='range'
                                    min='1'
                                    max='10'
                                    value={maxConcurrentTasks}
                                    onChange={(event) => setMaxConcurrentTasks(parseInt(event.target.value, 10))}
                                    className='h-2 flex-1 appearance-none rounded-full bg-muted accent-violet-600'
                                />
                                <span className='w-8 text-right font-mono text-sm text-muted-foreground tabular-nums'>{maxConcurrentTasks}</span>
                            </div>
                            <p className='text-xs text-muted-foreground'>同时执行的 API 请求数量，值越大效率越高但更容易触发速率限制。</p>
                        </div>

                        <div className='space-y-3'>
                            <div className='flex items-center gap-2'>
                                <Label htmlFor='prompt-history-limit' className='flex items-center gap-2'>
                                    <History className='h-4 w-4 text-muted-foreground' />
                                    提示词历史数量
                                </Label>
                                <span className='inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300'>{promptHistoryLimit}</span>
                            </div>
                            <div className='flex items-center gap-4'>
                                <input
                                    id='prompt-history-limit'
                                    type='range'
                                    min='1'
                                    max='100'
                                    value={promptHistoryLimit}
                                    onChange={(event) => setPromptHistoryLimit(normalizePromptHistoryLimit(event.target.value))}
                                    className='h-2 flex-1 appearance-none rounded-full bg-muted accent-violet-600'
                                />
                                <span className='w-10 text-right font-mono text-sm text-muted-foreground tabular-nums'>{promptHistoryLimit}</span>
                            </div>
                            <p className='text-xs text-muted-foreground'>记录最近使用的提示词，默认保留 20 条，方便从输入框下方快速找回。</p>
                        </div>

                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label className='flex items-center gap-2'>
                                    <Database className='h-4 w-4 text-muted-foreground' />
                                    图片存储模式
                                </Label>
                                {statusBadge(storageMode !== 'auto' ? 'UI' : hasEnvStorageMode ? 'ENV' : 'AUTO', storageMode !== 'auto' ? 'green' : 'blue')}
                            </div>
                            <Select onValueChange={(value) => setStorageMode(value as typeof storageMode)} value={storageMode}>
                                <SelectTrigger className='h-10 w-full rounded-xl bg-background text-foreground'>
                                    <SelectValue placeholder='选择存储模式' />
                                </SelectTrigger>
                                <SelectContent>
                                    {storageOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className='space-y-1 text-xs text-muted-foreground'>
                                <p><strong>自动检测:</strong> Vercel → IndexedDB，本地运行 → 文件系统</p>
                                <p><strong>文件系统:</strong> 图片保存到 <code className='text-foreground'>./generated-images</code> 目录</p>
                                <p><strong>IndexedDB:</strong> 图片保存在浏览器本地存储，适合无服务器部署</p>
                            </div>
                        </div>
                    </ProviderSection>

                    <div className='border-t border-border pt-2'>
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={handleReset}
                            className='h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-red-600'>
                            <Plus className='mr-1 h-3 w-3 rotate-45' />
                            重置所有配置
                        </Button>
                    </div>
                </div>

                <DialogFooter className='sticky bottom-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur sm:px-6'>
                    {saved && <p className='mr-auto text-xs text-emerald-600 dark:text-emerald-300'>已保存，配置立即生效 ✓</p>}
                    <Button variant='outline' onClick={() => setOpen(false)} className='rounded-xl'>取消</Button>
                    <Button
                        onClick={handleSave}
                        className='rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20 hover:brightness-110 disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:shadow-none'>
                        保存配置
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
