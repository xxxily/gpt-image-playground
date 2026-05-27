'use client';

import { Button } from '@/components/ui/button';
import { sortFeatureMenuItems, type FeatureMenuItem } from '@/lib/feature-menu-registry';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Grip, RotateCcw, Sparkles } from 'lucide-react';
import * as React from 'react';

const MENU_POSITION_STORAGE_KEY = 'gpt-image-playground-floating-feature-menu-position-v1';
const BUTTON_SIZE = 56;
const EDGE_GAP = 16;

type FloatingMenuPosition = {
    xRatio: number;
    yRatio: number;
};

type FloatingActionMenuProps = {
    items: FeatureMenuItem[];
    label: string;
    resetLabel: string;
    backLabel: string;
    className?: string;
    rightBoundaryPx?: number;
    renderLabel: (key: string) => string;
    renderDescription?: (key: string) => string;
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function getViewport() {
    if (typeof window === 'undefined') return { width: 1024, height: 768 };
    return { width: window.innerWidth, height: window.innerHeight };
}

function getRightBoundary(rightBoundaryPx?: number) {
    const viewport = getViewport();
    if (typeof rightBoundaryPx !== 'number' || !Number.isFinite(rightBoundaryPx)) return viewport.width;
    return clamp(rightBoundaryPx, EDGE_GAP + BUTTON_SIZE, viewport.width);
}

function clampMenuX(x: number, rightBoundaryPx?: number) {
    const rightBoundary = getRightBoundary(rightBoundaryPx);
    return clamp(x, EDGE_GAP, Math.max(EDGE_GAP, rightBoundary - BUTTON_SIZE - EDGE_GAP));
}

function defaultPixelPosition(rightBoundaryPx?: number) {
    const viewport = getViewport();
    return {
        x: clampMenuX(getRightBoundary(rightBoundaryPx) - BUTTON_SIZE - EDGE_GAP, rightBoundaryPx),
        y: Math.max(EDGE_GAP, viewport.height - BUTTON_SIZE - EDGE_GAP)
    };
}

function normalizePixelPosition(x: number, y: number, rightBoundaryPx?: number): FloatingMenuPosition {
    const viewport = getViewport();
    const rightBoundary = getRightBoundary(rightBoundaryPx);
    return {
        xRatio: rightBoundary > BUTTON_SIZE ? clamp(x / (rightBoundary - BUTTON_SIZE), 0, 1) : 1,
        yRatio: viewport.height > BUTTON_SIZE ? clamp(y / (viewport.height - BUTTON_SIZE), 0, 1) : 1
    };
}

function denormalizePosition(position: FloatingMenuPosition | null, rightBoundaryPx?: number) {
    const viewport = getViewport();
    const rightBoundary = getRightBoundary(rightBoundaryPx);
    if (!position) return defaultPixelPosition(rightBoundaryPx);
    return {
        x: clampMenuX(position.xRatio * Math.max(1, rightBoundary - BUTTON_SIZE), rightBoundaryPx),
        y: clamp(position.yRatio * Math.max(1, viewport.height - BUTTON_SIZE), EDGE_GAP, viewport.height - BUTTON_SIZE - EDGE_GAP)
    };
}

function loadStoredPosition(): FloatingMenuPosition | null {
    if (typeof window === 'undefined') return null;
    try {
        const stored = window.localStorage.getItem(MENU_POSITION_STORAGE_KEY);
        const parsed: unknown = stored ? JSON.parse(stored) : null;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
        const record = parsed as Record<string, unknown>;
        if (typeof record.xRatio !== 'number' || typeof record.yRatio !== 'number') return null;
        return {
            xRatio: clamp(record.xRatio, 0, 1),
            yRatio: clamp(record.yRatio, 0, 1)
        };
    } catch {
        return null;
    }
}

function saveStoredPosition(position: FloatingMenuPosition): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MENU_POSITION_STORAGE_KEY, JSON.stringify(position));
}

function clearStoredPosition(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(MENU_POSITION_STORAGE_KEY);
}

function findItem(items: readonly FeatureMenuItem[], id: string): FeatureMenuItem | null {
    for (const item of items) {
        if (item.id === id) return item;
        const child = item.children ? findItem(item.children, id) : null;
        if (child) return child;
    }
    return null;
}

export function FloatingActionMenu({
    items,
    label,
    resetLabel,
    backLabel,
    className,
    rightBoundaryPx,
    renderLabel,
    renderDescription
}: FloatingActionMenuProps) {
    const sortedItems = React.useMemo(() => sortFeatureMenuItems(items), [items]);
    const [open, setOpen] = React.useState(false);
    const [path, setPath] = React.useState<string[]>([]);
    const [position, setPosition] = React.useState({ x: -9999, y: -9999 });
    const [mounted, setMounted] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const dragStateRef = React.useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        originX: number;
        originY: number;
        moved: boolean;
    } | null>(null);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    React.useEffect(() => {
        setPosition(denormalizePosition(loadStoredPosition(), rightBoundaryPx));
    }, [rightBoundaryPx]);

    React.useEffect(() => {
        const handleResize = () => {
            const stored = loadStoredPosition();
            const next = denormalizePosition(stored, rightBoundaryPx);
            setPosition(next);
            if (stored) saveStoredPosition(normalizePixelPosition(next.x, next.y, rightBoundaryPx));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [rightBoundaryPx]);

    const activeParent = path.length > 0 ? findItem(sortedItems, path[path.length - 1]) : null;
    const visibleItems = activeParent?.children ?? sortedItems;
    const title = activeParent ? renderLabel(activeParent.labelKey) : label;
    const viewport = getViewport();
    const rightBoundary = getRightBoundary(rightBoundaryPx);
    const panelOnLeft = mounted && position.x > rightBoundary / 2;
    const panelAbove = mounted && position.y > viewport.height / 2;

    const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: position.x,
            originY: position.y,
            moved: false
        };
    }, [position.x, position.y]);

    const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        const state = dragStateRef.current;
        if (!state || state.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - state.startX;
        const deltaY = event.clientY - state.startY;
        if (!state.moved && Math.hypot(deltaX, deltaY) < 5) return;
        state.moved = true;
        const viewportNow = getViewport();
        setPosition({
            x: clampMenuX(state.originX + deltaX, rightBoundaryPx),
            y: clamp(state.originY + deltaY, EDGE_GAP, viewportNow.height - BUTTON_SIZE - EDGE_GAP)
        });
    }, [rightBoundaryPx]);

    const handlePointerUp = React.useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        const state = dragStateRef.current;
        if (!state || state.pointerId !== event.pointerId) return;
        dragStateRef.current = null;
        if (state.moved) {
            const viewportNow = getViewport();
            const nextX = clampMenuX(state.originX + event.clientX - state.startX, rightBoundaryPx);
            const nextY = clamp(state.originY + event.clientY - state.startY, EDGE_GAP, viewportNow.height - BUTTON_SIZE - EDGE_GAP);
            const next = { x: nextX, y: nextY };
            setPosition(next);
            saveStoredPosition(normalizePixelPosition(next.x, next.y, rightBoundaryPx));
            return;
        }
        setOpen((current) => !current);
    }, [rightBoundaryPx]);

    const handleReset = React.useCallback(() => {
        clearStoredPosition();
        setPosition(defaultPixelPosition(rightBoundaryPx));
    }, [rightBoundaryPx]);

    const handleItemSelect = React.useCallback((item: FeatureMenuItem) => {
        if (item.disabled) return;
        if (item.children?.length) {
            if (item.onSelect) {
                item.onSelect(item.defaultSurface ?? 'default');
                setOpen(false);
                setPath([]);
                return;
            }
            setPath((current) => [...current, item.id]);
            return;
        }
        item.onSelect?.(item.surface ?? item.defaultSurface ?? 'default');
        setOpen(false);
        setPath([]);
    }, []);

    React.useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
                setPath([]);
            }
        };
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (rootRef.current?.contains(target)) return;
            setOpen(false);
            setPath([]);
        };
        const handleFocusIn = (event: FocusEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (rootRef.current?.contains(target)) return;
            setOpen(false);
            setPath([]);
        };
        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('pointerdown', handlePointerDown, { capture: true });
        document.addEventListener('focusin', handleFocusIn);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
            document.removeEventListener('focusin', handleFocusIn);
        };
    }, [open]);

    return (
        <div
            ref={rootRef}
            className={cn('app-theme-scope fixed z-[80]', className)}
            style={{ left: position.x, top: position.y, visibility: mounted ? 'visible' : 'hidden' }}>
            {open && (
                <div
                    className={cn(
                        'border-border bg-popover text-popover-foreground fixed z-[79] w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border shadow-2xl',
                        panelAbove ? 'origin-bottom' : 'origin-top'
                    )}
                    style={{
                        left: panelOnLeft ? undefined : clamp(position.x, EDGE_GAP, Math.max(EDGE_GAP, rightBoundary - 304)),
                        right: panelOnLeft
                            ? Math.max(EDGE_GAP, viewport.width - position.x - BUTTON_SIZE, viewport.width - rightBoundary + EDGE_GAP)
                            : undefined,
                        top: panelAbove ? undefined : Math.min(position.y + BUTTON_SIZE + 8, viewport.height - 320),
                        bottom: panelAbove ? Math.max(EDGE_GAP, viewport.height - position.y + 8) : undefined
                    }}>
                    <div className='border-border flex items-center gap-2 border-b px-2.5 py-2'>
                        {path.length > 0 && (
                            <Button
                                type='button'
                                variant='ghost'
                                size='icon'
                                className='h-7 w-7'
                                onClick={() => setPath((current) => current.slice(0, -1))}
                                aria-label={backLabel}>
                                <ChevronLeft className='h-4 w-4' />
                            </Button>
                        )}
                        <div className='min-w-0 flex-1'>
                            <p className='truncate text-sm font-semibold'>{title}</p>
                        </div>
                    </div>
                    <div className='max-h-[min(24rem,calc(100dvh-8rem))] overflow-y-auto p-1.5'>
                        {visibleItems.map((item) => {
                            const Icon = item.icon;
                            const description = item.descriptionKey ? renderDescription?.(item.descriptionKey) : null;
                            const itemBody = (
                                <>
                                    <span className='bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md'>
                                        {Icon ? <Icon className='h-4 w-4' /> : <Sparkles className='h-4 w-4' />}
                                    </span>
                                    <span className='min-w-0 flex-1'>
                                        <span className='block truncate font-medium'>{renderLabel(item.labelKey)}</span>
                                        {description && <span className='text-muted-foreground block truncate text-xs'>{description}</span>}
                                    </span>
                                    {item.badge !== undefined && (
                                        <span className='bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs font-medium'>
                                            {item.badge}
                                        </span>
                                    )}
                                </>
                            );

                            if (item.children?.length && item.onSelect) {
                                return (
                                    <div key={item.id} className='flex items-stretch rounded-lg'>
                                        <button
                                            type='button'
                                            disabled={item.disabled}
                                            className='hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex min-w-0 flex-1 items-center gap-2 rounded-l-lg px-2.5 py-2 text-left text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50'
                                            onClick={() => handleItemSelect(item)}>
                                            {itemBody}
                                        </button>
                                        <button
                                            type='button'
                                            disabled={item.disabled}
                                            className='hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground text-muted-foreground flex w-9 shrink-0 items-center justify-center rounded-r-lg outline-none disabled:cursor-not-allowed disabled:opacity-50'
                                            onClick={() => setPath((current) => [...current, item.id])}
                                            aria-label={renderLabel(item.labelKey)}>
                                            <ChevronRight className='h-4 w-4' />
                                        </button>
                                    </div>
                                );
                            }

                            return (
                                <button
                                    key={item.id}
                                    type='button'
                                    disabled={item.disabled}
                                    className='hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50'
                                    onClick={() => handleItemSelect(item)}>
                                    {itemBody}
                                    {item.children?.length ? <ChevronRight className='text-muted-foreground h-4 w-4 shrink-0' /> : null}
                                </button>
                            );
                        })}
                    </div>
                    <div className='border-border flex items-center justify-between border-t px-2.5 py-2'>
                        <span className='text-muted-foreground flex items-center gap-1 text-xs'>
                            <Grip className='h-3.5 w-3.5' />
                            {label}
                        </span>
                        <Button type='button' variant='ghost' size='sm' className='h-7 px-2 text-xs' onClick={handleReset}>
                            <RotateCcw className='h-3.5 w-3.5' />
                            {resetLabel}
                        </Button>
                    </div>
                </div>
            )}
            <button
                type='button'
                aria-label={label}
                aria-expanded={open}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className='border-border bg-primary text-primary-foreground shadow-foreground/20 flex h-14 w-14 touch-none items-center justify-center rounded-full border shadow-xl transition-transform hover:scale-[1.03] focus:ring-3 focus:ring-ring/50 focus:outline-none active:scale-95'>
                <Sparkles className='h-5 w-5' />
            </button>
        </div>
    );
}
