'use client';

import { Button } from '@/components/ui/button';
import { Loader2, Send, Grid, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ZoomViewer } from '@/components/zoom-viewer';
import Image from 'next/image';
import * as React from 'react';

type ImageInfo = {
    path: string;
    filename: string;
};

type ImageOutputProps = {
    imageBatch: ImageInfo[] | null;
    viewMode: 'grid' | number;
    onViewChange: (view: 'grid' | number) => void;
    altText?: string;
    isLoading: boolean;
    taskStartedAt?: number;
    onSendToEdit: (filename: string) => void;
    currentMode: 'generate' | 'edit';
    baseImagePreviewUrl: string | null;
    streamingPreviewImages?: Map<number, string>;
};

export function ImageOutput({
    imageBatch,
    viewMode,
    onViewChange,
    altText = 'Generated image output',
    isLoading,
    taskStartedAt,
    onSendToEdit,
    currentMode,
    baseImagePreviewUrl,
    streamingPreviewImages
}: ImageOutputProps) {
    const [zoomOpen, setZoomOpen] = React.useState(false);
    const [zoomSrc, setZoomSrc] = React.useState<string | null>(null);

    const initialElapsed = taskStartedAt ? Date.now() - taskStartedAt : 0;
    const [elapsedMs, setElapsedMs] = React.useState(isLoading ? initialElapsed : 0);

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

    const formatMs = (ms: number) => {
        const s = Math.floor(ms / 1000);
        const frac = Math.floor((ms % 1000) / 10);
        return `${s}.${frac.toString().padStart(2, '0')}s`;
    };

    const openZoom = React.useCallback((src: string) => {
        setZoomSrc(src);
        setZoomOpen(true);
    }, []);

    const imageBatchSignature = React.useMemo(
        () => imageBatch?.map((img) => `${img.filename}:${img.path}`).join('|') ?? '',
        [imageBatch]
    );

    React.useEffect(() => {
        setZoomOpen(false);
        setZoomSrc(null);
    }, [imageBatchSignature]);

    const handleSendClick = () => {
        if (typeof viewMode === 'number' && imageBatch && imageBatch[viewMode]) {
            onSendToEdit(imageBatch[viewMode].filename);
        }
    };

    const showCarousel = imageBatch && imageBatch.length > 1;
    const isSingleImageView = typeof viewMode === 'number';
    const canSendToEdit = !isLoading && isSingleImageView && imageBatch && imageBatch[viewMode];

    return (
        <div className='app-panel-card flex h-full w-full min-h-[300px] flex-col items-center justify-between overflow-hidden rounded-2xl border backdrop-blur-xl'>
            <div className='relative flex h-full w-full flex-grow flex-col overflow-hidden'>
                <div className='m-4 flex-1 overflow-hidden rounded-xl bg-white/[0.01]'>
                    {isLoading ? (
                        streamingPreviewImages && streamingPreviewImages.size > 0 ? (
                            <div className='relative flex h-full w-full items-center justify-center'>
                                {(() => {
                                    const entries = Array.from(streamingPreviewImages.entries());
                                    const latestEntry = entries[entries.length - 1];
                                    if (!latestEntry) return null;
                                    const [, dataUrl] = latestEntry;
                                    return (
                                        <Image
                                            src={dataUrl}
                                            alt='Streaming preview'
                                            width={512}
                                            height={512}
                                            className='max-h-full max-w-full object-contain'
                                            unoptimized
                                        />
                                    );
                                })()}
                                <div className='absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-white/80'>
                                    <Loader2 className='h-4 w-4 animate-spin' />
                                    <p className='text-sm'>流式预览中...</p>
                                </div>
                            </div>
                        ) : currentMode === 'edit' && baseImagePreviewUrl ? (
                            <div className='relative flex h-full w-full items-center justify-center'>
                                <Image
                                    src={baseImagePreviewUrl}
                                    alt='Base image for editing'
                                    fill
                                    style={{ objectFit: 'contain' }}
                                    className='blur-md filter'
                                    unoptimized
                                />
                                <div className='absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 text-white/80'>
                                    <Loader2 className='h-8 w-8 animate-spin' />
                                    <p>编辑图片中...</p>
                                    <p className='font-mono text-xs text-white/50 tabular-nums'>{formatMs(elapsedMs)}</p>
                                </div>
                            </div>
                        ) : (
                            <div className='flex h-full w-full flex-col items-center justify-center gap-1 text-white/60'>
                                <Loader2 className='h-8 w-8 animate-spin' />
                                <p>生成图片中...</p>
                                <p className='font-mono text-xs text-white/40 tabular-nums'>{formatMs(elapsedMs)}</p>
                            </div>
                        )
                    ) : imageBatch && imageBatch.length > 0 ? (
                        viewMode === 'grid' ? (
                            <div className='max-h-full h-full overflow-auto p-2'>
                                <div className='grid gap-1' style={{ gridTemplateColumns: `repeat(${Math.min(imageBatch.length, 3)}, minmax(0, 1fr))` }}>
                                    {imageBatch.map((img, index) => (
                                        <div
                                            key={img.filename}
                                            className='group relative aspect-square overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] cursor-pointer transition-all duration-200 hover:border-white/[0.12] hover:shadow-lg hover:shadow-violet-500/5'
                                            onClick={() => openZoom(img.path)}>
                                            <Image
                                                src={img.path}
                                                alt={`Generated image ${index + 1}`}
                                                fill
                                                style={{ objectFit: 'contain' }}
                                                sizes='(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw'
                                                unoptimized
                                            />
                                            <div className='absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100'>
                                                <Maximize2 className='h-8 w-8 text-white/80' />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : imageBatch[viewMode] ? (
                            <div className='relative h-full w-full flex items-center justify-center group'>
                                <Image
                                    src={imageBatch[viewMode].path}
                                    alt={altText}
                                    fill
                                    style={{ objectFit: 'contain' }}
                                    sizes='(max-width: 1200px) 70vw, 60vw'
                                    className='cursor-pointer transition-all duration-200 hover:shadow-2xl hover:shadow-violet-500/5'
                                    onClick={() => openZoom(imageBatch[viewMode].path)}
                                    unoptimized
                                />
                                <div className='absolute top-3 right-3 flex items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm p-1.5 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-white/20 cursor-pointer z-10'>
                                    <Maximize2 className='h-4 w-4 text-white/80' />
                                </div>
                            </div>
                        ) : (
                            <div className='flex h-full items-center justify-center text-center text-white/40'>
                                <p>图片显示异常。</p>
                            </div>
                        )
                    ) : (
                        <div className='flex h-full items-center justify-center text-center text-white/40'>
                            <p>生成的图片将显示在这里。</p>
                        </div>
                    )}
                </div>
            </div>

            <div className='flex h-10 w-full shrink-0 items-center justify-center gap-4 px-2 pb-2'>
                {showCarousel && (
                    <div className='flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-1'>
                        <Button
                            variant='ghost'
                            size='icon'
                            className={cn(
                                'h-8 w-8 rounded p-1',
                                viewMode === 'grid'
                                    ? 'bg-white/20 text-white'
                                    : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                            )}
                            onClick={() => onViewChange('grid')}
                            aria-label='Grid view'>
                            <Grid className='h-4 w-4' />
                        </Button>
                        {imageBatch.map((img, index) => (
                            <Button
                                key={img.filename}
                                variant='ghost'
                                size='icon'
                                className={cn(
                                    'h-8 w-8 overflow-hidden rounded p-0.5',
                                    viewMode === index
                                        ? 'ring-2 ring-white ring-offset-1 ring-offset-black'
                                        : 'opacity-60 hover:opacity-100'
                                )}
                                onClick={() => onViewChange(index)}
                                aria-label={`查看图片 ${index + 1}`}>
                                <Image
                                    src={img.path}
                                    alt={`Thumbnail ${index + 1}`}
                                    width={28}
                                    height={28}
                                    className='h-full w-full object-cover'
                                    unoptimized
                                />
                            </Button>
                        ))}
                    </div>
                )}

                <Button
                    variant='outline'
                    size='sm'
                    onClick={handleSendClick}
                    disabled={!canSendToEdit}
                    className={cn(
                        'shrink-0 whitespace-nowrap rounded-xl border-white/[0.08] px-3 text-white/60 hover:bg-gradient-to-r hover:from-violet-600/20 hover:to-indigo-600/20 hover:border-violet-500/30 hover:text-white transition-all duration-200 disabled:pointer-events-none disabled:opacity-30',
                        showCarousel && viewMode === 'grid' ? 'invisible' : 'visible'
                    )}>
                    <Send className='mr-2 h-4 w-4' />
                    编辑
                </Button>
            </div>

            <ZoomViewer src={zoomSrc} open={zoomOpen} onClose={() => { setZoomOpen(false); setZoomSrc(null); }} />
        </div>
    );
}
