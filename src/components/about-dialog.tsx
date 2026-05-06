'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { appInfo } from '@/lib/app-info';
import { isNewerVersion } from '@/lib/desktop-config';
import { Github, Globe, Info, Mail, Tag, UserRound, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import type { ComponentType, ReactNode } from 'react';
import * as React from 'react';

type InfoRowProps = {
    icon: ComponentType<{ className?: string }>;
    label: string;
    children: ReactNode;
};

function InfoRow({ icon: Icon, label, children }: InfoRowProps) {
    return (
        <div className='flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-3 py-2.5 dark:bg-white/[0.025]'>
            <dt className='flex items-center gap-2 text-muted-foreground'>
                <Icon className='h-4 w-4 text-primary/80 dark:text-violet-200/80' />
                {label}
            </dt>
            <dd className='min-w-0 text-right text-foreground/85'>{children}</dd>
        </div>
    );
}

type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'error';

export function AboutDialog() {
    const [updateStatus, setUpdateStatus] = React.useState<UpdateStatus>('idle');
    const [latestVersion, setLatestVersion] = React.useState<string | null>(null);
    const [releaseUrl, setReleaseUrl] = React.useState<string | null>(null);
    const [updateError, setUpdateError] = React.useState<string | null>(null);

    const handleCheckUpdate = React.useCallback(async () => {
        setUpdateStatus('checking');
        setLatestVersion(null);
        setReleaseUrl(null);
        setUpdateError(null);

        try {
            const response = await fetch(
                'https://api.github.com/repos/xxxily/gpt-image-playground/releases/latest',
                { signal: AbortSignal.timeout(10_000) }
            );

            if (!response.ok) {
                throw new Error(`GitHub API 返回 ${response.status}`);
            }

            const data = await response.json();
            const tag = data.tag_name;

            if (typeof tag !== 'string') {
                throw new Error('未找到发布标签');
            }

            const cleanedTag = tag.replace(/^v/, '');
            setLatestVersion(cleanedTag);
            setReleaseUrl(data.html_url || `https://github.com/xxxily/gpt-image-playground/releases/tag/${tag}`);

            if (isNewerVersion(appInfo.version, cleanedTag)) {
                setUpdateStatus('available');
            } else {
                setUpdateStatus('up-to-date');
            }
        } catch (e) {
            console.error('Check update failed:', e);
            setUpdateError(e instanceof Error ? e.message : '检查更新失败，请检查网络连接');
            setUpdateStatus('error');
        }
    }, []);

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
                    <DialogDescription className='text-muted-foreground'>应用版本、作者、网址和联系方式。</DialogDescription>
                </DialogHeader>

                <div className='space-y-3 py-2'>
                    <div className='rounded-2xl border border-border bg-card/80 p-4 shadow-sm dark:bg-white/[0.03]'>
                        <p className='text-sm font-medium text-foreground'>{appInfo.name}</p>
                        <p className='mt-1 text-xs leading-5 text-muted-foreground'>{appInfo.description}</p>
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
                                className='break-all text-violet-600 underline underline-offset-2 transition-colors hover:text-violet-500 dark:text-violet-300 dark:hover:text-violet-200'>
                                {appInfo.websiteDisplay}
                            </a>
                        </InfoRow>
                        <InfoRow icon={Github} label='GitHub'>
                            <a
                                href={appInfo.githubUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='break-all text-violet-600 underline underline-offset-2 transition-colors hover:text-violet-500 dark:text-violet-300 dark:hover:text-violet-200'>
                                {appInfo.githubDisplay}
                            </a>
                        </InfoRow>
                        <InfoRow icon={Mail} label='联系方式'>
                            {appInfo.contact}
                        </InfoRow>
                    </dl>

                    <div className='flex justify-center rounded-2xl border border-border bg-card/80 p-4 shadow-sm dark:bg-white/[0.03]'>
                        <Image
                            src={appInfo.contactQrCodePath}
                            alt='联系方式二维码'
                            width={160}
                            height={160}
                            className='h-40 w-40 rounded-lg object-contain'
                        />
                    </div>

                    <div className='rounded-2xl border border-border bg-card/80 p-4 shadow-sm dark:bg-white/[0.03]'>
                        <div className='flex items-center gap-3'>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={handleCheckUpdate}
                                disabled={updateStatus === 'checking'}
                                className='rounded-xl gap-1.5'>
                                <RefreshCw className={`h-3.5 w-3.5 ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
                                {updateStatus === 'checking' ? '检查中...' : '检查更新'}
                            </Button>

                            {updateStatus === 'up-to-date' && (
                                <span className='text-xs text-emerald-600 dark:text-emerald-400 font-medium'>
                                    当前已是最新版本
                                </span>
                            )}

                            {updateStatus === 'available' && latestVersion && releaseUrl && (
                                <a
                                    href={releaseUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-xs text-violet-600 underline underline-offset-2 hover:text-violet-500 dark:text-violet-300'>
                                    新版本 v{latestVersion} 可用（当前 v{appInfo.version}），点击前往发布页
                                </a>
                            )}

                            {updateStatus === 'error' && (
                                <span className='text-xs text-red-600 dark:text-red-400' role='alert'>
                                    {updateError}
                                </span>
                            )}
                        </div>
                        {latestVersion && updateStatus === 'up-to-date' && (
                            <p className='mt-2 text-xs text-muted-foreground'>
                                当前版本 v{appInfo.version}，最新 GitHub 发布版本同样为 v{latestVersion}。
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
