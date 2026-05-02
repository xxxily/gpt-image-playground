'use client';

import packageJson from '../../package.json';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { Github, Globe, Info, Mail, Tag, UserRound } from 'lucide-react';
import Image from 'next/image';

const appInfo = {
    name: 'GPT Image Playground',
    version: packageJson.version,
    author: 'Blaze',
    contact: '扫码联系',
    websiteUrl: packageJson.homepage,
    websiteDisplay: packageJson.homepage.replace(/^https?:\/\//, ''),
    githubUrl: packageJson.repository.url,
    githubDisplay: 'xxxily/gpt-image-playgroun'
};

export function AboutDialog() {
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
                    <DialogDescription className='text-white/60'>应用版本、作者、网址和联系方式。</DialogDescription>
                </DialogHeader>

                <div className='space-y-3 py-2'>
                    <div className='rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4'>
                        <p className='text-sm font-medium text-white'>{appInfo.name}</p>
                        <p className='mt-1 text-xs leading-5 text-white/45'>
                            用于 OpenAI GPT 图像模型生成、编辑、历史管理和提示词模板管理的本地工作台。
                        </p>
                    </div>

                    <dl className='grid gap-2 text-sm'>
                        <div className='flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-black/15 px-3 py-2.5'>
                            <dt className='flex items-center gap-2 text-white/55'>
                                <Tag className='h-4 w-4 text-violet-600/80 dark:text-white/35' />
                                版本
                            </dt>
                            <dd className='font-mono text-white/80'>v{appInfo.version}</dd>
                        </div>
                        <div className='flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-black/15 px-3 py-2.5'>
                            <dt className='flex items-center gap-2 text-white/55'>
                                <UserRound className='h-4 w-4 text-violet-600/80 dark:text-white/35' />
                                作者
                            </dt>
                            <dd className='text-white/80'>{appInfo.author}</dd>
                        </div>
                        <div className='flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-black/15 px-3 py-2.5'>
                            <dt className='flex items-center gap-2 text-white/55'>
                                <Globe className='h-4 w-4 text-violet-600/80 dark:text-white/35' />
                                网址
                            </dt>
                            <dd className='text-white/80'>
                                <a
                                    href={appInfo.websiteUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-violet-600 underline underline-offset-2 transition-colors hover:text-violet-500 dark:text-violet-300 dark:hover:text-violet-200'>
                                    {appInfo.websiteDisplay}
                                </a>
                            </dd>
                        </div>
                        <div className='flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-black/15 px-3 py-2.5'>
                            <dt className='flex items-center gap-2 text-white/55'>
                                <Github className='h-4 w-4 text-violet-600/80 dark:text-white/35' />
                                GitHub
                            </dt>
                            <dd className='text-white/80'>
                                <a
                                    href={appInfo.githubUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-violet-600 underline underline-offset-2 transition-colors hover:text-violet-500 dark:text-violet-300 dark:hover:text-violet-200'>
                                    {appInfo.githubDisplay}
                                </a>
                            </dd>
                        </div>
                        <div className='flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-black/15 px-3 py-2.5'>
                            <dt className='flex items-center gap-2 text-white/55'>
                                <Mail className='h-4 w-4 text-violet-600/80 dark:text-white/35' />
                                联系方式
                            </dt>
                            <dd className='text-white/80'>{appInfo.contact}</dd>
                        </div>
                    </dl>

                    <div className='flex justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4'>
                        <Image
                            src='/qrcode.png'
                            alt='联系方式二维码'
                            width={160}
                            height={160}
                            className='h-40 w-40 rounded-lg object-contain'
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
