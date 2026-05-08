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
import { DESKTOP_APP_DOWNLOAD_URL, DESKTOP_ONLY_SETTINGS_MESSAGE } from '@/lib/desktop-guidance';
import { isValidProxyUrl, normalizeDesktopProxyMode, normalizeDesktopProxyUrl, type DesktopProxyMode } from '@/lib/desktop-config';
import { handleExternalLinkClick, invokeDesktopCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import { getAllImageModels, getProviderLabel, IMAGE_MODEL_IDS, IMAGE_PROVIDER_ORDER, normalizeCustomImageModels, type CustomImageModelCapabilities, type ImageProviderId, type StoredCustomImageModel } from '@/lib/model-registry';
import { SEEDREAM_DEFAULT_BASE_URL, SENSENOVA_DEFAULT_BASE_URL, getProviderDefaultBaseUrl } from '@/lib/provider-config';
import {
    createProviderInstanceId,
    getProviderInstanceHostname,
    normalizeProviderInstances,
    type ProviderInstance
} from '@/lib/provider-instances';
import {
    DEFAULT_POLISHING_PRESET_ID,
    DEFAULT_PROMPT_POLISH_MODEL,
    DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
    DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
    DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT,
    DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
    PROMPT_POLISH_PRESETS,
    PROMPT_POLISH_THINKING_EFFORT_OPTIONS,
    normalizeSavedCustomPolishPrompt,
    normalizePromptPolishThinkingEffortFormat,
    normalizePromptPolishPresetId,
    type PromptPolishThinkingEffortFormat
} from '@/lib/prompt-polish-core';
import { DEFAULT_PROMPT_HISTORY_LIMIT, normalizePromptHistoryLimit } from '@/lib/prompt-history';
import {
    AlertTriangle,
    ArrowLeft,
    ChevronDown,
    ChevronRight,
    Cpu,
    Database,
    Download,
    Eye,
    EyeOff,
    FolderOpen,
    Globe,
    Key,
    Plus,
    Radio,
    History,
    Settings,
    Sparkles,
    Trash2,
    Wifi,
    Bug
} from 'lucide-react';
import * as React from 'react';

type SettingsDialogProps = {
    onConfigChange: (config: Partial<AppConfig>) => void;
};

type SettingsView = 'main' | 'providers';

type InitialConfig = {
    apiKey: string;
    apiBaseUrl: string;
    geminiApiKey: string;
    geminiApiBaseUrl: string;
    sensenovaApiKey: string;
    sensenovaApiBaseUrl: string;
    seedreamApiKey: string;
    seedreamApiBaseUrl: string;
    providerInstances: ProviderInstance[];
    selectedProviderInstanceId: string;
    customImageModels: StoredCustomImageModel[];
    polishingApiKey: string;
    polishingApiBaseUrl: string;
    polishingModelId: string;
    polishingPrompt: string;
    polishingPresetId: string;
    polishingThinkingEnabled: boolean;
    polishingThinkingEffort: string;
    polishingThinkingEffortFormat: PromptPolishThinkingEffortFormat;
    storageMode: string;
    imageStoragePath: string;
    connectionMode: string;
    maxConcurrentTasks: number;
    promptHistoryLimit: number;
    desktopProxyMode: DesktopProxyMode;
    desktopProxyUrl: string;
    desktopDebugMode: boolean;
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

type ProviderApiConfigMetadata = {
    title: string;
    description: string;
    icon: React.ReactNode;
    apiKeyId: string;
    apiKeyLabel: string;
    apiKeyValue: string;
    onApiKeyChange: (value: string) => void;
    apiKeyVisible: boolean;
    onApiKeyVisibleChange: () => void;
    apiKeyPlaceholder: string;
    apiKeyStatus: React.ReactNode;
    apiKeyHint?: string;
    baseUrlId: string;
    baseUrlLabel: string;
    baseUrlValue: string;
    onBaseUrlChange: (value: string) => void;
    baseUrlPlaceholder: string;
    baseUrlStatus: React.ReactNode;
    baseUrlHint?: string;
};

function providerLabel(provider: ImageProviderId): string {
    return getProviderLabel(provider);
}

export function SettingsDialog({ onConfigChange }: SettingsDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [settingsView, setSettingsView] = React.useState<SettingsView>('main');
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
    const [polishingPresetId, setPolishingPresetId] = React.useState(DEFAULT_POLISHING_PRESET_ID);
    const [polishingThinkingEnabled, setPolishingThinkingEnabled] = React.useState(DEFAULT_PROMPT_POLISH_THINKING_ENABLED);
    const [polishingThinkingEffort, setPolishingThinkingEffort] = React.useState(DEFAULT_PROMPT_POLISH_THINKING_EFFORT);
    const [polishingThinkingEffortFormat, setPolishingThinkingEffortFormat] = React.useState<PromptPolishThinkingEffortFormat>(
        DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT
    );
    const [customImageModels, setCustomImageModels] = React.useState<StoredCustomImageModel[]>([]);
    const [providerInstances, setProviderInstances] = React.useState<ProviderInstance[]>([]);
    const [selectedProviderInstanceId, setSelectedProviderInstanceId] = React.useState('');
    const [newProviderType, setNewProviderType] = React.useState<ImageProviderId>('openai');
    const [newProviderName, setNewProviderName] = React.useState('');
    const [newProviderApiKey, setNewProviderApiKey] = React.useState('');
    const [newProviderApiBaseUrl, setNewProviderApiBaseUrl] = React.useState('');
    const [providerApiKeyVisibility, setProviderApiKeyVisibility] = React.useState<Record<string, boolean>>({});
    const [newModelByProviderInstance, setNewModelByProviderInstance] = React.useState<Record<string, string>>({});
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
        providerInstances: [],
        selectedProviderInstanceId: '',
        customImageModels: [],
        polishingApiKey: '',
        polishingApiBaseUrl: '',
        polishingModelId: DEFAULT_PROMPT_POLISH_MODEL,
        polishingPrompt: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
        polishingPresetId: DEFAULT_POLISHING_PRESET_ID,
        polishingThinkingEnabled: DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
        polishingThinkingEffort: DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
        polishingThinkingEffortFormat: DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT,
        storageMode: 'auto',
        imageStoragePath: '',
        connectionMode: 'proxy',
        maxConcurrentTasks: 3,
        promptHistoryLimit: DEFAULT_PROMPT_HISTORY_LIMIT,
        desktopProxyMode: 'disabled',
        desktopProxyUrl: '',
        desktopDebugMode: false
    });
    const [maxConcurrentTasks, setMaxConcurrentTasks] = React.useState(3);
    const [promptHistoryLimit, setPromptHistoryLimit] = React.useState(DEFAULT_PROMPT_HISTORY_LIMIT);
    const [desktopProxyMode, setDesktopProxyMode] = React.useState<DesktopProxyMode>('disabled');
    const [desktopProxyUrl, setDesktopProxyUrl] = React.useState('');
    const [desktopDebugMode, setDesktopDebugMode] = React.useState(false);
    const [proxyUrlError, setProxyUrlError] = React.useState('');
    const [isDesktopRuntime, setIsDesktopRuntime] = React.useState(false);
    const [imageStoragePath, setImageStoragePath] = React.useState('');
    const [defaultImageStoragePath, setDefaultImageStoragePath] = React.useState('');
    const [imageStoragePathError, setImageStoragePathError] = React.useState('');

    React.useEffect(() => {
        setIsDesktopRuntime(isTauriDesktop());
    }, []);

    React.useEffect(() => {
        if (!open) return;

        const config = loadConfig();
        const normalizedCustomModels = normalizeCustomImageModels(config.customImageModels);
        const normalizedProviderInstances = normalizeProviderInstances(config.providerInstances, config);
        setApiKey(config.openaiApiKey || '');
        setApiBaseUrl(config.openaiApiBaseUrl || '');
        setGeminiApiKey(config.geminiApiKey || '');
        setGeminiApiBaseUrl(config.geminiApiBaseUrl || '');
        setSensenovaApiKey(config.sensenovaApiKey || '');
        setSensenovaApiBaseUrl(config.sensenovaApiBaseUrl || '');
        setSeedreamApiKey(config.seedreamApiKey || '');
        setSeedreamApiBaseUrl(config.seedreamApiBaseUrl || '');
        setProviderInstances(normalizedProviderInstances);
        setSelectedProviderInstanceId(config.selectedProviderInstanceId || '');
        setPolishingApiKey(config.polishingApiKey || '');
        setPolishingApiBaseUrl(config.polishingApiBaseUrl || '');
        setPolishingModelId(config.polishingModelId || DEFAULT_PROMPT_POLISH_MODEL);
        setPolishingPrompt(config.polishingPrompt || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT);
        setPolishingPresetId(normalizePromptPolishPresetId(config.polishingPresetId));
        setPolishingThinkingEnabled(config.polishingThinkingEnabled);
        setPolishingThinkingEffort(config.polishingThinkingEffort || DEFAULT_PROMPT_POLISH_THINKING_EFFORT);
        setPolishingThinkingEffortFormat(normalizePromptPolishThinkingEffortFormat(config.polishingThinkingEffortFormat));
        setCustomImageModels(normalizedCustomModels);
        setStorageMode(config.imageStorageMode || 'auto');
        setImageStoragePath(config.imageStoragePath || '');
        setConnectionMode(config.connectionMode || 'proxy');
        setMaxConcurrentTasks(config.maxConcurrentTasks || 3);
        setPromptHistoryLimit(normalizePromptHistoryLimit(config.promptHistoryLimit));
        setDesktopProxyMode(normalizeDesktopProxyMode(config.desktopProxyMode));
        setDesktopProxyUrl(config.desktopProxyUrl || '');
        setDesktopDebugMode(config.desktopDebugMode || false);
        setImageStoragePathError('');
        setNewProviderType('openai');
        setNewProviderName('');
        setNewProviderApiKey('');
        setNewProviderApiBaseUrl('');
        setProviderApiKeyVisibility({});
        setNewModelByProviderInstance({});
        setSettingsView('main');
        setInitialConfig({
            apiKey: config.openaiApiKey || '',
            apiBaseUrl: config.openaiApiBaseUrl || '',
            geminiApiKey: config.geminiApiKey || '',
            geminiApiBaseUrl: config.geminiApiBaseUrl || '',
            sensenovaApiKey: config.sensenovaApiKey || '',
            sensenovaApiBaseUrl: config.sensenovaApiBaseUrl || '',
            seedreamApiKey: config.seedreamApiKey || '',
            seedreamApiBaseUrl: config.seedreamApiBaseUrl || '',
            providerInstances: normalizedProviderInstances,
            selectedProviderInstanceId: config.selectedProviderInstanceId || '',
            customImageModels: normalizedCustomModels,
            polishingApiKey: config.polishingApiKey || '',
            polishingApiBaseUrl: config.polishingApiBaseUrl || '',
            polishingModelId: config.polishingModelId || DEFAULT_PROMPT_POLISH_MODEL,
            polishingPrompt: config.polishingPrompt || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
            polishingPresetId: normalizePromptPolishPresetId(config.polishingPresetId),
            polishingThinkingEnabled: config.polishingThinkingEnabled,
            polishingThinkingEffort: config.polishingThinkingEffort || DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
            polishingThinkingEffortFormat: normalizePromptPolishThinkingEffortFormat(config.polishingThinkingEffortFormat),
            storageMode: config.imageStorageMode || 'auto',
            imageStoragePath: config.imageStoragePath || '',
            connectionMode: config.connectionMode || 'proxy',
            maxConcurrentTasks: config.maxConcurrentTasks || 3,
            promptHistoryLimit: normalizePromptHistoryLimit(config.promptHistoryLimit),
            desktopProxyMode: normalizeDesktopProxyMode(config.desktopProxyMode),
            desktopProxyUrl: config.desktopProxyUrl || '',
            desktopDebugMode: config.desktopDebugMode || false
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

    React.useEffect(() => {
        if (!open || !isDesktopRuntime) return;
        let active = true;

        invokeDesktopCommand<string>('get_default_image_storage_dir')
            .then((path) => {
                if (active) setDefaultImageStoragePath(path);
            })
            .catch((error: unknown) => {
                console.warn('Failed to load default desktop image storage directory:', error);
            });

        return () => {
            active = false;
        };
    }, [isDesktopRuntime, open]);

    const removeCustomModel = React.useCallback((id: string) => {
        setCustomImageModels((current) => current.filter((model) => model.id !== id));
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

    const updateProviderInstance = React.useCallback((id: string, updates: Partial<ProviderInstance>) => {
        setProviderInstances((current) => normalizeProviderInstances(
            current.map((instance) => instance.id === id ? { ...instance, ...updates } : instance),
            {
                openaiApiKey: apiKey,
                openaiApiBaseUrl: apiBaseUrl,
                geminiApiKey,
                geminiApiBaseUrl,
                sensenovaApiKey,
                sensenovaApiBaseUrl,
                seedreamApiKey,
                seedreamApiBaseUrl
            }
        ));
    }, [apiBaseUrl, apiKey, geminiApiBaseUrl, geminiApiKey, seedreamApiBaseUrl, seedreamApiKey, sensenovaApiBaseUrl, sensenovaApiKey]);

    const addProviderInstance = React.useCallback(() => {
        const newApiBaseUrl = newProviderApiBaseUrl.trim();
        const name = newProviderName.trim() || getProviderInstanceHostname(newApiBaseUrl) || getProviderLabel(newProviderType);
        const id = createProviderInstanceId(newProviderType, newApiBaseUrl || name, providerInstances.map((instance) => instance.id));
        setProviderInstances((current) => normalizeProviderInstances([
            ...current,
            {
                id,
                type: newProviderType,
                name,
                apiKey: newProviderApiKey.trim(),
                apiBaseUrl: newApiBaseUrl,
                models: []
            }
        ], {
            openaiApiKey: apiKey,
            openaiApiBaseUrl: apiBaseUrl,
            geminiApiKey,
            geminiApiBaseUrl,
            sensenovaApiKey,
            sensenovaApiBaseUrl,
            seedreamApiKey,
            seedreamApiBaseUrl
        }));
        setSelectedProviderInstanceId(id);
        setNewProviderName('');
        setNewProviderApiKey('');
        setNewProviderApiBaseUrl('');
    }, [apiBaseUrl, apiKey, geminiApiBaseUrl, geminiApiKey, newProviderApiBaseUrl, newProviderApiKey, newProviderName, newProviderType, providerInstances, seedreamApiBaseUrl, seedreamApiKey, sensenovaApiBaseUrl, sensenovaApiKey]);

    const removeProviderInstance = React.useCallback((id: string) => {
        setProviderInstances((current) => {
            const target = current.find((instance) => instance.id === id);
            if (!target) return current;
            const instancesForType = current.filter((instance) => instance.type === target.type);
            if (instancesForType.length <= 1) return current;
            const remaining = current.filter((instance) => instance.id !== id);
            const next = normalizeProviderInstances(remaining, {
                openaiApiKey: apiKey,
                openaiApiBaseUrl: apiBaseUrl,
                geminiApiKey,
                geminiApiBaseUrl,
                sensenovaApiKey,
                sensenovaApiBaseUrl,
                seedreamApiKey,
                seedreamApiBaseUrl
            });
            if (selectedProviderInstanceId === id) {
                setSelectedProviderInstanceId(next.find((instance) => instance.type === target.type)?.id || '');
            }
            return next;
        });
    }, [apiBaseUrl, apiKey, geminiApiBaseUrl, geminiApiKey, seedreamApiBaseUrl, seedreamApiKey, selectedProviderInstanceId, sensenovaApiBaseUrl, sensenovaApiKey]);

    const setProviderInstanceDefault = React.useCallback((id: string) => {
        setProviderInstances((current) => {
            const target = current.find((instance) => instance.id === id);
            if (!target) return current;
            return normalizeProviderInstances(current.map((instance) => instance.type === target.type
                ? { ...instance, isDefault: instance.id === id }
                : instance
            ));
        });
        setSelectedProviderInstanceId(id);
    }, []);

    const updateProviderInstanceModel = React.useCallback((instanceId: string, modelId: string, enabled: boolean | string) => {
        const checked = !!enabled;
        setProviderInstances((current) => normalizeProviderInstances(current.map((instance) => {
            if (instance.id !== instanceId) return instance;
            const availableModels = getAllImageModels(customImageModels)
                .filter((model) => model.provider === instance.type)
                .map((model) => model.id);
            const currentModels = instance.models.length > 0 ? instance.models : availableModels;
            const models = checked
                ? [...currentModels.filter((id) => id !== modelId), modelId]
                : currentModels.filter((id) => id !== modelId);
            return { ...instance, models };
        })));
    }, [customImageModels]);

    const addModelToProviderInstance = React.useCallback((instance: ProviderInstance, modelId: string) => {
        const id = modelId.trim();
        if (!id) return;
        updateProviderInstanceModel(instance.id, id, true);
        if (!IMAGE_MODEL_IDS.includes(id) && !customImageModels.some((model) => model.id === id)) {
            setCustomImageModels((current) => normalizeCustomImageModels([...current, { id, provider: instance.type, instanceId: instance.id }]));
        }
    }, [customImageModels, updateProviderInstanceModel]);

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
            providerInstances,
            envSeedreamApiBaseUrl
        }),
        [apiBaseUrl, clientDirectLinkPriority, envApiBaseUrl, envGeminiApiBaseUrl, envPolishingApiBaseUrl, envSeedreamApiBaseUrl, envSensenovaApiBaseUrl, geminiApiBaseUrl, polishingApiBaseUrl, providerInstances, seedreamApiBaseUrl, sensenovaApiBaseUrl]
    );
    const directLinkRestrictionMessage = directLinkRestriction ? formatClientDirectLinkRestriction(directLinkRestriction) : '';
    const effectiveConnectionMode = directLinkRestriction ? 'direct' : connectionMode;
    const selectedPolishPreset = React.useMemo(
        () =>
            PROMPT_POLISH_PRESETS.find((preset) => preset.id === polishingPresetId) ||
            PROMPT_POLISH_PRESETS.find((preset) => preset.id === DEFAULT_POLISHING_PRESET_ID) ||
            PROMPT_POLISH_PRESETS[0],
        [polishingPresetId]
    );
    const savedCustomPolishingPrompt = normalizeSavedCustomPolishPrompt(polishingPrompt);
    const hasSavedCustomPolishingPrompt = Boolean(savedCustomPolishingPrompt);
    const providerApiConfigs = React.useMemo<Record<ImageProviderId, ProviderApiConfigMetadata>>(() => ({
        openai: {
            title: 'OpenAI',
            description: '官方 OpenAI 或 OpenAI 兼容端点。',
            icon: <Globe className='h-4 w-4' />,
            apiKeyId: 'openai-api-key',
            apiKeyLabel: 'OpenAI API Key',
            apiKeyValue: apiKey,
            onApiKeyChange: setApiKey,
            apiKeyVisible: showApiKey,
            onApiKeyVisibleChange: () => setShowApiKey((value) => !value),
            apiKeyPlaceholder: 'sk-…',
            apiKeyStatus: apiKey ? statusBadge('UI', 'green') : hasEnvApiKey ? statusBadge('ENV', 'blue') : null,
            apiKeyHint: hasEnvApiKey ? '.env 中已配置，当前为空时使用 ENV 值。' : undefined,
            baseUrlId: 'openai-base-url',
            baseUrlLabel: 'OpenAI API Base URL',
            baseUrlValue: apiBaseUrl,
            onBaseUrlChange: setApiBaseUrl,
            baseUrlPlaceholder: 'https://api.openai.com/v1',
            baseUrlStatus: apiBaseUrl ? statusBadge('UI', 'green') : hasEnvApiBaseUrl ? statusBadge('ENV', 'blue') : null,
            baseUrlHint: hasEnvApiBaseUrl ? '.env 中已配置，当前为空时使用 ENV 值。' : undefined
        },
        google: {
            title: 'Google Gemini',
            description: 'Gemini 图像模型接口配置。',
            icon: <Sparkles className='h-4 w-4' />,
            apiKeyId: 'gemini-api-key',
            apiKeyLabel: 'Gemini API Key',
            apiKeyValue: geminiApiKey,
            onApiKeyChange: setGeminiApiKey,
            apiKeyVisible: showGeminiApiKey,
            onApiKeyVisibleChange: () => setShowGeminiApiKey((value) => !value),
            apiKeyPlaceholder: 'AIza…',
            apiKeyStatus: geminiApiKey ? statusBadge('UI', 'green') : hasEnvGeminiApiKey ? statusBadge('ENV', 'blue') : null,
            apiKeyHint: hasEnvGeminiApiKey ? '.env 中已配置 GEMINI_API_KEY，当前为空时使用 ENV 值。' : undefined,
            baseUrlId: 'gemini-base-url',
            baseUrlLabel: 'Gemini API Base URL',
            baseUrlValue: geminiApiBaseUrl,
            onBaseUrlChange: setGeminiApiBaseUrl,
            baseUrlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
            baseUrlStatus: geminiApiBaseUrl ? statusBadge('UI', 'green') : hasEnvGeminiApiBaseUrl ? statusBadge('ENV', 'blue') : null,
            baseUrlHint: '用于 Google Gemini 图像模型。'
        },
        seedream: {
            title: 'Seedream / 火山方舟',
            description: '豆包 Seedream 文生图、图生图和组图接口。',
            icon: <Sparkles className='h-4 w-4' />,
            apiKeyId: 'seedream-api-key',
            apiKeyLabel: 'Seedream API Key',
            apiKeyValue: seedreamApiKey,
            onApiKeyChange: setSeedreamApiKey,
            apiKeyVisible: showSeedreamApiKey,
            onApiKeyVisibleChange: () => setShowSeedreamApiKey((value) => !value),
            apiKeyPlaceholder: 'VolcEngine Ark API Key',
            apiKeyStatus: seedreamApiKey ? statusBadge('UI', 'green') : hasEnvSeedreamApiKey ? statusBadge('ENV', 'blue') : null,
            apiKeyHint: hasEnvSeedreamApiKey ? '.env 中已配置 SEEDREAM_API_KEY，当前为空时使用 ENV 值。' : undefined,
            baseUrlId: 'seedream-base-url',
            baseUrlLabel: 'Seedream API Base URL',
            baseUrlValue: seedreamApiBaseUrl,
            onBaseUrlChange: setSeedreamApiBaseUrl,
            baseUrlPlaceholder: envSeedreamApiBaseUrl || SEEDREAM_DEFAULT_BASE_URL,
            baseUrlStatus: seedreamApiBaseUrl ? statusBadge('UI', 'green') : hasEnvSeedreamApiBaseUrl ? statusBadge('ENV', 'blue') : statusBadge('默认', 'amber'),
            baseUrlHint: '支持 Seedream 默认图片生成接口；高级参数在生成表单中配置。'
        },
        sensenova: {
            title: 'SenseNova',
            description: '商汤 SenseNova U1 Fast 图像生成接口。',
            icon: <Sparkles className='h-4 w-4' />,
            apiKeyId: 'sensenova-api-key',
            apiKeyLabel: 'SenseNova API Key',
            apiKeyValue: sensenovaApiKey,
            onApiKeyChange: setSensenovaApiKey,
            apiKeyVisible: showSensenovaApiKey,
            onApiKeyVisibleChange: () => setShowSensenovaApiKey((value) => !value),
            apiKeyPlaceholder: 'SenseNova bearer token',
            apiKeyStatus: sensenovaApiKey ? statusBadge('UI', 'green') : hasEnvSensenovaApiKey ? statusBadge('ENV', 'blue') : null,
            apiKeyHint: hasEnvSensenovaApiKey ? '.env 中已配置 SENSENOVA_API_KEY，当前为空时使用 ENV 值。' : undefined,
            baseUrlId: 'sensenova-base-url',
            baseUrlLabel: 'SenseNova API Base URL',
            baseUrlValue: sensenovaApiBaseUrl,
            onBaseUrlChange: setSensenovaApiBaseUrl,
            baseUrlPlaceholder: envSensenovaApiBaseUrl || SENSENOVA_DEFAULT_BASE_URL,
            baseUrlStatus: sensenovaApiBaseUrl ? statusBadge('UI', 'green') : hasEnvSensenovaApiBaseUrl ? statusBadge('ENV', 'blue') : statusBadge('默认', 'amber'),
            baseUrlHint: '内置模型 sensenova-u1-fast 默认使用独立图片生成接口。'
        }
    }), [apiBaseUrl, apiKey, envSeedreamApiBaseUrl, envSensenovaApiBaseUrl, geminiApiBaseUrl, geminiApiKey, hasEnvApiBaseUrl, hasEnvApiKey, hasEnvGeminiApiBaseUrl, hasEnvGeminiApiKey, hasEnvSeedreamApiBaseUrl, hasEnvSeedreamApiKey, hasEnvSensenovaApiBaseUrl, hasEnvSensenovaApiKey, seedreamApiBaseUrl, seedreamApiKey, sensenovaApiBaseUrl, sensenovaApiKey, showApiKey, showGeminiApiKey, showSeedreamApiKey, showSensenovaApiKey]);
    const hasUnsavedChanges = React.useMemo(() => {
        const normalizedCustomModels = normalizeCustomImageModels(customImageModels);
        const normalizedProviderInstances = normalizeProviderInstances(providerInstances, {
            openaiApiKey: apiKey,
            openaiApiBaseUrl: apiBaseUrl,
            geminiApiKey,
            geminiApiBaseUrl,
            sensenovaApiKey,
            sensenovaApiBaseUrl,
            seedreamApiKey,
            seedreamApiBaseUrl
        });
        const comparableConnectionMode = directLinkRestriction ? 'direct' : initialConfig.connectionMode;
        return (
            apiKey !== initialConfig.apiKey ||
            apiBaseUrl !== initialConfig.apiBaseUrl ||
            geminiApiKey !== initialConfig.geminiApiKey ||
            geminiApiBaseUrl !== initialConfig.geminiApiBaseUrl ||
            sensenovaApiKey !== initialConfig.sensenovaApiKey ||
            sensenovaApiBaseUrl !== initialConfig.sensenovaApiBaseUrl ||
            seedreamApiKey !== initialConfig.seedreamApiKey ||
            seedreamApiBaseUrl !== initialConfig.seedreamApiBaseUrl ||
            selectedProviderInstanceId !== initialConfig.selectedProviderInstanceId ||
            JSON.stringify(normalizedProviderInstances) !== JSON.stringify(initialConfig.providerInstances) ||
            polishingApiKey !== initialConfig.polishingApiKey ||
            polishingApiBaseUrl !== initialConfig.polishingApiBaseUrl ||
            polishingModelId !== initialConfig.polishingModelId ||
            polishingPrompt !== initialConfig.polishingPrompt ||
            polishingPresetId !== initialConfig.polishingPresetId ||
            polishingThinkingEnabled !== initialConfig.polishingThinkingEnabled ||
            polishingThinkingEffort !== initialConfig.polishingThinkingEffort ||
            polishingThinkingEffortFormat !== initialConfig.polishingThinkingEffortFormat ||
            JSON.stringify(normalizedCustomModels) !== JSON.stringify(initialConfig.customImageModels) ||
            storageMode !== initialConfig.storageMode ||
            imageStoragePath !== initialConfig.imageStoragePath ||
            effectiveConnectionMode !== comparableConnectionMode ||
            maxConcurrentTasks !== initialConfig.maxConcurrentTasks ||
            promptHistoryLimit !== initialConfig.promptHistoryLimit ||
            desktopProxyMode !== initialConfig.desktopProxyMode ||
            desktopProxyUrl !== initialConfig.desktopProxyUrl ||
            desktopDebugMode !== initialConfig.desktopDebugMode
        );
    }, [apiBaseUrl, apiKey, customImageModels, desktopDebugMode, desktopProxyMode, desktopProxyUrl, directLinkRestriction, effectiveConnectionMode, geminiApiBaseUrl, geminiApiKey, imageStoragePath, initialConfig, maxConcurrentTasks, polishingApiBaseUrl, polishingApiKey, polishingModelId, polishingPresetId, polishingPrompt, polishingThinkingEffort, polishingThinkingEffortFormat, polishingThinkingEnabled, promptHistoryLimit, providerInstances, seedreamApiBaseUrl, seedreamApiKey, selectedProviderInstanceId, sensenovaApiBaseUrl, sensenovaApiKey, storageMode]);

    const handleDialogOpenChange = React.useCallback((nextOpen: boolean) => {
        if (nextOpen) {
            setSettingsView('main');
            setOpen(true);
            return;
        }
        if (!saved && hasUnsavedChanges && !window.confirm('配置已修改但尚未保存，确定要关闭系统配置吗？')) {
            return;
        }
        setOpen(false);
    }, [hasUnsavedChanges, saved]);

    React.useEffect(() => {
        if (directLinkRestriction && connectionMode !== 'direct') {
            setConnectionMode('direct');
        }
    }, [connectionMode, directLinkRestriction]);

    const handleSave = () => {
        const normalizedCustomModels = normalizeCustomImageModels(customImageModels);
        const normalizedProviderInstances = normalizeProviderInstances(providerInstances, {
            openaiApiKey: apiKey,
            openaiApiBaseUrl: apiBaseUrl,
            geminiApiKey,
            geminiApiBaseUrl,
            sensenovaApiKey,
            sensenovaApiBaseUrl,
            seedreamApiKey,
            seedreamApiBaseUrl
        });
        const defaultProviderInstanceByType = (type: ImageProviderId) =>
            normalizedProviderInstances.find((instance) => instance.type === type && instance.isDefault) ||
            normalizedProviderInstances.find((instance) => instance.type === type);
        const defaultOpenAIInstance = defaultProviderInstanceByType('openai');
        const defaultGeminiInstance = defaultProviderInstanceByType('google');
        const defaultSensenovaInstance = defaultProviderInstanceByType('sensenova');
        const defaultSeedreamInstance = defaultProviderInstanceByType('seedream');
        const nextApiKey = defaultOpenAIInstance?.apiKey ?? apiKey;
        const nextApiBaseUrl = defaultOpenAIInstance?.apiBaseUrl ?? apiBaseUrl;
        const nextGeminiApiKey = defaultGeminiInstance?.apiKey ?? geminiApiKey;
        const nextGeminiApiBaseUrl = defaultGeminiInstance?.apiBaseUrl ?? geminiApiBaseUrl;
        const nextSensenovaApiKey = defaultSensenovaInstance?.apiKey ?? sensenovaApiKey;
        const nextSensenovaApiBaseUrl = defaultSensenovaInstance?.apiBaseUrl ?? sensenovaApiBaseUrl;
        const nextSeedreamApiKey = defaultSeedreamInstance?.apiKey ?? seedreamApiKey;
        const nextSeedreamApiBaseUrl = defaultSeedreamInstance?.apiBaseUrl ?? seedreamApiBaseUrl;
        const savedConnectionMode = effectiveConnectionMode;
        const newConfig: Partial<AppConfig> = {};
        if (nextApiKey !== initialConfig.apiKey) newConfig.openaiApiKey = nextApiKey;
        if (nextApiBaseUrl !== initialConfig.apiBaseUrl) newConfig.openaiApiBaseUrl = nextApiBaseUrl;
        if (nextGeminiApiKey !== initialConfig.geminiApiKey) newConfig.geminiApiKey = nextGeminiApiKey;
        if (nextGeminiApiBaseUrl !== initialConfig.geminiApiBaseUrl) newConfig.geminiApiBaseUrl = nextGeminiApiBaseUrl;
        if (nextSensenovaApiKey !== initialConfig.sensenovaApiKey) newConfig.sensenovaApiKey = nextSensenovaApiKey;
        if (nextSensenovaApiBaseUrl !== initialConfig.sensenovaApiBaseUrl) newConfig.sensenovaApiBaseUrl = nextSensenovaApiBaseUrl;
        if (nextSeedreamApiKey !== initialConfig.seedreamApiKey) newConfig.seedreamApiKey = nextSeedreamApiKey;
        if (nextSeedreamApiBaseUrl !== initialConfig.seedreamApiBaseUrl) newConfig.seedreamApiBaseUrl = nextSeedreamApiBaseUrl;
        if (selectedProviderInstanceId !== initialConfig.selectedProviderInstanceId) newConfig.selectedProviderInstanceId = selectedProviderInstanceId;
        if (JSON.stringify(normalizedProviderInstances) !== JSON.stringify(initialConfig.providerInstances)) {
            newConfig.providerInstances = normalizedProviderInstances;
        }
        if (polishingApiKey !== initialConfig.polishingApiKey) newConfig.polishingApiKey = polishingApiKey;
        if (polishingApiBaseUrl !== initialConfig.polishingApiBaseUrl) newConfig.polishingApiBaseUrl = polishingApiBaseUrl;
        if (polishingModelId !== initialConfig.polishingModelId) newConfig.polishingModelId = polishingModelId;
        if (polishingPrompt !== initialConfig.polishingPrompt) newConfig.polishingPrompt = polishingPrompt;
        if (polishingPresetId !== initialConfig.polishingPresetId) newConfig.polishingPresetId = polishingPresetId;
        if (polishingThinkingEnabled !== initialConfig.polishingThinkingEnabled) newConfig.polishingThinkingEnabled = polishingThinkingEnabled;
        if (polishingThinkingEffort !== initialConfig.polishingThinkingEffort) newConfig.polishingThinkingEffort = polishingThinkingEffort.trim() || DEFAULT_PROMPT_POLISH_THINKING_EFFORT;
        if (polishingThinkingEffortFormat !== initialConfig.polishingThinkingEffortFormat) newConfig.polishingThinkingEffortFormat = polishingThinkingEffortFormat;
        if (JSON.stringify(normalizedCustomModels) !== JSON.stringify(initialConfig.customImageModels)) {
            newConfig.customImageModels = normalizedCustomModels;
        }
        if (storageMode !== initialConfig.storageMode) newConfig.imageStorageMode = storageMode;
        if (imageStoragePath !== initialConfig.imageStoragePath) newConfig.imageStoragePath = imageStoragePath.trim();
        if (savedConnectionMode !== initialConfig.connectionMode) newConfig.connectionMode = savedConnectionMode;
        if (maxConcurrentTasks !== initialConfig.maxConcurrentTasks) newConfig.maxConcurrentTasks = maxConcurrentTasks;
        if (promptHistoryLimit !== initialConfig.promptHistoryLimit) newConfig.promptHistoryLimit = promptHistoryLimit;
        if (desktopProxyMode !== initialConfig.desktopProxyMode) newConfig.desktopProxyMode = desktopProxyMode;
        if (desktopProxyUrl !== initialConfig.desktopProxyUrl || desktopProxyMode !== initialConfig.desktopProxyMode) {
            const trimmed = desktopProxyUrl.trim();
            if (desktopProxyMode === 'manual' && !trimmed) {
                setProxyUrlError('请输入代理地址，例如 127.0.0.1:7890 或 socks5://127.0.0.1:1080');
                return;
            }
            if (desktopProxyMode === 'manual' && !isValidProxyUrl(trimmed)) {
                setProxyUrlError('代理 URL 必须是有效的 http、https、socks5 或 socks5h 地址');
                return;
            }
            setProxyUrlError('');
            newConfig.desktopProxyUrl = desktopProxyMode === 'manual' ? normalizeDesktopProxyUrl(trimmed) : trimmed;
        }
        if (desktopDebugMode !== initialConfig.desktopDebugMode) newConfig.desktopDebugMode = desktopDebugMode;

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
                alert('直连模式需要在浏览器配置 OpenAI、Gemini 或提示词润色 API Key，请在供应商 API 配置中填写。');
                return;
            }
            if (effectiveApiKey && effectiveApiKey !== '(env)' && !effectiveGeminiApiKey && (!effectiveBaseUrl || effectiveBaseUrl === '(env)')) {
                alert('直连模式需要配置 API Base URL（第三方中转地址），请在供应商 API 配置中填写。');
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
        const resetProviderInstances = normalizeProviderInstances(undefined);
        setProviderInstances(resetProviderInstances);
        setSelectedProviderInstanceId('');
        setPolishingApiKey('');
        setPolishingApiBaseUrl('');
        setPolishingModelId(DEFAULT_PROMPT_POLISH_MODEL);
        setPolishingPrompt(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT);
        setPolishingPresetId(DEFAULT_POLISHING_PRESET_ID);
        setPolishingThinkingEnabled(DEFAULT_PROMPT_POLISH_THINKING_ENABLED);
        setPolishingThinkingEffort(DEFAULT_PROMPT_POLISH_THINKING_EFFORT);
        setPolishingThinkingEffortFormat(DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT);
        setCustomImageModels([]);
        setStorageMode('auto');
        setImageStoragePath('');
        setImageStoragePathError('');
        setConnectionMode(resetConnectionMode);
        setMaxConcurrentTasks(3);
        setPromptHistoryLimit(DEFAULT_PROMPT_HISTORY_LIMIT);
        setDesktopProxyMode('disabled');
        setDesktopProxyUrl('');
        setDesktopDebugMode(false);
        setProxyUrlError('');
        onConfigChange({
            openaiApiKey: '',
            openaiApiBaseUrl: '',
            geminiApiKey: '',
            geminiApiBaseUrl: '',
            sensenovaApiKey: '',
            sensenovaApiBaseUrl: '',
            seedreamApiKey: '',
            seedreamApiBaseUrl: '',
            providerInstances: resetProviderInstances,
            selectedProviderInstanceId: '',
            polishingApiKey: '',
            polishingApiBaseUrl: '',
            polishingModelId: DEFAULT_PROMPT_POLISH_MODEL,
            polishingPrompt: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
            polishingPresetId: DEFAULT_POLISHING_PRESET_ID,
            polishingThinkingEnabled: DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
            polishingThinkingEffort: DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
            polishingThinkingEffortFormat: DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT,
            customImageModels: [],
            imageStorageMode: 'auto',
            imageStoragePath: '',
            connectionMode: resetConnectionMode,
            maxConcurrentTasks: 3,
            promptHistoryLimit: DEFAULT_PROMPT_HISTORY_LIMIT,
            desktopProxyMode: 'disabled',
            desktopProxyUrl: '',
            desktopDebugMode: false
        });
        setSaved(true);
        setTimeout(() => setOpen(false), 600);
    };

    const handleChooseImageStoragePath = async () => {
        if (!isDesktopRuntime) return;
        setImageStoragePathError('');

        try {
            const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
            const selectedPath = await openDialog({
                directory: true,
                multiple: false,
                canCreateDirectories: true,
                defaultPath: imageStoragePath || defaultImageStoragePath || undefined,
                title: '选择图片存储文件夹'
            });

            if (typeof selectedPath === 'string') {
                setImageStoragePath(selectedPath);
                return;
            }
            if (Array.isArray(selectedPath) && typeof selectedPath[0] === 'string') {
                setImageStoragePath(selectedPath[0]);
            }
        } catch (error) {
            console.error('Failed to choose image storage directory:', error);
            setImageStoragePathError('无法打开文件夹选择器，请确认桌面端权限配置正常。');
        }
    };

    const storageOptions = [
        { value: 'auto', label: '自动检测' },
        { value: 'fs', label: '文件系统' },
        { value: 'indexeddb', label: 'IndexedDB' }
    ];

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
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
                        <DialogTitle className='text-xl font-semibold'>
                            {settingsView === 'providers' ? '供应商 API 配置' : '系统配置'}
                        </DialogTitle>
                        <DialogDescription>
                            {settingsView === 'providers' ? '管理各供应商的 API Key 与 Base URL。' : '配置 API、模型、运行参数与桌面端选项。'}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className='space-y-5 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6'>
                    {settingsView === 'providers' ? (
                        <div className='space-y-4'>
                            <Button
                                type='button'
                                variant='ghost'
                                onClick={() => setSettingsView('main')}
                                className='min-h-[44px] rounded-xl px-3 text-muted-foreground hover:bg-accent hover:text-foreground'>
                                <ArrowLeft className='h-4 w-4' />
                                返回系统配置
                            </Button>
                            <div className='rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-950 dark:text-violet-100'>
                                同一供应商类型现在可以保存多个命名端点；高级选项里会直接显示这些命名供应商。新增端点未填写名称时，会默认使用 Base URL 的域名作为名称。
                            </div>

                            <ProviderSection title='新增供应商端点' description='选择兼容类型，填写 API Key / Base URL，可留空名称自动使用域名。' icon={<Plus className='h-4 w-4' />} defaultOpen>
                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <Select value={newProviderType} onValueChange={(value) => setNewProviderType(value as ImageProviderId)}>
                                        <SelectTrigger className='h-10 w-full rounded-xl bg-background text-foreground'>
                                            <SelectValue placeholder='供应商类型' />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value='openai'>OpenAI Compatible</SelectItem>
                                            <SelectItem value='google'>Google Gemini</SelectItem>
                                            <SelectItem value='seedream'>Seedream</SelectItem>
                                            <SelectItem value='sensenova'>SenseNova</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        value={newProviderName}
                                        onChange={(event) => setNewProviderName(event.target.value)}
                                        placeholder='供应商名称（可选）'
                                        className='h-10 rounded-xl bg-background text-foreground'
                                    />
                                </div>
                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <SecretInput
                                        id='new-provider-api-key'
                                        value={newProviderApiKey}
                                        onChange={setNewProviderApiKey}
                                        visible={providerApiKeyVisibility.__new === true}
                                        onVisibleChange={() => setProviderApiKeyVisibility((current) => ({ ...current, __new: !current.__new }))}
                                        placeholder='API Key'
                                    />
                                    <Input
                                        value={newProviderApiBaseUrl}
                                        onChange={(event) => setNewProviderApiBaseUrl(event.target.value)}
                                        placeholder={getProviderDefaultBaseUrl(newProviderType)}
                                        className='h-10 rounded-xl bg-background text-foreground'
                                    />
                                </div>
                                <Button type='button' onClick={addProviderInstance} className='min-h-[44px] rounded-xl bg-violet-600 text-white hover:bg-violet-500'>
                                    <Plus className='h-4 w-4' />
                                    添加供应商
                                </Button>
                            </ProviderSection>

                            <div className='space-y-3'>
                                {IMAGE_PROVIDER_ORDER.map((provider) => {
                                    const config = providerApiConfigs[provider];
                                    const instances = providerInstances.filter((instance) => instance.type === provider);
                                    return (
                                        <ProviderSection
                                            key={provider}
                                            title={config.title}
                                            description={`${config.description} · ${instances.length} 个端点`}
                                            icon={config.icon}
                                            defaultOpen={provider === 'openai'}>
                                            <div className='space-y-3'>
                                                {instances.map((instance) => {
                                                    const visible = providerApiKeyVisibility[instance.id] === true;
                                                    const allModels = getAllImageModels(customImageModels).filter((model) => model.provider === instance.type);
                                                    const selectedModelIds = new Set(instance.models.length > 0 ? instance.models : allModels.map((model) => model.id));
                                                    const newModelValue = newModelByProviderInstance[instance.id] ?? '';
                                                    return (
                                                        <article key={instance.id} className='space-y-4 rounded-2xl border border-border bg-background/70 p-4 shadow-sm'>
                                                            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                                                                <div className='min-w-0 flex-1 space-y-2'>
                                                                    <div className='flex flex-wrap items-center gap-2'>
                                                                        <Input
                                                                            value={instance.name}
                                                                            onChange={(event) => updateProviderInstance(instance.id, { name: event.target.value })}
                                                                            placeholder={getProviderInstanceHostname(instance.apiBaseUrl) || getProviderLabel(instance.type)}
                                                                            className='h-9 rounded-xl bg-background text-sm font-semibold text-foreground sm:max-w-xs'
                                                                        />
                                                                        {instance.isDefault ? statusBadge('默认', 'green') : statusBadge('可切换', 'blue')}
                                                                        {selectedProviderInstanceId === instance.id && statusBadge('当前选择', 'amber')}
                                                                    </div>
                                                                    <p className='text-xs text-muted-foreground'>ID: <span className='font-mono'>{instance.id}</span></p>
                                                                </div>
                                                                <div className='flex flex-wrap gap-2'>
                                                                    {!instance.isDefault && (
                                                                        <Button type='button' variant='outline' size='sm' onClick={() => setProviderInstanceDefault(instance.id)} className='min-h-[36px] rounded-xl'>设为默认</Button>
                                                                    )}
                                                                    <Button type='button' variant='outline' size='sm' onClick={() => setSelectedProviderInstanceId(instance.id)} className='min-h-[36px] rounded-xl'>选择</Button>
                                                                    <Button type='button' variant='ghost' size='icon' onClick={() => removeProviderInstance(instance.id)} disabled={instances.length <= 1} className='h-9 w-9 text-muted-foreground hover:bg-red-500/10 hover:text-red-600' aria-label={`删除供应商 ${instance.name}`}>
                                                                        <Trash2 className='h-4 w-4' />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <div className='grid gap-3 lg:grid-cols-2'>
                                                                <div className='space-y-2'>
                                                                    <Label className='text-xs text-muted-foreground'>API Key</Label>
                                                                    <SecretInput
                                                                        id={`provider-instance-key-${instance.id}`}
                                                                        value={instance.apiKey}
                                                                        onChange={(value) => updateProviderInstance(instance.id, { apiKey: value })}
                                                                        visible={visible}
                                                                        onVisibleChange={() => setProviderApiKeyVisibility((current) => ({ ...current, [instance.id]: !current[instance.id] }))}
                                                                        placeholder={config.apiKeyPlaceholder}
                                                                    />
                                                                </div>
                                                                <div className='space-y-2'>
                                                                    <Label className='text-xs text-muted-foreground'>API Base URL</Label>
                                                                    <Input
                                                                        value={instance.apiBaseUrl}
                                                                        onChange={(event) => updateProviderInstance(instance.id, { apiBaseUrl: event.target.value })}
                                                                        placeholder={config.baseUrlPlaceholder}
                                                                        className='h-10 rounded-xl bg-background text-foreground'
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className='space-y-3 rounded-xl border border-border bg-muted/20 p-3'>
                                                                <div className='flex flex-wrap items-center justify-between gap-2'>
                                                                    <div>
                                                                        <p className='text-sm font-medium text-foreground'>可用模型</p>
                                                                        <p className='text-xs text-muted-foreground'>不勾选任何限制时默认可用该类型全部模型；勾选后只在高级选项中显示已选模型。</p>
                                                                    </div>
                                                                    <span className='text-xs text-muted-foreground'>{selectedModelIds.size} / {allModels.length}</span>
                                                                </div>
                                                                <div className='grid gap-2 sm:grid-cols-2'>
                                                                    {allModels.map((model) => (
                                                                        <div key={model.id} className='flex items-center gap-2'>
                                                                            <Checkbox
                                                                                id={`provider-model-${instance.id}-${model.id}`}
                                                                                checked={selectedModelIds.has(model.id)}
                                                                                onCheckedChange={(checked) => updateProviderInstanceModel(instance.id, model.id, checked)}
                                                                            />
                                                                            <Label htmlFor={`provider-model-${instance.id}-${model.id}`} className='cursor-pointer text-xs text-muted-foreground'>
                                                                                {model.label}{model.custom ? ' · 自定义' : ''}
                                                                            </Label>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]'>
                                                                    <Input
                                                                        value={newModelValue}
                                                                        onChange={(event) => setNewModelByProviderInstance((current) => ({ ...current, [instance.id]: event.target.value }))}
                                                                        placeholder='添加该供应商提供的自定义模型 ID'
                                                                        className='h-10 rounded-xl bg-background font-mono text-xs text-foreground'
                                                                        onKeyDown={(event) => {
                                                                            if (event.key === 'Enter') {
                                                                                event.preventDefault();
                                                                                addModelToProviderInstance(instance, newModelValue);
                                                                                setNewModelByProviderInstance((current) => ({ ...current, [instance.id]: '' }));
                                                                            }
                                                                        }}
                                                                    />
                                                                    <Button
                                                                        type='button'
                                                                        variant='outline'
                                                                        onClick={() => {
                                                                            addModelToProviderInstance(instance, newModelValue);
                                                                            setNewModelByProviderInstance((current) => ({ ...current, [instance.id]: '' }));
                                                                        }}
                                                                        disabled={!newModelValue.trim()}
                                                                        className='min-h-[44px] rounded-xl'>
                                                                        添加模型
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </article>
                                                    );
                                                })}
                                            </div>
                                        </ProviderSection>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <>
                            <button
                                type='button'
                                onClick={() => setSettingsView('providers')}
                                className='flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 px-4 py-4 text-left shadow-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background'>
                                <span className='flex min-w-0 items-start gap-3'>
                                    <span className='mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground' aria-hidden='true'>
                                        <Globe className='h-5 w-5' />
                                    </span>
                                    <span className='min-w-0'>
                                        <span className='block text-sm font-semibold text-foreground'>供应商 API 配置</span>
                                        <span className='mt-1 block text-sm leading-5 text-muted-foreground'>管理图像供应商的 API Key 与 Base URL。</span>
                                    </span>
                                </span>
                                <ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground' />
                            </button>

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
                                <Label className='flex items-center gap-2'>
                                    <Sparkles className='h-4 w-4 text-muted-foreground' />
                                    内置润色预设
                                </Label>
                                {polishingPresetId !== DEFAULT_POLISHING_PRESET_ID ? statusBadge('UI', 'green') : statusBadge('默认', 'amber')}
                            </div>
                            <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
                                {PROMPT_POLISH_PRESETS.map((preset) => {
                                    const selected = polishingPresetId === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            type='button'
                                            aria-pressed={selected}
                                            onClick={() => setPolishingPresetId(preset.id)}
                                            title={`查看 ${preset.label} 的完整系统提示词`}
                                            className={`rounded-xl border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none ${selected ? 'border-violet-500/50 bg-violet-500/10 text-foreground shadow-sm shadow-violet-500/10 ring-1 ring-violet-500/20' : 'border-border bg-background text-muted-foreground hover:border-violet-300/50 hover:bg-accent hover:text-foreground'}`}>
                                            <span className='flex items-start justify-between gap-2'>
                                                <span className='min-w-0'>
                                                    <span className='block text-sm font-medium'>{preset.label}</span>
                                                    <span className='mt-0.5 block text-[11px] text-muted-foreground'>{preset.description}</span>
                                                </span>
                                                {selected && (
                                                    <span className='shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-violet-500/25 dark:text-violet-100'>
                                                        当前
                                                    </span>
                                                )}
                                            </span>
                                            {!selected && (
                                                <span className='mt-1 inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground'>只读</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className='rounded-xl border border-violet-500/20 bg-violet-500/5 p-3'>
                                <div className='flex flex-wrap items-center justify-between gap-2'>
                                    <div className='min-w-0'>
                                        <p className='text-sm font-semibold text-foreground'>当前选中：{selectedPolishPreset.label}</p>
                                        <p className='mt-0.5 text-xs text-muted-foreground'>{selectedPolishPreset.description}</p>
                                    </div>
                                    <span className='rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-200'>
                                        {selectedPolishPreset.category}
                                    </span>
                                </div>
                                <div className='mt-3 rounded-lg border border-border bg-background/80 p-3'>
                                    <p className='mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground'>完整预设系统提示词</p>
                                    <pre className='max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-5 text-foreground'>
                                        {selectedPolishPreset.systemPrompt}
                                    </pre>
                                </div>
                            </div>
                            <p className='text-xs text-muted-foreground'>内置预设只读，不能直接修改；点击卡片只会切换默认内置预设和上方预览。保存后，润色下拉里的“默认内置预设”会使用这里选中的预设。</p>
                        </div>

                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label htmlFor='polishing-system-prompt' className='flex items-center gap-2'>
                                    <Sparkles className='h-4 w-4 text-muted-foreground' />
                                    已保存的自定义润色提示词
                                </Label>
                                {hasSavedCustomPolishingPrompt ? statusBadge('已保存自定义', 'green') : hasEnvPolishingPrompt ? statusBadge('ENV 可用', 'blue') : statusBadge('未保存', 'amber')}
                            </div>
                            <div className='rounded-xl border border-border bg-background/70 p-3 text-xs leading-5 text-muted-foreground'>
                                <p>
                                    这是一段独立的可编辑润色规则。保存后，它会出现在输入框的润色下拉里，作为“已保存自定义”选项供你手动选择；它不会自动改写或覆盖上方内置预设。
                                </p>
                                {hasEnvPolishingPrompt && !hasSavedCustomPolishingPrompt && (
                                    <p className='mt-1'>.env 中也配置了 POLISHING_PROMPT；ENV 值不会直接显示在浏览器下拉里，如需下拉可选，请在这里填写并保存。</p>
                                )}
                            </div>
                            <Textarea
                                id='polishing-system-prompt'
                                value={polishingPrompt}
                                onChange={(event) => setPolishingPrompt(event.target.value)}
                                placeholder='输入你的自定义润色系统提示词；留空或保持系统默认文案则不创建“已保存自定义”选项。'
                                className='min-h-40 rounded-xl bg-background text-sm text-foreground'
                            />
                            <div className='rounded-lg border border-border bg-muted/30 p-3'>
                                <p className='mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground'>保存后在润色下拉中显示的自定义提示词</p>
                                <pre className='max-h-36 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-5 text-foreground'>
                                    {savedCustomPolishingPrompt || '尚未保存自定义润色提示词；润色下拉将只显示内置预设和临时自定义入口。'}
                                </pre>
                            </div>
                            <p className='text-xs text-muted-foreground'>三种来源彼此独立：内置预设只读可查看；已保存自定义可在这里编辑并在下拉中选择；临时自定义只在一次润色中手动输入，不会保存。</p>
                        </div>
                    </ProviderSection>

                    <ProviderSection title='自定义模型能力覆盖' description='自定义模型 ID 已整合到供应商 API 配置中；这里仅保留能力、尺寸等高级覆盖项。' icon={<Sparkles className='h-4 w-4' />}>
                        <p className='rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-xs leading-5 text-violet-900 dark:text-violet-100'>
                            新增模型请进入上方“供应商 API 配置”，在对应供应商端点的“可用模型”区域添加；这样模型会自动绑定到具体供应商实例，避免单独的自定义模型 ID 与供应商配置脱节。
                        </p>

                        {customImageModels.length > 0 ? (
                            <div className='space-y-2'>
                                {customImageModels.map((model) => (
                                    <div key={model.id} className='space-y-3 rounded-xl border border-border bg-background/70 p-3'>
                                        <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                                            <div className='min-w-0 flex-1'>
                                                <p className='truncate font-mono text-sm text-foreground'>{model.id}</p>
                                                <p className='text-xs text-muted-foreground'>{providerLabel(model.provider)}</p>
                                            </div>
                                            <span className='rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground'>
                                                {model.instanceId ? `绑定 ${model.instanceId}` : '全局自定义'}
                                            </span>
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
                                <p><strong>文件系统:</strong> Web 端保存到 <code className='text-foreground'>./generated-images</code>；桌面端保存到应用数据目录或下方选择的文件夹</p>
                                <p><strong>IndexedDB:</strong> 图片保存在浏览器本地存储，适合无服务器部署</p>
                            </div>
                            {isDesktopRuntime && storageMode === 'fs' && (
                                <div className='rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3'>
                                    <div className='space-y-2'>
                                        <div className='flex items-center justify-between gap-2'>
                                            <Label htmlFor='desktop-image-storage-path' className='flex items-center gap-2 text-sm font-medium'>
                                                <FolderOpen className='h-4 w-4 text-emerald-600 dark:text-emerald-300' />
                                                桌面端文件夹
                                            </Label>
                                            {imageStoragePath ? statusBadge('自定义路径', 'green') : statusBadge('默认路径', 'blue')}
                                        </div>
                                        <Input
                                            id='desktop-image-storage-path'
                                            value={imageStoragePath || defaultImageStoragePath || '加载默认路径中…'}
                                            readOnly
                                            className='h-10 rounded-xl bg-background font-mono text-xs text-foreground'
                                            aria-label='桌面端图片存储路径'
                                        />
                                        <div className='flex flex-wrap gap-2'>
                                            <Button
                                                type='button'
                                                variant='outline'
                                                onClick={handleChooseImageStoragePath}
                                                className='min-h-[44px] rounded-xl'>
                                                <FolderOpen className='h-4 w-4' />
                                                选择文件夹
                                            </Button>
                                            {imageStoragePath && (
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    onClick={() => { setImageStoragePath(''); setImageStoragePathError(''); }}
                                                    className='min-h-[44px] rounded-xl text-muted-foreground hover:text-foreground'>
                                                    使用默认路径
                                                </Button>
                                            )}
                                        </div>
                                        <p className='text-xs leading-5 text-emerald-800 dark:text-emerald-100/90'>
                                            不选择时默认保存到应用数据目录下的 <code className='text-foreground'>generated-images</code>。选择后，新生成的图片会写入该文件夹。
                                        </p>
                                        {imageStoragePathError && (
                                            <p className='text-xs text-red-600 dark:text-red-300' role='alert'>{imageStoragePathError}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </ProviderSection>

                    <ProviderSection title='桌面端设置' description='Tauri 桌面 Rust 中转代理、调试模式。' icon={<Bug className='h-4 w-4' />}>
                        {isDesktopRuntime ? (
                            <>
                                <div className='space-y-3'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <Label className='flex items-center gap-2'>
                                            <Wifi className='h-4 w-4 text-muted-foreground' />
                                            代理模式（仅桌面端 Rust 请求）
                                        </Label>
                                        {statusBadge(desktopProxyMode, desktopProxyMode === 'disabled' ? 'amber' : desktopProxyMode === 'system' ? 'green' : 'blue')}
                                    </div>
                                    <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
                                        {([
                                            ['disabled', '禁用代理'],
                                            ['system', '默认环境代理'],
                                            ['manual', '手动代理']
                                        ] as [DesktopProxyMode, string][]).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type='button'
                                                onClick={() => { setDesktopProxyMode(value); setProxyUrlError(''); }}
                                                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${desktopProxyMode === value ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    {desktopProxyMode === 'manual' && (
                                        <div className='space-y-2'>
                                            <Label htmlFor='desktop-proxy-url' className='text-xs text-muted-foreground'>代理地址</Label>
                                            <Input
                                                id='desktop-proxy-url'
                                                type='text'
                                                placeholder='127.0.0.1:7890 或 socks5://127.0.0.1:1080'
                                                value={desktopProxyUrl}
                                                onChange={(event) => { setDesktopProxyUrl(event.target.value); setProxyUrlError(''); }}
                                                autoComplete='off'
                                                className={`h-10 rounded-xl bg-background text-foreground ${proxyUrlError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                            />
                                            {proxyUrlError && (
                                                <p className='text-xs text-red-500' role='alert'>{proxyUrlError}</p>
                                            )}
                                        </div>
                                    )}
                                    {desktopProxyMode === 'system' && (
                                        <p className='text-xs text-muted-foreground'>使用 Rust HTTP 客户端默认代理行为（如环境变量代理）；如需稳定指定代理，建议选择手动代理。</p>
                                    )}
                                    {desktopProxyMode === 'disabled' && (
                                        <p className='text-xs text-muted-foreground'>Rust 中转将直接连接 API 服务器，不使用代理。</p>
                                    )}
                                </div>

                                <div className='space-y-3'>
                                    <div className='flex items-center gap-2'>
                                        <Label htmlFor='desktop-debug-mode' className='flex items-center gap-2'>
                                            <Bug className='h-4 w-4 text-muted-foreground' />
                                            调试模式
                                        </Label>
                                        {desktopDebugMode ? statusBadge('已开启', 'blue') : statusBadge('关闭', 'amber')}
                                    </div>
                                    <div className='flex items-center space-x-2'>
                                        <Checkbox
                                            id='desktop-debug-mode'
                                            checked={desktopDebugMode}
                                            onCheckedChange={(checked) => setDesktopDebugMode(!!checked)}
                                        />
                                        <label htmlFor='desktop-debug-mode' className='text-sm text-muted-foreground cursor-pointer'>
                                            开启后，Rust 中转会在 API 请求中附加调试头并返回更详细的错误信息。
                                        </label>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className='rounded-xl border border-sky-500/25 bg-sky-500/10 p-4'>
                                <div className='flex gap-3'>
                                    <Bug className='mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300' />
                                    <div className='space-y-3 text-sm text-sky-900 dark:text-sky-100'>
                                        <div className='space-y-1'>
                                            <p className='font-semibold'>当前为 Web 应用，桌面端配置未启用</p>
                                            <p className='text-xs leading-5 text-sky-800/85 dark:text-sky-100/80'>{DESKTOP_ONLY_SETTINGS_MESSAGE}</p>
                                        </div>
                                        <Button asChild variant='outline' size='sm' className='min-h-[44px] rounded-xl border-sky-500/30 bg-background/80 text-sky-700 hover:bg-background dark:text-sky-100'>
                                            <a
                                                href={DESKTOP_APP_DOWNLOAD_URL}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                onClick={handleExternalLinkClick(DESKTOP_APP_DOWNLOAD_URL)}>
                                                <Download className='h-4 w-4' />
                                                下载或更新桌面端
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
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
                        </>
                    )}
                </div>

                <DialogFooter className='sticky bottom-0 border-t border-border bg-background/95 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6 sm:pb-4'>
                    {saved && <p className='mr-auto text-xs text-emerald-600 dark:text-emerald-300'>已保存，配置立即生效 ✓</p>}
                    <Button variant='outline' onClick={() => handleDialogOpenChange(false)} className='rounded-xl'>取消</Button>
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
