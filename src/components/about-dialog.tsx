'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { appInfo } from '@/lib/app-info';
import { isNewerVersion } from '@/lib/desktop-config';
import {
    checkDesktopUpdate,
    handleExternalLinkClick,
    installDesktopUpdate,
    isTauriDesktop,
    relaunchDesktopApp,
    type DesktopUpdate,
    type DesktopUpdateDownloadEvent
} from '@/lib/desktop-runtime';
import { Download, Github, Globe, Info, Mail, RefreshCw, Tag, UserRound } from 'lucide-react';
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
    label: string;
    children: ReactNode;
};

function InfoRow({ icon: Icon, label, children }: InfoRowProps) {
    return (
        <div className='border-border bg-muted/40 flex items-center justify-between gap-4 rounded-xl border px-3 py-2.5 dark:bg-white/[0.025]'>
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

function formatError(error: unknown): string {
    return error instanceof Error ? error.message : '操作失败，请检查网络连接';
}

async function fetchLatestGitHubRelease(): Promise<GitHubRelease> {
    const response = await fetch(GITHUB_RELEASES_API_URL, { signal: AbortSignal.timeout(10_000) });

    if (!response.ok) {
        throw new Error(`GitHub API 返回 ${response.status}`);
    }

    const data = await response.json();
    const tag = data.tag_name;

    if (typeof tag !== 'string') {
        throw new Error('未找到发布标签');
    }

    const cleanedTag = tag.replace(/^v/, '');
    return {
        version: cleanedTag,
        url: typeof data.html_url === 'string' ? data.html_url : releaseUrlForVersion(cleanedTag)
    };
}

function nextInstallProgress(
    event: DesktopUpdateDownloadEvent,
    progress: { downloaded: number; total: number }
): InstallProgress {
    if (event.event === 'Started') {
        progress.downloaded = 0;
        progress.total = event.data.contentLength ?? 0;

        return {
            message: progress.total > 0 ? '正在下载更新' : '开始下载更新',
            percent: progress.total > 0 ? 0 : null
        };
    }

    if (event.event === 'Progress') {
        progress.downloaded += event.data.chunkLength;

        return {
            message: '正在下载更新',
            percent: progress.total > 0 ? Math.min(99, Math.round((progress.downloaded / progress.total) * 100)) : null
        };
    }

    return {
        message: '下载完成，正在安装更新',
        percent: 100
    };
}

export function AboutDialog() {
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
            const release = await fetchLatestGitHubRelease();
            setLatestVersion(release.version);
            setReleaseUrl(release.url);

            if (isNewerVersion(appInfo.version, release.version)) {
                if (desktopUpdateError) {
                    setUpdateError(`自动安装暂不可用：${formatError(desktopUpdateError)}`);
                }
                setUpdateStatus('available');
            } else {
                setUpdateStatus('up-to-date');
            }
        } catch (e) {
            console.error('Check update failed:', e);
            setUpdateError(
                desktopUpdateError
                    ? `自动更新检查失败：${formatError(desktopUpdateError)}；GitHub 检查失败：${formatError(e)}`
                    : formatError(e)
            );
            setUpdateStatus('error');
        }
    }, []);

    const handleInstallUpdate = React.useCallback(async () => {
        if (!desktopUpdate) return;

        const progress = { downloaded: 0, total: 0 };
        setUpdateStatus('installing');
        setUpdateError(null);
        setInstallProgress({ message: '准备下载更新', percent: null });

        try {
            await installDesktopUpdate(desktopUpdate, (event) => {
                setInstallProgress(nextInstallProgress(event, progress));
            });

            setInstallProgress({ message: '安装完成，正在重启应用', percent: 100 });
            setUpdateStatus('installed');

            try {
                await relaunchDesktopApp();
            } catch (error) {
                console.error('Relaunch after update failed:', error);
                setUpdateError(`更新已安装，请手动重启应用：${formatError(error)}`);
            }
        } catch (error) {
            console.error('Install update failed:', error);
            setUpdateError(formatError(error));
            setInstallProgress(null);
            setUpdateStatus('available');
        }
    }, [desktopUpdate]);

    const isChecking = updateStatus === 'checking';
    const isInstalling = updateStatus === 'installing';

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant='ghost'
                    size='icon'
                    className='text-foreground/60 hover:bg-accent hover:text-foreground'
                    aria-label='关于 GPT Image Playground'>
                    <Info className='h-4 w-4' />
                </Button>
            </DialogTrigger>
            <DialogContent className='border-border bg-background text-foreground shadow-xl sm:max-w-[460px]'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2 text-lg font-medium'>
                        <span className='rounded-xl border border-violet-400/20 bg-violet-500/10 p-2 text-violet-600 dark:text-violet-200'>
                            <Info className='h-5 w-5' />
                        </span>
                        关于
                    </DialogTitle>
                </DialogHeader>

                <div className='space-y-3 py-2'>
                    <div className='border-border bg-card/80 rounded-2xl border p-4 shadow-sm dark:bg-white/[0.03]'>
                        <p className='text-foreground text-sm font-medium'>{appInfo.name}</p>
                        <p className='text-muted-foreground mt-1 text-xs leading-5'>{appInfo.description}</p>
                    </div>

                    <dl className='grid gap-2 text-sm'>
                        <InfoRow icon={Tag} label='版本'>
                            <span className='font-mono'>v{appInfo.version}</span>
                        </InfoRow>
                        <InfoRow icon={UserRound} label='作者'>
                            {appInfo.author}
                        </InfoRow>
                        <InfoRow icon={Globe} label='网址'>
                            <a
                                href={appInfo.websiteUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                                onClick={handleExternalLinkClick(appInfo.websiteUrl)}
                                className='break-all text-violet-600 underline underline-offset-2 transition-colors hover:text-violet-500 dark:text-violet-300 dark:hover:text-violet-200'>
                                {appInfo.websiteDisplay}
                            </a>
                        </InfoRow>
                        <InfoRow icon={Github} label='GitHub'>
                            <a
                                href={appInfo.githubUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                                onClick={handleExternalLinkClick(appInfo.githubUrl)}
                                className='break-all text-violet-600 underline underline-offset-2 transition-colors hover:text-violet-500 dark:text-violet-300 dark:hover:text-violet-200'>
                                {appInfo.githubDisplay}
                            </a>
                        </InfoRow>
                        <InfoRow icon={Mail} label='联系方式'>
                            {appInfo.contact}
                        </InfoRow>
                    </dl>

                    <div className='border-border bg-card/80 flex justify-center rounded-2xl border p-4 shadow-sm dark:bg-white/[0.03]'>
                        <Image
                            src={appInfo.contactQrCodePath}
                            alt='联系方式二维码'
                            width={160}
                            height={160}
                            className='h-40 w-40 rounded-lg object-contain'
                        />
                    </div>

                    <div className='border-border bg-card/80 rounded-2xl border p-4 shadow-sm dark:bg-white/[0.03]'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={handleCheckUpdate}
                                disabled={isChecking || isInstalling}
                                className='gap-1.5 rounded-xl'>
                                <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                                {isChecking ? '检查中...' : '检查更新'}
                            </Button>

                            {updateStatus === 'available' && desktopUpdate && (
                                <Button
                                    variant='default'
                                    size='sm'
                                    onClick={handleInstallUpdate}
                                    disabled={isInstalling}
                                    className='gap-1.5 rounded-xl'>
                                    <Download className='h-3.5 w-3.5' />
                                    安装新版本
                                </Button>
                            )}
                        </div>

                        <div className='mt-3 text-xs leading-5' aria-live='polite'>
                            {updateStatus === 'up-to-date' && (
                                <p className='font-medium text-emerald-600 dark:text-emerald-400'>当前已是最新版本</p>
                            )}

                            {updateStatus === 'available' && latestVersion && desktopUpdate && (
                                <div className='space-y-1'>
                                    <p className='font-medium text-violet-600 dark:text-violet-300'>
                                        新版本 v{latestVersion} 可用（当前 v{appInfo.version}），可直接下载并安装。
                                    </p>
                                    {updateError && (
                                        <p className='text-red-600 dark:text-red-400' role='alert'>
                                            {updateError}
                                        </p>
                                    )}
                                </div>
                            )}

                            {updateStatus === 'available' && latestVersion && !desktopUpdate && releaseUrl && (
                                <div className='space-y-1'>
                                    <a
                                        href={releaseUrl}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        onClick={handleExternalLinkClick(releaseUrl)}
                                        className='text-violet-600 underline underline-offset-2 hover:text-violet-500 dark:text-violet-300'>
                                        新版本 v{latestVersion} 可用（当前 v{appInfo.version}），点击前往发布页
                                    </a>
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
                                    更新已安装，正在重启应用。
                                </p>
                            )}

                            {updateStatus === 'error' && (
                                <p className='text-red-600 dark:text-red-400' role='alert'>
                                    {updateError}
                                </p>
                            )}
                        </div>
                        {latestVersion && updateStatus === 'up-to-date' && (
                            <p className='text-muted-foreground mt-2 text-xs'>
                                当前版本 v{appInfo.version}，最新 GitHub 发布版本同样为 v{latestVersion}。
                            </p>
                        )}
                        {releaseUrl && updateStatus === 'installed' && updateError && (
                            <p className='mt-2 text-xs text-red-600 dark:text-red-400' role='alert'>
                                {updateError}
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
