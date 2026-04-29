'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import packageJson from '../../package.json';
import { Info, Mail, Tag, UserRound } from 'lucide-react';

const appInfo = {
    name: 'GPT Image Playground',
    version: packageJson.version,
    author: '待补充',
    contact: '待补充'
};

export function AboutDialog() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant='ghost'
                    size='icon'
                    className='text-white/60 hover:bg-white/10 hover:text-white'
                    aria-label='关于 GPT Image Playground'>
                    <Info className='h-4 w-4' />
                </Button>
            </DialogTrigger>
            <DialogContent className='border-white/[0.08] bg-[#12121a] text-white shadow-xl shadow-black/40 sm:max-w-[460px]'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2 text-lg font-medium'>
                        <span className='rounded-xl border border-violet-400/20 bg-violet-500/10 p-2 text-violet-200'>
                            <Info className='h-5 w-5' />
                        </span>
                        关于
                    </DialogTitle>
                    <DialogDescription className='text-white/60'>
                        应用版本、作者和联系方式后续会集中放在这里。
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-3 py-2'>
                    <div className='rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4'>
                        <p className='text-sm font-medium text-white'>{appInfo.name}</p>
                        <p className='mt-1 text-xs leading-5 text-white/45'>用于 OpenAI GPT 图像模型生成、编辑、历史管理和提示词模板管理的本地工作台。</p>
                    </div>

                    <dl className='grid gap-2 text-sm'>
                        <div className='flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-black/15 px-3 py-2.5'>
                            <dt className='flex items-center gap-2 text-white/55'>
                                <Tag className='h-4 w-4 text-white/35' />
                                版本
                            </dt>
                            <dd className='font-mono text-white/80'>v{appInfo.version}</dd>
                        </div>
                        <div className='flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-black/15 px-3 py-2.5'>
                            <dt className='flex items-center gap-2 text-white/55'>
                                <UserRound className='h-4 w-4 text-white/35' />
                                作者
                            </dt>
                            <dd className='text-white/80'>{appInfo.author}</dd>
                        </div>
                        <div className='flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-black/15 px-3 py-2.5'>
                            <dt className='flex items-center gap-2 text-white/55'>
                                <Mail className='h-4 w-4 text-white/35' />
                                联系方式
                            </dt>
                            <dd className='text-white/80'>{appInfo.contact}</dd>
                        </div>
                    </dl>
                </div>
            </DialogContent>
        </Dialog>
    );
}
