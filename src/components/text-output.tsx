'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ImageToTextStructuredResult } from '@/lib/vision-text-types';
import { Check, Clipboard, FileText, Loader2, Plus, Replace, Send } from 'lucide-react';
import * as React from 'react';

type TextOutputProps = {
    text: string;
    structured?: ImageToTextStructuredResult | null;
    isLoading: boolean;
    taskStartedAt?: number;
    onSendToGenerator: (prompt: string) => void;
    onReplacePrompt: (prompt: string) => void;
    onAppendPrompt: (prompt: string) => void;
};

function formatMs(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const fraction = Math.floor((ms % 1000) / 10);
    return `${seconds}.${fraction.toString().padStart(2, '0')}s`;
}

function getReusablePrompt(text: string, structured?: ImageToTextStructuredResult | null): string {
    const prompt = structured?.prompt?.trim();
    return prompt || text.trim();
}

export function TextOutput({
    text,
    structured,
    isLoading,
    taskStartedAt,
    onSendToGenerator,
    onReplacePrompt,
    onAppendPrompt
}: TextOutputProps) {
    const initialElapsed = taskStartedAt ? Date.now() - taskStartedAt : 0;
    const [elapsedMs, setElapsedMs] = React.useState(isLoading ? initialElapsed : 0);
    const [copied, setCopied] = React.useState(false);
    const reusablePrompt = getReusablePrompt(text, structured);
    const hasText = text.trim().length > 0;

    React.useEffect(() => {
        if (!isLoading) {
            setElapsedMs(0);
            return;
        }

        const tick = () => {
            const start = taskStartedAt || Date.now();
            setElapsedMs(Date.now() - start);
        };
        tick();
        const interval = window.setInterval(tick, 250);
        return () => window.clearInterval(interval);
    }, [isLoading, taskStartedAt]);

    const copyText = React.useCallback(async () => {
        if (!hasText) return;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
    }, [hasText, text]);

    return (
        <div className='app-panel-card flex h-full w-full min-h-[300px] flex-col overflow-hidden rounded-2xl border backdrop-blur-xl'>
            <div className='flex min-h-0 flex-1 flex-col overflow-hidden p-4'>
                <div className='mb-3 flex shrink-0 items-center justify-between gap-3'>
                    <div className='flex min-w-0 items-center gap-2'>
                        <FileText className='h-4 w-4 shrink-0 text-violet-200/80' aria-hidden='true' />
                        <span className='truncate text-sm font-medium text-white/75'>
                            图生文结果
                        </span>
                    </div>
                    {isLoading && (
                        <span className='flex items-center gap-2 font-mono text-xs text-white/40 tabular-nums'>
                            <Loader2 className='h-3.5 w-3.5 animate-spin' aria-hidden='true' />
                            {formatMs(elapsedMs)}
                        </span>
                    )}
                </div>

                <div className='min-h-0 flex-1 overflow-auto rounded-xl border border-white/[0.06] bg-white/[0.03] p-4'>
                    {hasText ? (
                        <pre className='whitespace-pre-wrap break-words text-sm leading-6 text-white/82'>{text}</pre>
                    ) : isLoading ? (
                        <div className='flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-white/55'>
                            <Loader2 className='h-7 w-7 animate-spin' />
                            <p>生成文本中...</p>
                        </div>
                    ) : (
                        <div className='flex h-full min-h-[220px] items-center justify-center text-center text-white/40'>
                            <p>图生文结果将显示在这里。</p>
                        </div>
                    )}
                </div>

                {structured && (
                    <div className='mt-3 grid shrink-0 gap-2 text-xs sm:grid-cols-2'>
                        {structured.summary && (
                            <div className='rounded-xl border border-white/[0.06] bg-white/[0.025] p-3'>
                                <p className='mb-1 font-medium text-white/65'>简述</p>
                                <p className='line-clamp-3 text-white/45'>{structured.summary}</p>
                            </div>
                        )}
                        {structured.negativePrompt && (
                            <div className='rounded-xl border border-white/[0.06] bg-white/[0.025] p-3'>
                                <p className='mb-1 font-medium text-white/65'>负向提示词</p>
                                <p className='line-clamp-3 text-white/45'>{structured.negativePrompt}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className='flex min-h-12 shrink-0 flex-wrap items-center justify-center gap-2 border-t border-white/[0.06] px-3 py-2'>
                <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={copyText}
                    disabled={!hasText}
                    className='rounded-xl border-white/[0.08] px-3 text-white/65 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30'>
                    {copied ? <Check className='mr-2 h-4 w-4' /> : <Clipboard className='mr-2 h-4 w-4' />}
                    {copied ? '已复制' : '复制'}
                </Button>
                <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => onReplacePrompt(reusablePrompt)}
                    disabled={!reusablePrompt}
                    className='rounded-xl border-white/[0.08] px-3 text-white/65 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30'>
                    <Replace className='mr-2 h-4 w-4' />
                    替换
                </Button>
                <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => onAppendPrompt(reusablePrompt)}
                    disabled={!reusablePrompt}
                    className='rounded-xl border-white/[0.08] px-3 text-white/65 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30'>
                    <Plus className='mr-2 h-4 w-4' />
                    追加
                </Button>
                <Button
                    type='button'
                    size='sm'
                    onClick={() => onSendToGenerator(reusablePrompt)}
                    disabled={!reusablePrompt}
                    className={cn(
                        'rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-white shadow-violet-600/20 hover:brightness-110 disabled:pointer-events-none disabled:opacity-30'
                    )}>
                    <Send className='mr-2 h-4 w-4' />
                    发送到生成器
                </Button>
            </div>
        </div>
    );
}
