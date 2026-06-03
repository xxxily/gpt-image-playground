'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { LocalizedMessage } from '@/components/localized-message';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ExternalLink } from '@/components/ui/external-link';
import { appInfo } from '@/lib/app-info';
import { isNewerVersion } from '@/lib/desktop-config';
import {
    checkDesktopUpdate,
    installDesktopUpdate,
    isTauriDesktop,
    relaunchDesktopApp,
    type DesktopUpdate,
    type DesktopUpdateDownloadEvent
} from '@/lib/desktop-runtime';
import { Download, Github, Globe, Info, Mail, RefreshCw, Tag, UserRound, XCircle } from 'lucide-react';
import Image from 'next/image';
import type { ComponentType, ReactNode } from 'react';
import * as React from 'react';

const GITHUB_RELEASES_API_URL = 'https://api.github.com/repos/xxxily/gpt-image-playground/releases/latest';
const GITHUB_RELEASES_BASE_URL = 'https://github.com/xxxily/gpt-image-playground/releases/tag';

type GitHubRelease = {
    version: string;
    url: string;
};

type InstallProgress = {
    message: string;
    percent: number | null;
};

type InfoRowProps = {
    icon: ComponentType<{ className?: string }>;
    label: ReactNode;
    children: ReactNode;
};

function InfoRow({ icon: Icon, label, children }: InfoRowProps) {
    return (
        <div className='border-border bg-muted/40 dark:bg-panel-soft flex items-center justify-between gap-4 rounded-xl border px-3 py-2.5'>
            <dt className='text-muted-foreground flex items-center gap-2'>
                <Icon className='text-primary/80 h-4 w-4 dark:text-violet-200/80' />
                {label}
            </dt>
            <dd className='text-foreground/85 min-w-0 text-right'>{children}</dd>
        </div>
    );
}

type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'installing' | 'installed' | 'error';

function releaseUrlForVersion(version: string): string {
    const tag = version.startsWith('v') ? version : `v${version}`;
    return `${GITHUB_RELEASES_BASE_URL}/${tag}`;
}

function formatError(error: unknown, t: (key: string, params?: Record<string, string | number>) => string): string {
    return error instanceof Error ? error.message : t('phase4b.networkOperationFailed');
}

async function fetchLatestGitHubRelease(
    t: (key: string, params?: Record<string, string | number>) => string
): Promise<GitHubRelease> {
    const response = await fetch(GITHUB_RELEASES_API_URL, { signal: AbortSignal.timeout(10_000) });

    if (!response.ok) {
        throw new Error(t('phase4b.githubApiReturnedStatus', { status: response.status }));
    }

    const data = await response.json();
    const tag = data.tag_name;

    if (typeof tag !== 'string') {
        throw new Error(t('phase4b.releaseTagNotFound'));
    }

    const cleanedTag = tag.replace(/^v/, '');
    return {
        version: cleanedTag,
        url: typeof data.html_url === 'string' ? data.html_url : releaseUrlForVersion(cleanedTag)
    };
}

function nextInstallProgress(
    event: DesktopUpdateDownloadEvent,
    progress: { downloaded: number; total: number },
    t: (key: string, params?: Record<string, string | number>) => string
): InstallProgress {
    if (event.event === 'Started') {
        progress.downloaded = 0;
        progress.total = event.data.contentLength ?? 0;

        return {
            message: progress.total > 0 ? t('phase4b.downloadingUpdate') : t('phase4b.startingUpdateDownload'),
            percent: progress.total > 0 ? 0 : null
        };
    }

    if (event.event === 'Progress') {
        progress.downloaded += event.data.chunkLength;

        return {
            message: t('phase4b.downloadingUpdate'),
            percent: progress.total > 0 ? Math.min(99, Math.round((progress.downloaded / progress.total) * 100)) : null
        };
    }

    return {
        message: t('phase4b.downloadCompleteInstallingUpdate'),
        percent: 100
    };
}

export function AboutDialog() {
    const { t } = useAppLanguage();
    const [updateStatus, setUpdateStatus] = React.useState<UpdateStatus>('idle');
    const [latestVersion, setLatestVersion] = React.useState<string | null>(null);
    const [releaseUrl, setReleaseUrl] = React.useState<string | null>(null);
    const [desktopUpdate, setDesktopUpdate] = React.useState<DesktopUpdate | null>(null);
    const [installProgress, setInstallProgress] = React.useState<InstallProgress | null>(null);
    const [updateError, setUpdateError] = React.useState<string | null>(null);

    const handleCheckUpdate = React.useCallback(async () => {
        setUpdateStatus('checking');
        setLatestVersion(null);
        setReleaseUrl(null);
        setDesktopUpdate(null);
        setInstallProgress(null);
        setUpdateError(null);

        let desktopUpdateError: unknown = null;

        if (isTauriDesktop()) {
            try {
                const update = await checkDesktopUpdate();

                if (update) {
                    setDesktopUpdate(update);
                    setLatestVersion(update.version);
                    setReleaseUrl(releaseUrlForVersion(update.version));
                    setUpdateStatus('available');
                    return;
                }

                setLatestVersion(appInfo.version);
                setReleaseUrl(releaseUrlForVersion(appInfo.version));
                setUpdateStatus('up-to-date');
                return;
            } catch (error) {
                desktopUpdateError = error;
                console.warn('Tauri updater check failed, falling back to GitHub release check.', error);
            }
        }

        try {
            const release = await fetchLatestGitHubRelease(t);
            setLatestVersion(release.version);
            setReleaseUrl(release.url);

            if (isNewerVersion(appInfo.version, release.version)) {
                if (desktopUpdateError) {
                    setUpdateError(t('phase4b.autoInstallUnavailable', { error: formatError(desktopUpdateError, t) }));
                }
                setUpdateStatus('available');
            } else {
                setUpdateStatus('up-to-date');
            }
        } catch (e) {
            console.error('Check update failed:', e);
            setUpdateError(
                desktopUpdateError
                    ? t('phase4b.autoAndGithubUpdateChecksFailed', {
                          autoError: formatError(desktopUpdateError, t),
                          githubError: formatError(e, t)
                      })
                    : formatError(e, t)
            );
            setUpdateStatus('error');
        }
    }, [t]);

    const handleInstallUpdate = React.useCallback(async () => {
        if (!desktopUpdate) return;

        const progress = { downloaded: 0, total: 0 };
        setUpdateStatus('installing');
        setUpdateError(null);
        setInstallProgress({ message: t('phase4b.preparingUpdateDownload'), percent: null });

        try {
            await installDesktopUpdate(desktopUpdate, (event) => {
                setInstallProgress(nextInstallProgress(event, progress, t));
            });

            setInstallProgress({ message: t('phase4b.installCompleteRestartingApp'), percent: 100 });
            setUpdateStatus('installed');

            try {
                await relaunchDesktopApp();
            } catch (error) {
                console.error('Relaunch after update failed:', error);
                setUpdateError(t('phase4b.updateInstalledRestartManually', { error: formatError(error, t) }));
            }
        } catch (error) {
            console.error('Install update failed:', error);
            setUpdateError(formatError(error, t));
            setInstallProgress(null);
            setUpdateStatus('available');
        }
    }, [desktopUpdate, t]);

    const isChecking = updateStatus === 'checking';
    const isInstalling = updateStatus === 'installing';

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant='ghost'
                    size='icon'
                    className='text-foreground/60 hover:bg-accent hover:text-foreground'
                    aria-label={t('about.openAria')}>
                    <Info className='h-4 w-4' />
                </Button>
            </DialogTrigger>
            <DialogContent className='border-border bg-background text-foreground shadow-xl sm:max-w-[460px]'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2 text-lg font-medium'>
                        <span className='rounded-xl border border-violet-400/20 bg-violet-500/10 p-2 text-violet-600 dark:text-violet-200'>
                            <Info className='h-5 w-5' />
                        </span>
                        <LocalizedMessage id='phase4b.about' />
                    </DialogTitle>
                </DialogHeader>

                <div className='space-y-3 py-2'>
                    <div className='border-border bg-card/80 dark:bg-panel-ghost rounded-2xl border p-4 shadow-sm'>
                        <p className='text-foreground text-sm font-medium'>{appInfo.name}</p>
                        <p className='text-muted-foreground mt-1 text-xs leading-5'>{appInfo.description}</p>
                    </div>

                    <dl className='grid gap-2 text-sm'>
                        <InfoRow icon={Tag} label={<LocalizedMessage id='about.version' />}>
                            <span className='font-mono'>v{appInfo.version}</span>
                        </InfoRow>
                        <InfoRow icon={UserRound} label={<LocalizedMessage id='about.author' />}>
                            {appInfo.author}
                        </InfoRow>
                        <InfoRow icon={Globe} label={<LocalizedMessage id='about.website' />}>
                            <ExternalLink
                                href={appInfo.websiteUrl}
                                className='break-all text-violet-600 underline underline-offset-2 transition-colors hover:text-violet-500 dark:text-violet-300 dark:hover:text-violet-200'>
                                {appInfo.websiteDisplay}
                            </ExternalLink>
                        </InfoRow>
                        <InfoRow icon={Github} label='GitHub'>
                            <ExternalLink
                                href={appInfo.githubUrl}
                                className='break-all text-violet-600 underline underline-offset-2 transition-colors hover:text-violet-500 dark:text-violet-300 dark:hover:text-violet-200'>
                                {appInfo.githubDisplay}
                            </ExternalLink>
                        </InfoRow>
                        <InfoRow icon={Mail} label={<LocalizedMessage id='about.contact' />}>
                            {appInfo.contact}
                        </InfoRow>
                    </dl>

                    <div className='border-border bg-card/80 dark:bg-panel-ghost flex justify-center rounded-2xl border p-4 shadow-sm'>
                        <Image
                            src={appInfo.contactQrCodePath}
                            alt={t('about.contactQrAlt')}
                            width={160}
                            height={160}
                            className='h-40 w-40 rounded-lg object-contain'
                        />
                    </div>

                    <div className='border-border bg-card/80 dark:bg-panel-ghost rounded-2xl border p-4 shadow-sm'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={handleCheckUpdate}
                                disabled={isChecking || isInstalling}
                                className='gap-1.5 rounded-xl'>
                                <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                                {isChecking ? t('phase4b.checking') : t('phase4b.checkForUpdates')}
                            </Button>

                            {updateStatus === 'available' && desktopUpdate && (
                                <Button
                                    variant='default'
                                    size='sm'
                                    onClick={handleInstallUpdate}
                                    disabled={isInstalling}
                                    className='gap-1.5 rounded-xl'>
                                    <Download className='h-3.5 w-3.5' />
                                    <LocalizedMessage id='phase4b.installNewVersion' />
                                </Button>
                            )}
                        </div>

                        <div className='mt-3 text-xs leading-5' aria-live='polite'>
                            {updateStatus === 'up-to-date' && (
                                <p className='font-medium text-emerald-600 dark:text-emerald-400'>
                                    <LocalizedMessage id='phase4b.youAreOnTheLatestVersion' />
                                </p>
                            )}

                            {updateStatus === 'available' && latestVersion && desktopUpdate && (
                                <div className='space-y-1'>
                                    <p className='font-medium text-violet-600 dark:text-violet-300'>
                                        <LocalizedMessage id='phase4b.newVersionV' />
                                        {latestVersion} <LocalizedMessage id='phase4b.isAvailableCurrentV' />
                                        {appInfo.version}
                                        <LocalizedMessage id='phase4b.andItCanBeDownloadedAndInstalledDirectly' />
                                    </p>
                                    {updateError && (
                                        <p
                                            className='inline-flex items-start gap-1.5 text-red-600 dark:text-red-400'
                                            role='alert'>
                                            <XCircle className='mt-0.5 h-3.5 w-3.5 shrink-0' aria-hidden='true' />
                                            <span>{updateError}</span>
                                        </p>
                                    )}
                                </div>
                            )}

                            {updateStatus === 'available' && latestVersion && !desktopUpdate && releaseUrl && (
                                <div className='space-y-1'>
                                    <ExternalLink
                                        href={releaseUrl}
                                        className='text-violet-600 underline underline-offset-2 hover:text-violet-500 dark:text-violet-300'>
                                        <LocalizedMessage id='phase4b.newVersionV' />
                                        {latestVersion} <LocalizedMessage id='phase4b.isAvailableCurrentV' />
                                        {appInfo.version}
                                        <LocalizedMessage id='phase4b.clickToOpenTheReleasePage' />
                                    </ExternalLink>
                                    {updateError && <p className='text-muted-foreground'>{updateError}</p>}
                                </div>
                            )}

                            {isInstalling && installProgress && (
                                <div className='space-y-2'>
                                    <p className='font-medium text-violet-600 dark:text-violet-300'>
                                        {installProgress.message}
                                        {installProgress.percent !== null ? ` ${installProgress.percent}%` : ''}
                                    </p>
                                    {installProgress.percent !== null && (
                                        <div className='bg-muted h-1.5 overflow-hidden rounded-full'>
                                            <div
                                                className='h-full rounded-full bg-violet-500 transition-[width]'
                                                style={{ width: `${installProgress.percent}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {updateStatus === 'installed' && (
                                <p className='font-medium text-emerald-600 dark:text-emerald-400'>
                                    <LocalizedMessage id='phase4b.updateInstalledRestartingApp' />
                                </p>
                            )}

                            {updateStatus === 'error' && (
                                <p
                                    className='inline-flex items-start gap-1.5 text-red-600 dark:text-red-400'
                                    role='alert'>
                                    <XCircle className='mt-0.5 h-3.5 w-3.5 shrink-0' aria-hidden='true' />
                                    <span>{updateError}</span>
                                </p>
                            )}
                        </div>
                        {latestVersion && updateStatus === 'up-to-date' && (
                            <p className='text-muted-foreground mt-2 text-xs'>
                                {t('phase4b.currentAndLatestVersionSummary', {
                                    current: appInfo.version,
                                    latest: latestVersion
                                })}
                            </p>
                        )}
                        {releaseUrl && updateStatus === 'installed' && updateError && (
                            <p
                                className='mt-2 inline-flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400'
                                role='alert'>
                                <XCircle className='mt-0.5 h-3.5 w-3.5 shrink-0' aria-hidden='true' />
                                <span>{updateError}</span>
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
