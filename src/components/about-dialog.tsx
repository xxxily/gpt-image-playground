'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { Info } from 'lucide-react';

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
                </DialogHeader>

                <div className='space-y-3 py-2'>
                    <div className='rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4'>
                        <p className='text-sm font-medium text-white'>GPT Image Playground</p>
                        <p className='mt-1 text-xs leading-5 text-white/45'>
                            用于 OpenAI GPT 图像模型生成、编辑、历史管理和提示词模板管理的本地工作台。
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
