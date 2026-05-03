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
import {
    encryptShareParams,
    getSharePasswordRequiredMessage,
    getSharePasswordWarningMessage,
    SHARE_PASSWORD_MIN_LENGTH
} from '@/lib/share-crypto';
import { buildSecureShareUrl, buildShareUrl, type ShareUrlParams } from '@/lib/url-params';
import { cn } from '@/lib/utils';
import {
    AlertTriangle,
    Check,
    Copy,
    KeyRound,
    Link2,
    LockKeyhole,
    Play,
    Share2,
    SlidersHorizontal
} from 'lucide-react';
import * as React from 'react';

type ShareOptions = {
    includePrompt: boolean;
    includeModel: boolean;
    includeBaseUrl: boolean;
    includeApiKey: boolean;
    includeAutostart: boolean;
    acknowledgeApiKey: boolean;
    useSecureShare: boolean;
};

type ShareDialogProps = {
    currentPrompt: string;
    currentModel: string;
    apiKey: string;
    apiBaseUrl: string;
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

const COPY_FEEDBACK_MS = 1800;
const URL_LENGTH_WARNING_LIMIT = 1800;

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

async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (error) {
        console.warn('Clipboard API copy failed, trying fallback.', error);
    }

    if (typeof document === 'undefined') return false;

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.select();

    try {
        return document.execCommand('copy');
    } catch (error) {
        console.error('Fallback share URL copy failed.', error);
        return false;
    } finally {
        textArea.remove();
    }
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
    providerLabel,
    triggerClassName
}: ShareDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [currentUrl, setCurrentUrl] = React.useState('');
    const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'failed'>('idle');
    const [options, setOptions] = React.useState<ShareOptions>({
        includePrompt: false,
        includeModel: true,
        includeBaseUrl: false,
        includeApiKey: false,
        includeAutostart: false,
        acknowledgeApiKey: false,
        useSecureShare: false
    });
    const [sharePassword, setSharePassword] = React.useState('');
    const [sharePasswordConfirmation, setSharePasswordConfirmation] = React.useState('');
    const [secureShareUrl, setSecureShareUrl] = React.useState('');
    const [secureShareError, setSecureShareError] = React.useState('');
    const [isEncrypting, setIsEncrypting] = React.useState(false);
    const urlInputRef = React.useRef<HTMLInputElement>(null);
    const copyStatusTimerRef = React.useRef<number | null>(null);
    const idPrefix = React.useId();

    const trimmedPrompt = currentPrompt.trim();
    const trimmedModel = currentModel.trim();
    const trimmedApiKey = apiKey.trim();
    const trimmedApiBaseUrl = apiBaseUrl.trim();
    const hasValidBaseUrl = isHttpUrl(trimmedApiBaseUrl);
    const canSharePrompt = trimmedPrompt.length > 0;
    const canShareApiKey = trimmedApiKey.length > 0;

    const resetCopyStatus = React.useCallback(() => {
        if (copyStatusTimerRef.current !== null) {
            window.clearTimeout(copyStatusTimerRef.current);
            copyStatusTimerRef.current = null;
        }
        setCopyStatus('idle');
    }, []);

    const resetOptions = React.useCallback(() => {
        setOptions({
            includePrompt: canSharePrompt,
            includeModel: true,
            includeBaseUrl: hasValidBaseUrl,
            includeApiKey: false,
            includeAutostart: false,
            acknowledgeApiKey: false,
            useSecureShare: false
        });
        setSharePassword('');
        setSharePasswordConfirmation('');
        setSecureShareUrl('');
        setSecureShareError('');
        setIsEncrypting(false);
        resetCopyStatus();
        if (typeof window !== 'undefined') setCurrentUrl(window.location.href);
    }, [canSharePrompt, hasValidBaseUrl, resetCopyStatus]);

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
                if (key === 'includeApiKey' && value === false) next.acknowledgeApiKey = false;
                return next;
            });
            setSecureShareUrl('');
            setSecureShareError('');
            resetCopyStatus();
        },
        [resetCopyStatus]
    );

    const canAutostart = options.includePrompt && canSharePrompt;
    const apiKeyNeedsAcknowledgement = options.includeApiKey && !options.acknowledgeApiKey;
    const securePasswordRequiredMessage = options.useSecureShare ? getSharePasswordRequiredMessage(sharePassword) : null;
    const securePasswordWarningMessage = options.useSecureShare ? getSharePasswordWarningMessage(sharePassword) : null;
    const securePasswordMismatch = options.useSecureShare ? sharePassword !== sharePasswordConfirmation : false;
    const securePasswordMismatchMessage =
        options.useSecureShare && !securePasswordRequiredMessage && securePasswordMismatch
            ? '两次输入的解密密码不一致。'
            : null;

    const selectedShareParams = React.useMemo<ShareUrlParams>(() => {
        const params: ShareUrlParams = {};

        if (options.includePrompt && canSharePrompt) params.prompt = trimmedPrompt;
        if (options.includeModel && trimmedModel) params.model = trimmedModel;
        if (options.includeBaseUrl && hasValidBaseUrl) params.baseUrl = trimmedApiBaseUrl;
        if (options.includeApiKey && options.acknowledgeApiKey && canShareApiKey) params.apiKey = trimmedApiKey;
        if (options.includeAutostart && canAutostart) params.autostart = true;

        return params;
    }, [
        canAutostart,
        canShareApiKey,
        canSharePrompt,
        hasValidBaseUrl,
        options,
        trimmedApiBaseUrl,
        trimmedApiKey,
        trimmedModel,
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
        if (selectedShareParams.baseUrl) items.push('API 地址');
        if (selectedShareParams.apiKey) items.push('API Key');
        if (selectedShareParams.autostart) items.push('自动生成');
        if (options.useSecureShare) items.push('密码加密');
        return items;
    }, [options.useSecureShare, selectedShareParams]);

    const secureShareDisabled = Boolean(
        options.useSecureShare && (securePasswordRequiredMessage || securePasswordMismatchMessage || isEncrypting)
    );
    const copyDisabled = !shareUrl || apiKeyNeedsAcknowledgement || secureShareDisabled;
    const showLengthWarning = displayedShareUrl.length > URL_LENGTH_WARNING_LIMIT;

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (nextOpen) resetOptions();
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
                urlToCopy = buildSecureShareUrl(currentUrl, encryptedPayload);
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
                        'h-7 min-w-0 cursor-pointer rounded-md px-2 text-[11px] text-white/60 transition-all duration-200 hover:bg-white/8 hover:text-white/85 focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent active:scale-[0.98] active:bg-white/15 sm:h-8 sm:px-2.5 sm:text-xs sm:text-white/70 sm:hover:bg-white/10 sm:hover:text-white dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white',
                        triggerClassName
                    )}
                    aria-label='分享当前提示词和配置'
                    title='分享当前提示词和配置'>
                    <Share2 className='h-3 w-3' aria-hidden='true' />
                    <span>分享</span>
                </Button>
            </DialogTrigger>
            <DialogContent className='border-border bg-background text-foreground h-dvh max-h-dvh w-screen max-w-none overflow-y-auto rounded-none p-0 shadow-2xl sm:h-auto sm:max-h-[92vh] sm:w-[min(720px,calc(100vw-2rem))] sm:max-w-[720px] sm:rounded-2xl'>
                <DialogHeader className='border-border bg-card/60 border-b px-5 py-5 text-left sm:px-6 dark:bg-white/[0.03]'>
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

                    <div className='rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 dark:bg-emerald-500/10'>
                        <ShareOptionRow
                            id={`${idPrefix}-secure-share`}
                            checked={options.useSecureShare}
                            title='使用密码加密整个分享链接'
                            description='启用后，链接只会暴露一个 sdata 参数；接收者必须输入你另行告知的密码才能解密并应用参数。'
                            onCheckedChange={(checked) => updateOption('useSecureShare', checked)}
                        />

                        {options.useSecureShare && (
                            <div className='bg-background/85 mt-3 space-y-3 rounded-xl border border-emerald-500/25 p-3'>
                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <div className='space-y-1.5'>
                                        <Label htmlFor={`${idPrefix}-share-password`} className='text-sm font-medium'>
                                            解密密码
                                        </Label>
                                        <Input
                                            id={`${idPrefix}-share-password`}
                                            name={`${idPrefix}-share-password-one-time-key`}
                                            type='password'
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
                                            className='rounded-xl'
                                        />
                                    </div>
                                    <div className='space-y-1.5'>
                                        <Label
                                            htmlFor={`${idPrefix}-share-password-confirm`}
                                            className='text-sm font-medium'>
                                            再输入一次
                                        </Label>
                                        <Input
                                            id={`${idPrefix}-share-password-confirm`}
                                            name={`${idPrefix}-share-password-confirm-one-time-key`}
                                            type='password'
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
                                            className='rounded-xl'
                                        />
                                    </div>
                                </div>
                                <p className='text-xs leading-5 text-emerald-800 dark:text-emerald-100/90'>
                                    密码不会写进链接，也不会保存；请通过另一条消息或可信渠道告诉接收者。简单密码可以继续使用，但更容易被猜到。
                                </p>
                                {(securePasswordRequiredMessage || securePasswordMismatchMessage || secureShareError) && (
                                    <p className='text-xs text-red-600 dark:text-red-300' role='alert'>
                                        {secureShareError ||
                                            securePasswordMismatchMessage ||
                                            securePasswordRequiredMessage}
                                    </p>
                                )}
                                {securePasswordWarningMessage && !securePasswordRequiredMessage && !securePasswordMismatchMessage && !secureShareError && (
                                    <p className='text-xs leading-5 text-amber-700 dark:text-amber-300' role='status'>
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
