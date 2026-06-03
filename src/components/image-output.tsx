'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { LocalizedMessage } from '@/components/localized-message';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { WorkbenchCard } from '@/components/ui/workbench-card';
import { ZoomViewer } from '@/components/zoom-viewer';
import { cn } from '@/lib/utils';
import { ImageIcon, Send, Grid, Maximize2 } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

type ImageInfo = {
    path: string;
    filename: string;
    size?: number;
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
    const { t } = useAppLanguage();
    const [zoomOpen, setZoomOpen] = React.useState(false);
    const [zoomSrc, setZoomSrc] = React.useState<string | null>(null);
    const [zoomIndex, setZoomIndex] = React.useState(0);

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
        const interval = window.setInterval(tick, 99);
        return () => window.clearInterval(interval);
    }, [isLoading, taskStartedAt]);

    const formatMs = (ms: number) => {
        const s = Math.floor(ms / 1000);
        const frac = Math.floor((ms % 1000) / 10);
        return `${s}.${frac.toString().padStart(2, '0')}s`;
    };

    const openZoom = React.useCallback((src: string, index?: number) => {
        setZoomSrc(src);
        setZoomIndex(index ?? 0);
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

    const handleZoomSendToEdit = React.useCallback(() => {
        if (imageBatch && imageBatch[zoomIndex]) {
            onSendToEdit(imageBatch[zoomIndex].filename);
        }
    }, [imageBatch, zoomIndex, onSendToEdit]);

    const showCarousel = imageBatch && imageBatch.length > 1;
    const isSingleImageView = typeof viewMode === 'number';
    const canSendToEdit = !isLoading && isSingleImageView && imageBatch && imageBatch[viewMode];

    return (
        <WorkbenchCard className='min-h-[300px] items-center justify-between'>
            <div className='relative flex h-full w-full flex-grow flex-col overflow-hidden'>
                <div className='bg-panel-ghost m-4 flex-1 overflow-hidden rounded-xl'>
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
                                <div className='text-on-panel-muted absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1.5'>
                                    <Spinner size='md' />
                                    <p className='text-sm'>
                                        <LocalizedMessage id='phase4b.streamingPreview' />
                                    </p>
                                    <p
                                        className='text-on-panel-muted font-mono text-xs tabular-nums'
                                        data-i18n-skip='true'>
                                        {formatMs(elapsedMs)}
                                    </p>
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
                                <div className='text-on-panel-muted absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50'>
                                    <Spinner size='2xl' />
                                    <p>
                                        <LocalizedMessage id='phase4b.editingImage' />
                                    </p>
                                    <p className='text-on-panel-muted font-mono text-xs tabular-nums'>
                                        {formatMs(elapsedMs)}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className='text-on-panel-muted flex h-full w-full flex-col items-center justify-center gap-1'>
                                <Spinner size='2xl' />
                                <p>
                                    <LocalizedMessage id='phase4b.generatingImage' />
                                </p>
                                <p className='text-on-panel-faint font-mono text-xs tabular-nums'>
                                    {formatMs(elapsedMs)}
                                </p>
                            </div>
                        )
                    ) : imageBatch && imageBatch.length > 0 ? (
                        viewMode === 'grid' ? (
                            <div className='h-full max-h-full overflow-auto p-2'>
                                <div
                                    className='grid gap-1'
                                    style={{
                                        gridTemplateColumns: `repeat(${Math.min(imageBatch.length, 3)}, minmax(0, 1fr))`
                                    }}>
                                    {imageBatch.map((img, index) => (
                                        <div
                                            key={img.filename}
                                            className='group border-panel-divider bg-panel-ghost hover:border-panel-divider relative aspect-square cursor-pointer overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/5'
                                            onClick={() => openZoom(img.path, index)}>
                                            <Image
                                                src={img.path}
                                                alt={`Generated image ${index + 1}`}
                                                fill
                                                style={{ objectFit: 'contain' }}
                                                sizes='(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw'
                                                unoptimized
                                            />
                                            <div className='absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100'>
                                                <Maximize2 className='text-on-panel-muted h-8 w-8' />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : imageBatch[viewMode] ? (
                            <div className='group relative flex h-full w-full items-center justify-center'>
                                <Image
                                    src={imageBatch[viewMode].path}
                                    alt={altText}
                                    fill
                                    style={{ objectFit: 'contain' }}
                                    sizes='(max-width: 1200px) 70vw, 60vw'
                                    className='cursor-pointer transition-all duration-200 hover:shadow-2xl hover:shadow-violet-500/5'
                                    onClick={() => openZoom(imageBatch[viewMode].path, viewMode)}
                                    unoptimized
                                />
                                <div className='bg-accent hover:bg-accent absolute top-3 right-3 z-10 flex cursor-pointer items-center justify-center rounded-lg p-1.5 opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:opacity-100'>
                                    <Maximize2 className='text-on-panel-muted h-4 w-4' />
                                </div>
                            </div>
                        ) : (
                            <div className='text-on-panel-faint flex h-full items-center justify-center text-center'>
                                <p>
                                    <LocalizedMessage id='phase4b.imageDisplayFailed' />
                                </p>
                            </div>
                        )
                    ) : (
                        <EmptyState
                            icon={<ImageIcon />}
                            description={<LocalizedMessage id='phase4b.generatedImagesWillAppearHere' />}
                            className='h-full min-h-[220px]'
                        />
                    )}
                </div>
            </div>

            <div className='flex h-10 w-full shrink-0 items-center justify-center gap-4 px-2 pb-2'>
                {showCarousel && (
                    <div className='border-panel-divider bg-panel-ghost flex items-center gap-1.5 rounded-xl border p-1 backdrop-blur-sm'>
                        <Button
                            variant='ghost'
                            size='icon'
                            className={cn(
                                'h-8 w-8 rounded p-1',
                                viewMode === 'grid'
                                    ? 'bg-accent text-foreground'
                                    : 'text-on-panel-muted hover:bg-accent hover:text-on-panel-muted'
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
                                aria-label={t('phase4b.viewImage', { index: index + 1 })}>
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
                        'border-panel-divider text-on-panel-muted hover:text-foreground shrink-0 rounded-xl px-3 whitespace-nowrap transition-all duration-200 hover:border-violet-500/30 hover:bg-gradient-to-r hover:from-violet-600/20 hover:to-indigo-600/20 disabled:pointer-events-none disabled:opacity-30',
                        showCarousel && viewMode === 'grid' ? 'invisible' : 'visible'
                    )}>
                    <Send className='mr-2 h-4 w-4' />
                    <LocalizedMessage id='common.edit' />
                </Button>
            </div>

            <ZoomViewer
                src={zoomSrc}
                open={zoomOpen}
                onClose={() => {
                    setZoomOpen(false);
                    setZoomSrc(null);
                }}
                onSendToEdit={imageBatch ? handleZoomSendToEdit : undefined}
                images={imageBatch?.map((img) => ({ src: img.path, filename: img.filename, sizeBytes: img.size }))}
                currentIndex={zoomIndex}
                onNavigate={(nextIndex) => {
                    setZoomIndex(nextIndex);
                    if (imageBatch && imageBatch[nextIndex]) {
                        setZoomSrc(imageBatch[nextIndex].path);
                    }
                }}
            />
        </WorkbenchCard>
    );
}
