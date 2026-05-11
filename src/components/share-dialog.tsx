'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { copyTextToClipboard } from '@/lib/desktop-runtime';
import {
    encryptShareParams,
    generateRandomSharePassword,
    getSharePasswordRequiredMessage,
    getSharePasswordWarningMessage,
    SHARE_PASSWORD_MIN_LENGTH
} from '@/lib/share-crypto';
import {
    DEFAULT_SHARED_SYNC_RESTORE_OPTIONS,
    buildBasePrefix,
    isS3SyncConfigConfigured,
    loadSyncConfig,
    type SharedSyncImageRestoreScope,
    type SharedSyncRestoreOptions,
    type SyncProviderConfig
} from '@/lib/sync';
import { buildSecureShareUrl, buildShareUrl, type ShareUrlParams } from '@/lib/url-params';
import { cn } from '@/lib/utils';
import {
    AlertTriangle,
    Check,
    Cloud,
    Copy,
    KeyRound,
    Link2,
    LockKeyhole,
    Eye,
    EyeOff,
    Play,
    Share2,
    SlidersHorizontal
} from 'lucide-react';
import * as React from 'react';

type ShareOptions = {
    includePrompt: boolean;
    includeModel: boolean;
    includeProviderInstanceId: boolean;
    includeBaseUrl: boolean;
    includeApiKey: boolean;
    includeAutostart: boolean;
    includeSyncConfig: boolean;
    acknowledgeApiKey: boolean;
    acknowledgeSyncConfig: boolean;
    useSecureShare: boolean;
    includeSecurePasswordInUrl: boolean;
};

type ShareDialogProps = {
    currentPrompt: string;
    currentModel: string;
    apiKey: string;
    apiBaseUrl: string;
    providerInstanceId: string;
    providerLabel: string;
    triggerClassName?: string;
};

type ShareOptionRowProps = {
    id: string;
    checked: boolean;
    disabled?: boolean;
    title: string;
    description: string;
    onCheckedChange: (checked: boolean) => void;
    children?: React.ReactNode;
};

type RecentRestoreUnit = 'hours' | 'days';

const COPY_FEEDBACK_MS = 1800;
const URL_LENGTH_WARNING_LIMIT = 1800;
const RECENT_RESTORE_UNIT_MS: Record<RecentRestoreUnit, number> = {
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000
};

function isHttpUrl(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;

    try {
        const url = new URL(trimmed);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function maskSecret(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '未配置';
    if (trimmed.length <= 8) return '已配置';
    return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

function parsePositiveInteger(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatRecentRestoreLabel(amount: string, unit: RecentRestoreUnit): string {
    const normalizedAmount = parsePositiveInteger(amount, unit === 'hours' ? 24 : 7);
    return unit === 'hours' ? `最近 ${normalizedAmount} 小时图片` : `最近 ${normalizedAmount} 天图片`;
}

function ShareOptionRow({
    id,
    checked,
    disabled = false,
    title,
    description,
    onCheckedChange,
    children
}: ShareOptionRowProps) {
    const descriptionId = `${id}-description`;

    return (
        <div
            className={cn(
                'border-border bg-card/80 rounded-2xl border p-3 shadow-sm transition-colors dark:bg-white/[0.03]',
                checked && 'border-violet-400/35 bg-violet-500/10 dark:bg-violet-500/10',
                disabled && 'opacity-55'
            )}>
            <div className='flex items-start gap-3'>
                <Checkbox
                    id={id}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(value) => onCheckedChange(value === true)}
                    aria-describedby={descriptionId}
                    className='mt-0.5 border-violet-300/70 data-[state=checked]:border-violet-500 data-[state=checked]:bg-violet-600 data-[state=checked]:text-white'
                />
                <div className='min-w-0 flex-1'>
                    <Label htmlFor={id} className='text-foreground cursor-pointer text-sm font-medium'>
                        {title}
                    </Label>
                    <p id={descriptionId} className='text-muted-foreground mt-1 text-xs leading-5'>
                        {description}
                    </p>
                    {children}
                </div>
            </div>
        </div>
    );
}

export function ShareDialog({
    currentPrompt,
    currentModel,
    apiKey,
    apiBaseUrl,
    providerInstanceId,
    providerLabel,
    triggerClassName
}: ShareDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [currentUrl, setCurrentUrl] = React.useState('');
    const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'failed'>('idle');
    const [options, setOptions] = React.useState<ShareOptions>({
        includePrompt: false,
        includeModel: true,
        includeProviderInstanceId: false,
        includeBaseUrl: false,
        includeApiKey: false,
        includeAutostart: false,
        includeSyncConfig: false,
        acknowledgeApiKey: false,
        acknowledgeSyncConfig: false,
        useSecureShare: false,
        includeSecurePasswordInUrl: false
    });
    const [sharePassword, setSharePassword] = React.useState('');
    const [sharePasswordConfirmation, setSharePasswordConfirmation] = React.useState('');
    const [sharePasswordVisible, setSharePasswordVisible] = React.useState(false);
    const [sharePasswordConfirmationVisible, setSharePasswordConfirmationVisible] = React.useState(false);
    const [secureShareUrl, setSecureShareUrl] = React.useState('');
    const [secureShareError, setSecureShareError] = React.useState('');
    const [isEncrypting, setIsEncrypting] = React.useState(false);
    const [syncConfig, setSyncConfig] = React.useState<SyncProviderConfig | null>(null);
    const [syncAutoRestore, setSyncAutoRestore] = React.useState(DEFAULT_SHARED_SYNC_RESTORE_OPTIONS.autoRestore);
    const [syncRestoreMetadata, setSyncRestoreMetadata] = React.useState(
        DEFAULT_SHARED_SYNC_RESTORE_OPTIONS.restoreMetadata
    );
    const [syncImageRestoreScope, setSyncImageRestoreScope] = React.useState<SharedSyncImageRestoreScope>(
        DEFAULT_SHARED_SYNC_RESTORE_OPTIONS.imageRestoreScope
    );
    const [syncRecentRestoreAmount, setSyncRecentRestoreAmount] = React.useState('7');
    const [syncRecentRestoreUnit, setSyncRecentRestoreUnit] = React.useState<RecentRestoreUnit>('days');
    const [acknowledgeFullSyncRestore, setAcknowledgeFullSyncRestore] = React.useState(false);
    const urlInputRef = React.useRef<HTMLInputElement>(null);
    const copyStatusTimerRef = React.useRef<number | null>(null);
    const idPrefix = React.useId();

    const trimmedPrompt = currentPrompt.trim();
    const trimmedModel = currentModel.trim();
    const trimmedApiKey = apiKey.trim();
    const trimmedApiBaseUrl = apiBaseUrl.trim();
    const trimmedProviderInstanceId = providerInstanceId.trim();
    const hasValidBaseUrl = isHttpUrl(trimmedApiBaseUrl);
    const canSharePrompt = trimmedPrompt.length > 0;
    const canShareApiKey = trimmedApiKey.length > 0;
    const canShareProviderInstance = trimmedModel.length > 0 && trimmedProviderInstanceId.length > 0;
    const canShareSyncConfig = isS3SyncConfigConfigured(syncConfig?.s3);

    const resetCopyStatus = React.useCallback(() => {
        if (copyStatusTimerRef.current !== null) {
            window.clearTimeout(copyStatusTimerRef.current);
            copyStatusTimerRef.current = null;
        }
        setCopyStatus('idle');
    }, []);

    const resetOptions = React.useCallback(() => {
        const nextSyncConfig = loadSyncConfig();
        setSyncConfig(nextSyncConfig);
        setOptions({
            includePrompt: canSharePrompt,
            includeModel: true,
            includeProviderInstanceId: canShareProviderInstance,
            includeBaseUrl: hasValidBaseUrl,
            includeApiKey: false,
            includeAutostart: false,
            includeSyncConfig: false,
            acknowledgeApiKey: false,
            acknowledgeSyncConfig: false,
            useSecureShare: false,
            includeSecurePasswordInUrl: false
        });
        setSharePassword('');
        setSharePasswordConfirmation('');
        setSharePasswordVisible(false);
        setSharePasswordConfirmationVisible(false);
        setSyncAutoRestore(DEFAULT_SHARED_SYNC_RESTORE_OPTIONS.autoRestore);
        setSyncRestoreMetadata(DEFAULT_SHARED_SYNC_RESTORE_OPTIONS.restoreMetadata);
        setSyncImageRestoreScope(DEFAULT_SHARED_SYNC_RESTORE_OPTIONS.imageRestoreScope);
        setSyncRecentRestoreAmount('7');
        setSyncRecentRestoreUnit('days');
        setAcknowledgeFullSyncRestore(false);
        setSecureShareUrl('');
        setSecureShareError('');
        setIsEncrypting(false);
        resetCopyStatus();
        if (typeof window !== 'undefined') setCurrentUrl(window.location.href);
    }, [canSharePrompt, canShareProviderInstance, hasValidBaseUrl, resetCopyStatus]);

    React.useEffect(() => {
        return () => {
            if (copyStatusTimerRef.current !== null) window.clearTimeout(copyStatusTimerRef.current);
        };
    }, []);

    const updateOption = React.useCallback(
        <K extends keyof ShareOptions>(key: K, value: ShareOptions[K]) => {
            setOptions((previous) => {
                const next = { ...previous, [key]: value };
                if (key === 'includePrompt' && value === false) next.includeAutostart = false;
                if (key === 'includeModel' && value === false) next.includeProviderInstanceId = false;
                if (key === 'includeApiKey' && value === false) next.acknowledgeApiKey = false;
                if (key === 'includeSyncConfig' && value === true) {
                    next.useSecureShare = true;
                    next.includeSecurePasswordInUrl = true;
                }
                if (key === 'includeSyncConfig' && value === false) next.acknowledgeSyncConfig = false;
                if (key === 'useSecureShare' && value === false) {
                    next.includeSecurePasswordInUrl = false;
                    next.includeSyncConfig = false;
                    next.acknowledgeSyncConfig = false;
                }
                return next;
            });
            if (key === 'includeSyncConfig' && value === true && !sharePassword.trim()) {
                const generatedPassword = generateRandomSharePassword();
                setSharePassword(generatedPassword);
                setSharePasswordConfirmation(generatedPassword);
                setSharePasswordVisible(true);
                setSharePasswordConfirmationVisible(true);
            }
            if (key === 'includeSyncConfig' && value === false) {
                setAcknowledgeFullSyncRestore(false);
                setSyncAutoRestore(DEFAULT_SHARED_SYNC_RESTORE_OPTIONS.autoRestore);
                setSyncImageRestoreScope(DEFAULT_SHARED_SYNC_RESTORE_OPTIONS.imageRestoreScope);
            }
            setSecureShareUrl('');
            setSecureShareError('');
            resetCopyStatus();
        },
        [resetCopyStatus, sharePassword]
    );

    const canAutostart = options.includePrompt && canSharePrompt;
    const apiKeyNeedsAcknowledgement = options.includeApiKey && !options.acknowledgeApiKey;
    const syncConfigNeedsAcknowledgement = options.includeSyncConfig && !options.acknowledgeSyncConfig;
    const fullSyncRestoreNeedsAcknowledgement =
        options.includeSyncConfig && syncImageRestoreScope === 'full' && !acknowledgeFullSyncRestore;
    const securePasswordRequiredMessage = options.useSecureShare
        ? getSharePasswordRequiredMessage(sharePassword)
        : null;
    const securePasswordWarningMessage = options.useSecureShare ? getSharePasswordWarningMessage(sharePassword) : null;
    const securePasswordMismatch = options.useSecureShare ? sharePassword !== sharePasswordConfirmation : false;
    const securePasswordMismatchMessage =
        options.useSecureShare && !securePasswordRequiredMessage && securePasswordMismatch
            ? '两次输入的解密密码不一致。'
            : null;
    const syncConfigBasePrefix =
        canShareSyncConfig && syncConfig ? buildBasePrefix(syncConfig.s3.profileId, syncConfig.s3.prefix) : '';
    const selectedSyncRestoreOptions = React.useMemo<SharedSyncRestoreOptions>(() => {
        const normalizedAmount = parsePositiveInteger(
            syncRecentRestoreAmount,
            syncRecentRestoreUnit === 'hours' ? 24 : 7
        );
        return {
            autoRestore: syncAutoRestore,
            restoreMetadata: syncRestoreMetadata,
            imageRestoreScope: syncImageRestoreScope,
            ...(syncImageRestoreScope === 'recent' && {
                recentMs: normalizedAmount * RECENT_RESTORE_UNIT_MS[syncRecentRestoreUnit]
            })
        };
    }, [syncAutoRestore, syncImageRestoreScope, syncRecentRestoreAmount, syncRecentRestoreUnit, syncRestoreMetadata]);
    const syncRestoreSummary = React.useMemo(() => {
        const parts: string[] = [];
        if (selectedSyncRestoreOptions.restoreMetadata) parts.push('配置和历史');
        if (selectedSyncRestoreOptions.imageRestoreScope === 'recent') {
            parts.push(formatRecentRestoreLabel(syncRecentRestoreAmount, syncRecentRestoreUnit));
        }
        if (selectedSyncRestoreOptions.imageRestoreScope === 'full') parts.push('全部历史图片');
        if (parts.length === 0) return '默认只保存云存储配置，不自动拉取快照。';
        return `${selectedSyncRestoreOptions.autoRestore ? '保存后自动恢复' : '接收者手动确认后恢复'}：${parts.join('、')}。`;
    }, [selectedSyncRestoreOptions, syncRecentRestoreAmount, syncRecentRestoreUnit]);

    const selectedShareParams = React.useMemo<ShareUrlParams>(() => {
        const params: ShareUrlParams = {};

        if (options.includePrompt && canSharePrompt) params.prompt = trimmedPrompt;
        if (options.includeModel && trimmedModel) params.model = trimmedModel;
        if (options.includeProviderInstanceId && canShareProviderInstance)
            params.providerInstanceId = trimmedProviderInstanceId;
        if (options.includeBaseUrl && hasValidBaseUrl) params.baseUrl = trimmedApiBaseUrl;
        if (options.includeApiKey && options.acknowledgeApiKey && canShareApiKey) params.apiKey = trimmedApiKey;
        if (options.includeAutostart && canAutostart) params.autostart = true;
        if (options.includeSyncConfig && options.acknowledgeSyncConfig && canShareSyncConfig && syncConfig) {
            params.syncConfig = {
                config: syncConfig,
                restoreOptions: selectedSyncRestoreOptions
            };
        }

        return params;
    }, [
        canAutostart,
        canShareApiKey,
        canShareProviderInstance,
        canSharePrompt,
        canShareSyncConfig,
        hasValidBaseUrl,
        options,
        selectedSyncRestoreOptions,
        syncConfig,
        trimmedApiBaseUrl,
        trimmedApiKey,
        trimmedModel,
        trimmedProviderInstanceId,
        trimmedPrompt
    ]);

    const shareUrl = React.useMemo(() => {
        if (!currentUrl) return '';
        return buildShareUrl(currentUrl, selectedShareParams);
    }, [currentUrl, selectedShareParams]);
    const cleanEntryUrl = React.useMemo(() => {
        if (!currentUrl) return '';
        return buildShareUrl(currentUrl, {});
    }, [currentUrl]);
    const displayedShareUrl = options.useSecureShare ? secureShareUrl || cleanEntryUrl : shareUrl;

    const selectedItems = React.useMemo(() => {
        const items: string[] = [];
        if (selectedShareParams.prompt) items.push('提示词');
        if (selectedShareParams.model) items.push('模型');
        if (selectedShareParams.providerInstanceId) items.push('供应商端点');
        if (selectedShareParams.baseUrl) items.push('API 地址');
        if (selectedShareParams.apiKey) items.push('API Key');
        if (selectedShareParams.autostart) items.push('自动生成');
        if (selectedShareParams.syncConfig) items.push('云存储同步配置');
        if (selectedShareParams.syncConfig) items.push('同步恢复策略');
        if (options.useSecureShare) items.push('密码加密');
        if (options.useSecureShare && options.includeSecurePasswordInUrl) items.push('自带解密密码');
        return items;
    }, [options.includeSecurePasswordInUrl, options.useSecureShare, selectedShareParams]);

    const secureShareDisabled = Boolean(
        options.useSecureShare && (securePasswordRequiredMessage || securePasswordMismatchMessage || isEncrypting)
    );
    const copyDisabled =
        !shareUrl ||
        apiKeyNeedsAcknowledgement ||
        syncConfigNeedsAcknowledgement ||
        fullSyncRestoreNeedsAcknowledgement ||
        secureShareDisabled;
    const showLengthWarning = displayedShareUrl.length > URL_LENGTH_WARNING_LIMIT;

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (nextOpen) resetOptions();
    };

    const handleGeneratePassword = () => {
        const generatedPassword = generateRandomSharePassword();
        setSharePassword(generatedPassword);
        setSharePasswordConfirmation(generatedPassword);
        setSharePasswordVisible(true);
        setSharePasswordConfirmationVisible(true);
        setSecureShareUrl('');
        setSecureShareError('');
        resetCopyStatus();
    };

    const handleCopy = async () => {
        if (copyDisabled) return;

        let urlToCopy = shareUrl;
        if (options.useSecureShare) {
            setIsEncrypting(true);
            setSecureShareError('');
            setSecureShareUrl('');
            try {
                const encryptedPayload = await encryptShareParams(selectedShareParams, sharePassword);
                urlToCopy = buildSecureShareUrl(
                    currentUrl,
                    encryptedPayload,
                    options.includeSecurePasswordInUrl ? sharePassword : undefined
                );
                setSecureShareUrl(urlToCopy);
            } catch (error) {
                setSecureShareError(error instanceof Error ? error.message : '加密分享链接生成失败。');
                setIsEncrypting(false);
                return;
            }
            setIsEncrypting(false);
        }

        const copied = await copyTextToClipboard(urlToCopy);
        setCopyStatus(copied ? 'copied' : 'failed');
        if (urlInputRef.current) {
            urlInputRef.current.focus();
            urlInputRef.current.select();
        }

        if (copyStatusTimerRef.current !== null) window.clearTimeout(copyStatusTimerRef.current);
        copyStatusTimerRef.current = window.setTimeout(() => {
            setCopyStatus('idle');
            copyStatusTimerRef.current = null;
        }, COPY_FEEDBACK_MS);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className={cn(
                        'h-7 min-w-0 cursor-pointer rounded-md px-2 text-[11px] text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent active:scale-[0.98] active:bg-slate-200 sm:h-8 sm:px-2.5 sm:text-xs sm:text-slate-700 sm:hover:bg-slate-100 sm:hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white dark:active:bg-white/15',
                        triggerClassName
                    )}
                    aria-label='分享当前提示词和配置'
                    title='分享当前提示词和配置'>
                    <Share2 className='h-3 w-3' aria-hidden='true' />
                    <span className='sr-only sm:not-sr-only sm:ml-1 sm:inline'>分享</span>
                </Button>
            </DialogTrigger>
            <DialogContent className='border-border bg-background text-foreground h-dvh max-h-dvh w-screen max-w-none overflow-y-auto rounded-none p-0 shadow-2xl top-0 left-0 translate-x-0 translate-y-0 sm:h-auto sm:max-h-[92vh] sm:w-[min(720px,calc(100vw-2rem))] sm:max-w-[720px] sm:rounded-2xl sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]'>
                <DialogHeader className='border-border bg-card/60 border-b px-5 py-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-left sm:px-6 sm:pt-5 dark:bg-white/[0.03]'>
                    <div className='flex items-start gap-3 pr-8'>
                        <span className='mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20'>
                            <Link2 className='h-5 w-5' aria-hidden='true' />
                        </span>
                        <div className='min-w-0'>
                            <DialogTitle className='text-xl font-semibold tracking-tight'>分享当前配置</DialogTitle>
                            <DialogDescription className='text-muted-foreground mt-2 text-sm leading-6'>
                                选择要写入链接的内容。接收者打开后会自动填入这些参数，页面随后会清理
                                URL，避免继续误分享。
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className='space-y-4 px-5 py-5 sm:px-6'>
                    <Alert className='border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100'>
                        <AlertTriangle className='h-4 w-4' aria-hidden='true' />
                        <AlertTitle>请只分享你明确选择的内容</AlertTitle>
                        <AlertDescription>
                            普通分享会把所选参数写入 URL；启用密码加密后，链接只显示一个 sdata 参数。API Key
                            默认不会包含。
                        </AlertDescription>
                    </Alert>

                    <div className='grid gap-3 sm:grid-cols-2'>
                        <ShareOptionRow
                            id={`${idPrefix}-prompt`}
                            checked={options.includePrompt}
                            disabled={!canSharePrompt}
                            title='提示词'
                            description={
                                canSharePrompt
                                    ? `包含当前输入框内容（${trimmedPrompt.length} 个字符）。`
                                    : '当前提示词为空；仍可只分享配置。'
                            }
                            onCheckedChange={(checked) => updateOption('includePrompt', checked)}
                        />

                        <ShareOptionRow
                            id={`${idPrefix}-model`}
                            checked={options.includeModel}
                            title='模型 ID'
                            description={
                                trimmedModel ? `接收者将使用 ${trimmedModel}。` : '当前模型为空，将不会写入链接。'
                            }
                            onCheckedChange={(checked) => updateOption('includeModel', checked)}
                        />

                        <ShareOptionRow
                            id={`${idPrefix}-provider-instance`}
                            checked={options.includeProviderInstanceId}
                            disabled={!canShareProviderInstance || !options.includeModel}
                            title='供应商端点'
                            description={
                                canShareProviderInstance
                                    ? `接收者会优先切换到当前命名供应商端点（${trimmedProviderInstanceId}）。`
                                    : '需要同时分享模型 ID，才能准确恢复当前供应商端点。'
                            }
                            onCheckedChange={(checked) => updateOption('includeProviderInstanceId', checked)}
                        />

                        <ShareOptionRow
                            id={`${idPrefix}-base-url`}
                            checked={options.includeBaseUrl}
                            disabled={!hasValidBaseUrl}
                            title={`${providerLabel} API 地址`}
                            description={
                                hasValidBaseUrl
                                    ? '适合分享第三方兼容端点；私有或内网地址对别人可能不可用。'
                                    : '当前没有可分享的 http/https API 地址。'
                            }
                            onCheckedChange={(checked) => updateOption('includeBaseUrl', checked)}>
                            {hasValidBaseUrl && (
                                <p className='bg-muted text-muted-foreground mt-2 truncate rounded-lg px-2 py-1 text-[11px]'>
                                    {trimmedApiBaseUrl}
                                </p>
                            )}
                        </ShareOptionRow>

                        <ShareOptionRow
                            id={`${idPrefix}-autostart`}
                            checked={options.includeAutostart}
                            disabled={!canAutostart}
                            title='打开后自动生成'
                            description={
                                canAutostart
                                    ? '接收者打开链接后会立即提交一次生成请求，可能产生 API 费用。'
                                    : '必须同时分享非空提示词，才能启用自动生成。'
                            }
                            onCheckedChange={(checked) => updateOption('includeAutostart', checked)}
                        />
                    </div>

                    <div className='rounded-2xl border border-red-500/20 bg-red-500/10 p-3 dark:bg-red-500/10'>
                        <ShareOptionRow
                            id={`${idPrefix}-api-key`}
                            checked={options.includeApiKey}
                            disabled={!canShareApiKey}
                            title={`${providerLabel} API Key`}
                            description={
                                canShareApiKey
                                    ? `当前检测到 ${maskSecret(trimmedApiKey)}；强烈建议只分享临时或受限 Key。`
                                    : '当前没有可分享的 API Key。'
                            }
                            onCheckedChange={(checked) => updateOption('includeApiKey', checked)}
                        />

                        {options.includeApiKey && (
                            <div className='bg-background/85 mt-3 rounded-xl border border-red-500/25 p-3'>
                                <div className='flex items-start gap-3'>
                                    <Checkbox
                                        id={`${idPrefix}-api-key-ack`}
                                        checked={options.acknowledgeApiKey}
                                        onCheckedChange={(value) => updateOption('acknowledgeApiKey', value === true)}
                                        className='mt-0.5 border-red-400 data-[state=checked]:border-red-600 data-[state=checked]:bg-red-600 data-[state=checked]:text-white'
                                    />
                                    <div className='min-w-0 flex-1'>
                                        <Label
                                            htmlFor={`${idPrefix}-api-key-ack`}
                                            className='cursor-pointer text-sm font-semibold text-red-700 dark:text-red-200'>
                                            我理解这个链接会包含明文 API Key
                                        </Label>
                                        <p className='mt-1 text-xs leading-5 text-red-700/80 dark:text-red-200/80'>
                                            任何拿到链接的人都可能看到并使用它。未确认前不会复制包含 API Key 的链接。
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className='rounded-2xl border border-sky-500/25 bg-sky-500/10 p-3 dark:bg-sky-500/10'>
                        <ShareOptionRow
                            id={`${idPrefix}-sync-config`}
                            checked={options.includeSyncConfig}
                            disabled={!canShareSyncConfig}
                            title='云存储同步配置'
                            description={
                                canShareSyncConfig && syncConfig
                                    ? '包含 S3 Endpoint、Bucket、Access Key、Secret、根前缀和 Profile。接收者可保存后从最新快照恢复配置与历史图片。'
                                    : '当前浏览器还没有完整的 S3 兼容对象存储配置；请先在系统设置里保存云存储同步。'
                            }
                            onCheckedChange={(checked) => updateOption('includeSyncConfig', checked)}>
                            {canShareSyncConfig && syncConfig && (
                                <div className='bg-background/70 mt-2 grid gap-1 rounded-lg border border-sky-500/20 p-2 text-[11px] sm:grid-cols-2'>
                                    <p className='min-w-0 truncate'>
                                        <span className='text-muted-foreground'>Endpoint </span>
                                        <span className='font-mono'>{syncConfig.s3.endpoint}</span>
                                    </p>
                                    <p className='min-w-0 truncate'>
                                        <span className='text-muted-foreground'>Bucket </span>
                                        <span className='font-mono'>{syncConfig.s3.bucket}</span>
                                    </p>
                                    <p className='min-w-0 truncate'>
                                        <span className='text-muted-foreground'>Access Key </span>
                                        <span className='font-mono'>{maskSecret(syncConfig.s3.accessKeyId)}</span>
                                    </p>
                                    <p className='min-w-0 truncate'>
                                        <span className='text-muted-foreground'>Secret </span>
                                        <span className='font-mono'>{maskSecret(syncConfig.s3.secretAccessKey)}</span>
                                    </p>
                                    <p className='min-w-0 truncate sm:col-span-2'>
                                        <span className='text-muted-foreground'>远端路径 </span>
                                        <span className='font-mono'>{syncConfigBasePrefix}</span>
                                    </p>
                                </div>
                            )}
                        </ShareOptionRow>

                        {options.includeSyncConfig && (
                            <div className='bg-background/85 mt-3 space-y-3 rounded-xl border border-sky-500/25 p-3'>
                                <div className='border-border bg-background/70 space-y-3 rounded-xl border p-3'>
                                    <div className='flex items-start gap-3'>
                                        <Checkbox
                                            id={`${idPrefix}-sync-auto-restore`}
                                            checked={syncAutoRestore}
                                            onCheckedChange={(value) => {
                                                setSyncAutoRestore(value === true);
                                                setSecureShareUrl('');
                                                resetCopyStatus();
                                            }}
                                            className='mt-0.5 border-sky-400 data-[state=checked]:border-sky-600 data-[state=checked]:bg-sky-600 data-[state=checked]:text-white'
                                        />
                                        <div className='min-w-0 flex-1'>
                                            <Label
                                                htmlFor={`${idPrefix}-sync-auto-restore`}
                                                className='cursor-pointer text-sm font-medium'>
                                                保存云存储配置后自动恢复
                                            </Label>
                                            <p className='text-muted-foreground mt-1 text-xs leading-5'>
                                                默认关闭。关闭时，接收者只会看到按需恢复按钮，不会打开链接就开始下载。
                                            </p>
                                        </div>
                                    </div>

                                    <div className='flex items-start gap-3'>
                                        <Checkbox
                                            id={`${idPrefix}-sync-restore-metadata`}
                                            checked={syncRestoreMetadata}
                                            onCheckedChange={(value) => {
                                                setSyncRestoreMetadata(value === true);
                                                setSecureShareUrl('');
                                                resetCopyStatus();
                                            }}
                                            className='mt-0.5 border-sky-400 data-[state=checked]:border-sky-600 data-[state=checked]:bg-sky-600 data-[state=checked]:text-white'
                                        />
                                        <div className='min-w-0 flex-1'>
                                            <Label
                                                htmlFor={`${idPrefix}-sync-restore-metadata`}
                                                className='cursor-pointer text-sm font-medium'>
                                                恢复配置和历史记录
                                            </Label>
                                            <p className='text-muted-foreground mt-1 text-xs leading-5'>
                                                包含应用设置、提示词历史、提示词模板和图片历史元数据，不会下载图片文件。
                                            </p>
                                        </div>
                                    </div>

                                    <div className='space-y-2'>
                                        <Label className='text-muted-foreground text-xs font-medium'>
                                            历史图片文件
                                        </Label>
                                        <div className='grid gap-2 sm:grid-cols-3'>
                                            {(
                                                [
                                                    ['none', '不恢复图片'],
                                                    ['recent', '最近图片'],
                                                    ['full', '全部图片']
                                                ] as Array<[SharedSyncImageRestoreScope, string]>
                                            ).map(([scope, label]) => (
                                                <button
                                                    key={scope}
                                                    type='button'
                                                    onClick={() => {
                                                        setSyncImageRestoreScope(scope);
                                                        if (scope !== 'full') setAcknowledgeFullSyncRestore(false);
                                                        setSecureShareUrl('');
                                                        resetCopyStatus();
                                                    }}
                                                    className={cn(
                                                        'rounded-xl border px-3 py-2 text-left text-xs transition-colors',
                                                        syncImageRestoreScope === scope
                                                            ? 'border-sky-500/50 bg-sky-500/15 text-sky-800 dark:text-sky-100'
                                                            : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
                                                    )}>
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {syncImageRestoreScope === 'recent' && (
                                        <div className='grid gap-2 sm:grid-cols-[1fr_auto]'>
                                            <Input
                                                value={syncRecentRestoreAmount}
                                                onChange={(event) => {
                                                    setSyncRecentRestoreAmount(
                                                        event.target.value.replace(/[^\d]/g, '')
                                                    );
                                                    setSecureShareUrl('');
                                                    resetCopyStatus();
                                                }}
                                                inputMode='numeric'
                                                placeholder='7'
                                                className='bg-background h-10 rounded-xl'
                                                aria-label='最近图片恢复范围数值'
                                            />
                                            <div className='grid grid-cols-2 gap-2'>
                                                {(['hours', 'days'] as RecentRestoreUnit[]).map((unit) => (
                                                    <button
                                                        key={unit}
                                                        type='button'
                                                        onClick={() => {
                                                            setSyncRecentRestoreUnit(unit);
                                                            setSecureShareUrl('');
                                                            resetCopyStatus();
                                                        }}
                                                        className={cn(
                                                            'h-10 rounded-xl border px-3 text-sm transition-colors',
                                                            syncRecentRestoreUnit === unit
                                                                ? 'border-sky-500/50 bg-sky-500/15 text-sky-800 dark:text-sky-100'
                                                                : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
                                                        )}>
                                                        {unit === 'hours' ? '小时' : '天'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {syncImageRestoreScope === 'full' && (
                                        <div className='space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-100'>
                                            <p className='text-xs leading-5'>
                                                全量恢复会扫描并下载远端快照里的全部历史图片。历史较多时可能耗时很久、占用大量带宽和浏览器
                                                IndexedDB 空间。
                                            </p>
                                            <div className='flex items-start gap-3'>
                                                <Checkbox
                                                    id={`${idPrefix}-sync-full-ack`}
                                                    checked={acknowledgeFullSyncRestore}
                                                    onCheckedChange={(value) => {
                                                        setAcknowledgeFullSyncRestore(value === true);
                                                        setSecureShareUrl('');
                                                        resetCopyStatus();
                                                    }}
                                                    className='mt-0.5 border-amber-500 data-[state=checked]:border-amber-600 data-[state=checked]:bg-amber-600 data-[state=checked]:text-white'
                                                />
                                                <Label
                                                    htmlFor={`${idPrefix}-sync-full-ack`}
                                                    className='cursor-pointer text-xs leading-5 font-semibold'>
                                                    我理解全量恢复可能非常耗时、耗带宽，并可能写入大量本地图片数据。
                                                </Label>
                                            </div>
                                        </div>
                                    )}

                                    <p className='rounded-lg bg-sky-500/10 px-2 py-1.5 text-xs leading-5 text-sky-800 dark:text-sky-100'>
                                        {syncRestoreSummary}
                                    </p>
                                </div>

                                <div className='flex items-start gap-3'>
                                    <Checkbox
                                        id={`${idPrefix}-sync-config-ack`}
                                        checked={options.acknowledgeSyncConfig}
                                        onCheckedChange={(value) =>
                                            updateOption('acknowledgeSyncConfig', value === true)
                                        }
                                        className='mt-0.5 border-sky-400 data-[state=checked]:border-sky-600 data-[state=checked]:bg-sky-600 data-[state=checked]:text-white'
                                    />
                                    <div className='min-w-0 flex-1'>
                                        <Label
                                            htmlFor={`${idPrefix}-sync-config-ack`}
                                            className='cursor-pointer text-sm font-semibold text-sky-800 dark:text-sky-100'>
                                            我理解这个链接会包含云存储访问凭据
                                        </Label>
                                        <p className='mt-1 text-xs leading-5 text-sky-800/80 dark:text-sky-100/80'>
                                            勾选后会自动启用密码加密，并默认复制带解密密码的链接，方便你在新设备上一键保存并按需同步。请只发给自己的设备或可信接收者。
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className='rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 dark:bg-emerald-500/10'>
                        <ShareOptionRow
                            id={`${idPrefix}-secure-share`}
                            checked={options.useSecureShare}
                            title='使用密码加密整个分享链接'
                            description='启用后，链接只会暴露一个 sdata 参数；可以选择另行发送密码，或复制一个自带解密密码的完整链接。'
                            onCheckedChange={(checked) => updateOption('useSecureShare', checked)}
                        />

                        {options.useSecureShare && (
                            <div className='bg-background/85 mt-3 space-y-3 rounded-xl border border-emerald-500/25 p-3'>
                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <div className='space-y-1.5'>
                                        <Label htmlFor={`${idPrefix}-share-password`} className='text-sm font-medium'>
                                            解密密码
                                        </Label>
                                        <div className='flex gap-2'>
                                            <div className='relative min-w-0 flex-1'>
                                                <Input
                                                    id={`${idPrefix}-share-password`}
                                                    name={`${idPrefix}-share-password-one-time-key`}
                                                    type={sharePasswordVisible ? 'text' : 'password'}
                                                    value={sharePassword}
                                                    onChange={(event) => {
                                                        setSharePassword(event.target.value);
                                                        setSecureShareUrl('');
                                                        setSecureShareError('');
                                                        resetCopyStatus();
                                                    }}
                                                    placeholder={`建议至少 ${SHARE_PASSWORD_MIN_LENGTH} 个字符`}
                                                    autoComplete='one-time-code'
                                                    autoCorrect='off'
                                                    autoCapitalize='none'
                                                    data-1p-ignore='true'
                                                    data-bwignore='true'
                                                    data-lpignore='true'
                                                    className='min-w-0 rounded-xl pr-10'
                                                />
                                                <button
                                                    type='button'
                                                    onClick={() => setSharePasswordVisible((value) => !value)}
                                                    className='text-muted-foreground hover:bg-accent hover:text-foreground absolute top-1/2 right-1 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:outline-none'
                                                    aria-label={sharePasswordVisible ? '隐藏解密密码' : '显示解密密码'}>
                                                    {sharePasswordVisible ? (
                                                        <EyeOff className='h-4 w-4' aria-hidden='true' />
                                                    ) : (
                                                        <Eye className='h-4 w-4' aria-hidden='true' />
                                                    )}
                                                </button>
                                            </div>
                                            <Button
                                                type='button'
                                                variant='outline'
                                                onClick={handleGeneratePassword}
                                                className='h-10 shrink-0 rounded-xl px-3'
                                                aria-label={`随机生成 ${SHARE_PASSWORD_MIN_LENGTH} 位解密密码`}>
                                                <KeyRound className='h-4 w-4' aria-hidden='true' />
                                                随机
                                            </Button>
                                        </div>
                                    </div>
                                    <div className='space-y-1.5'>
                                        <Label
                                            htmlFor={`${idPrefix}-share-password-confirm`}
                                            className='text-sm font-medium'>
                                            再输入一次
                                        </Label>
                                        <div className='relative'>
                                            <Input
                                                id={`${idPrefix}-share-password-confirm`}
                                                name={`${idPrefix}-share-password-confirm-one-time-key`}
                                                type={sharePasswordConfirmationVisible ? 'text' : 'password'}
                                                value={sharePasswordConfirmation}
                                                onChange={(event) => {
                                                    setSharePasswordConfirmation(event.target.value);
                                                    setSecureShareUrl('');
                                                    setSecureShareError('');
                                                    resetCopyStatus();
                                                }}
                                                placeholder='确认解密密码'
                                                autoComplete='one-time-code'
                                                autoCorrect='off'
                                                autoCapitalize='none'
                                                data-1p-ignore='true'
                                                data-bwignore='true'
                                                data-lpignore='true'
                                                className='rounded-xl pr-10'
                                            />
                                            <button
                                                type='button'
                                                onClick={() => setSharePasswordConfirmationVisible((value) => !value)}
                                                className='text-muted-foreground hover:bg-accent hover:text-foreground absolute top-1/2 right-1 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:outline-none'
                                                aria-label={
                                                    sharePasswordConfirmationVisible ? '隐藏确认密码' : '显示确认密码'
                                                }>
                                                {sharePasswordConfirmationVisible ? (
                                                    <EyeOff className='h-4 w-4' aria-hidden='true' />
                                                ) : (
                                                    <Eye className='h-4 w-4' aria-hidden='true' />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <ShareOptionRow
                                    id={`${idPrefix}-secure-share-inline-password`}
                                    checked={options.includeSecurePasswordInUrl}
                                    title='复制时附带解密密码'
                                    description='复制出来的完整链接会使用 #key= 携带密码，接收者打开后自动解密，不需要再手动输入。方便转发，但拿到完整链接的人也等同拿到了密码。'
                                    onCheckedChange={(checked) => updateOption('includeSecurePasswordInUrl', checked)}
                                />
                                <p className='text-xs leading-5 text-emerald-800 dark:text-emerald-100/90'>
                                    未勾选时，密码不会写进链接，也不会保存；请通过另一条消息或可信渠道告诉接收者。简单密码可以继续使用，但更容易被猜到。
                                </p>
                                {(securePasswordRequiredMessage ||
                                    securePasswordMismatchMessage ||
                                    secureShareError) && (
                                    <p className='text-xs text-red-600 dark:text-red-300' role='alert'>
                                        {secureShareError ||
                                            securePasswordMismatchMessage ||
                                            securePasswordRequiredMessage}
                                    </p>
                                )}
                                {securePasswordWarningMessage &&
                                    !securePasswordRequiredMessage &&
                                    !securePasswordMismatchMessage &&
                                    !secureShareError && (
                                        <p
                                            className='text-xs leading-5 text-amber-700 dark:text-amber-300'
                                            role='status'>
                                            {securePasswordWarningMessage} 这只是安全提醒，不会阻止你复制分享链接。
                                        </p>
                                    )}
                            </div>
                        )}
                    </div>

                    <div className='border-border bg-card/70 space-y-2 rounded-2xl border p-3 dark:bg-white/[0.03]'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <div>
                                <Label htmlFor={`${idPrefix}-share-url`} className='text-sm font-medium'>
                                    生成的分享链接
                                </Label>
                                <p className='text-muted-foreground mt-1 text-xs'>
                                    {selectedItems.length > 0
                                        ? `包含：${selectedItems.join('、')}`
                                        : '未选择参数；当前只是应用入口链接。'}
                                    {options.useSecureShare && !secureShareUrl ? ' 复制时会生成加密后的链接。' : ''}
                                </p>
                            </div>
                            <span className='bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium'>
                                <SlidersHorizontal className='h-3 w-3' aria-hidden='true' />
                                {displayedShareUrl.length} 字符
                            </span>
                        </div>

                        <div className='flex flex-col gap-2 sm:flex-row'>
                            <Input
                                ref={urlInputRef}
                                id={`${idPrefix}-share-url`}
                                value={displayedShareUrl}
                                readOnly
                                onFocus={(event) => event.currentTarget.select()}
                                className='bg-background text-foreground h-10 rounded-xl font-mono text-xs'
                                aria-label='生成的分享链接'
                            />
                            <Button
                                type='button'
                                onClick={handleCopy}
                                disabled={copyDisabled}
                                className='disabled:from-muted disabled:to-muted disabled:text-muted-foreground h-10 shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20 hover:brightness-110 disabled:shadow-none'
                                aria-label={copyStatus === 'copied' ? '分享链接已复制' : '复制分享链接'}>
                                {copyStatus === 'copied' ? (
                                    <Check className='h-4 w-4' aria-hidden='true' />
                                ) : (
                                    <Copy className='h-4 w-4' aria-hidden='true' />
                                )}
                                {copyStatus === 'copied' ? '已复制' : '复制链接'}
                            </Button>
                        </div>

                        <div className='min-h-5 text-xs' aria-live='polite'>
                            {apiKeyNeedsAcknowledgement && (
                                <p className='flex items-center gap-1 text-red-600 dark:text-red-300'>
                                    <KeyRound className='h-3 w-3' aria-hidden='true' />
                                    需要先确认 API Key 风险，才能复制包含 Key 的链接。
                                </p>
                            )}
                            {syncConfigNeedsAcknowledgement && (
                                <p className='flex items-center gap-1 text-sky-700 dark:text-sky-300'>
                                    <Cloud className='h-3 w-3' aria-hidden='true' />
                                    需要先确认云存储凭据风险，才能复制同步配置链接。
                                </p>
                            )}
                            {fullSyncRestoreNeedsAcknowledgement && (
                                <p className='flex items-center gap-1 text-amber-700 dark:text-amber-300'>
                                    <AlertTriangle className='h-3 w-3' aria-hidden='true' />
                                    全量图片恢复需要先确认耗时、带宽和本地空间风险。
                                </p>
                            )}
                            {copyStatus === 'failed' && (
                                <p className='text-red-600 dark:text-red-300'>复制失败，请手动选择链接复制。</p>
                            )}
                            {isEncrypting && (
                                <p className='flex items-center gap-1 text-emerald-700 dark:text-emerald-300'>
                                    <LockKeyhole className='h-3 w-3 animate-pulse' aria-hidden='true' />
                                    正在用密码加密分享参数…
                                </p>
                            )}
                            {showLengthWarning && (
                                <p className='text-amber-700 dark:text-amber-300'>链接较长，部分聊天工具可能会截断。</p>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className='border-border bg-background/95 sticky bottom-0 gap-2 border-t px-5 py-4 backdrop-blur sm:px-6'>
                    <DialogClose asChild>
                        <Button type='button' variant='outline' className='rounded-xl'>
                            关闭
                        </Button>
                    </DialogClose>
                    <Button
                        type='button'
                        variant='secondary'
                        className='rounded-xl'
                        onClick={() => {
                            resetOptions();
                            urlInputRef.current?.focus();
                        }}>
                        重置选择
                    </Button>
                    <Button
                        type='button'
                        onClick={handleCopy}
                        disabled={copyDisabled}
                        className='disabled:from-muted disabled:to-muted disabled:text-muted-foreground rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20 hover:brightness-110 disabled:shadow-none'>
                        {options.useSecureShare ? (
                            <LockKeyhole className='h-4 w-4' aria-hidden='true' />
                        ) : (
                            <Play className='h-4 w-4' aria-hidden='true' />
                        )}
                        {isEncrypting ? '正在加密…' : '复制分享链接'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
