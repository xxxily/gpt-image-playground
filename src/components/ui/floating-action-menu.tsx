'use client';

import { Button } from '@/components/ui/button';
import { sortFeatureMenuItems, type FeatureMenuItem } from '@/lib/feature-menu-registry';
import { cn } from '@/lib/utils';
import { ChevronRight, Grip, RotateCcw, Sparkles, X } from 'lucide-react';
import * as React from 'react';

const MENU_POSITION_STORAGE_KEY = 'gpt-image-playground-floating-feature-menu-position-v1';
const BUTTON_SIZE = 56;
const EDGE_GAP = 16;
const MENU_PANEL_WIDTH = 304;
const FLYOUT_PANEL_WIDTH = 288;
const FLYOUT_GAP = 8;

type FloatingMenuPosition = {
    xRatio: number;
    yRatio: number;
};

type FloatingActionMenuProps = {
    items: FeatureMenuItem[];
    label: string;
    resetLabel: string;
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

export function FloatingActionMenu({
    items,
    label,
    resetLabel,
    className,
    rightBoundaryPx,
    renderLabel,
    renderDescription
}: FloatingActionMenuProps) {
    const sortedItems = React.useMemo(() => sortFeatureMenuItems(items), [items]);
    const [open, setOpen] = React.useState(false);
    const [position, setPosition] = React.useState({ x: -9999, y: -9999 });
    const [mounted, setMounted] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const hoverCloseTimeoutRef = React.useRef<number | null>(null);
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

    React.useEffect(
        () => () => {
            if (hoverCloseTimeoutRef.current !== null) {
                window.clearTimeout(hoverCloseTimeoutRef.current);
            }
        },
        []
    );

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

    const viewport = getViewport();
    const rightBoundary = getRightBoundary(rightBoundaryPx);
    const panelOnLeft = mounted && position.x > rightBoundary / 2;
    const panelAbove = mounted && position.y > viewport.height / 2;
    const panelWidth = Math.min(MENU_PANEL_WIDTH, Math.max(0, viewport.width - EDGE_GAP * 2));
    const flyoutWidth = Math.min(FLYOUT_PANEL_WIDTH, Math.max(0, viewport.width - EDGE_GAP * 2));
    const panelLeft = panelOnLeft
        ? viewport.width -
          Math.max(EDGE_GAP, viewport.width - position.x - BUTTON_SIZE, viewport.width - rightBoundary + EDGE_GAP) -
          panelWidth
        : clamp(position.x, EDGE_GAP, Math.max(EDGE_GAP, rightBoundary - panelWidth - EDGE_GAP));
    const panelRight = panelLeft + panelWidth;
    const rightFlyoutSpace = Math.min(rightBoundary, viewport.width) - EDGE_GAP - panelRight - FLYOUT_GAP;
    const leftFlyoutSpace = panelLeft - EDGE_GAP - FLYOUT_GAP;
    const flyoutOnLeft = mounted && rightFlyoutSpace < flyoutWidth && leftFlyoutSpace > rightFlyoutSpace;

    const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        if (hoverCloseTimeoutRef.current !== null) {
            window.clearTimeout(hoverCloseTimeoutRef.current);
            hoverCloseTimeoutRef.current = null;
        }
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
        if (event.pointerType === 'mouse') {
            setOpen(true);
            return;
        }
        setOpen((current) => !current);
    }, [rightBoundaryPx]);

    const handleRootPointerEnter = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== 'mouse') return;
        if (hoverCloseTimeoutRef.current !== null) {
            window.clearTimeout(hoverCloseTimeoutRef.current);
            hoverCloseTimeoutRef.current = null;
        }
        if (!dragStateRef.current) setOpen(true);
    }, []);

    const handleRootPointerLeave = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== 'mouse') return;
        if (hoverCloseTimeoutRef.current !== null) {
            window.clearTimeout(hoverCloseTimeoutRef.current);
        }
        hoverCloseTimeoutRef.current = window.setTimeout(() => {
            hoverCloseTimeoutRef.current = null;
            if (!dragStateRef.current) setOpen(false);
        }, 160);
    }, []);

    const handleButtonKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setOpen((current) => !current);
    }, []);

    const handleReset = React.useCallback(() => {
        clearStoredPosition();
        setPosition(defaultPixelPosition(rightBoundaryPx));
    }, [rightBoundaryPx]);

    const handleItemSelect = React.useCallback((item: FeatureMenuItem) => {
        if (item.disabled) return;
        if (item.onSelect) {
            item.onSelect(item.surface ?? item.defaultSurface ?? 'default');
            setOpen(false);
            return;
        }
    }, []);

    const renderMenuItems = React.useCallback(
        (menuItems: FeatureMenuItem[], depth = 0): React.ReactNode =>
            menuItems.map((item) => {
                const Icon = item.icon;
                const description = item.descriptionKey ? renderDescription?.(item.descriptionKey) : null;
                const hasChildren = Boolean(item.children?.length);
                const isActionable = Boolean(item.onSelect);
                const itemBody = (
                    <>
                        <span className='bg-primary/5 text-primary/80 dark:bg-primary/10 dark:text-primary group-hover/item:bg-primary group-hover/item:text-primary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 group-hover/item:scale-105'>
                            {Icon ? <Icon className='h-4.5 w-4.5' /> : <Sparkles className='h-4.5 w-4.5' />}
                        </span>
                        <span className='flex min-w-0 flex-1 flex-col justify-center text-left'>
                            <span className='text-foreground/90 group-hover/item:text-foreground block truncate text-sm font-semibold transition-colors'>
                                {renderLabel(item.labelKey)}
                            </span>
                            {description && (
                                <span className='text-muted-foreground/70 group-hover/item:text-muted-foreground mt-0.5 block truncate text-xs font-normal transition-colors'>
                                    {description}
                                </span>
                            )}
                        </span>
                        {item.badge !== undefined && (
                            <span className='bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase'>
                                {item.badge}
                            </span>
                        )}
                        {hasChildren && (
                            <ChevronRight
                                className={cn(
                                    'text-muted-foreground/60 group-hover/item:text-foreground h-4 w-4 shrink-0 transition-transform',
                                    flyoutOnLeft ? 'group-hover/item:-translate-x-0.5 rotate-180' : 'group-hover/item:translate-x-0.5'
                                )}
                            />
                        )}
                    </>
                );

                return (
                    <React.Fragment key={item.id}>
                        {item.separatorBefore && <div className='border-border/60 my-1 border-t' />}
                        <div className='group/flyout relative'>
                            <button
                                type='button'
                                disabled={item.disabled || !isActionable}
                                aria-haspopup={hasChildren ? 'menu' : undefined}
                                className='group/item hover:bg-accent/45 focus:bg-accent/45 flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left outline-none transition-colors disabled:cursor-default disabled:opacity-75'
                                onClick={() => handleItemSelect(item)}>
                                {itemBody}
                            </button>
                            {hasChildren && (
                                <div
                                    role='menu'
                                    className={cn(
                                        'border-border/40 bg-popover/95 text-popover-foreground invisible absolute top-0 z-[90] w-[min(18rem,calc(100vw-2rem))] rounded-2xl border p-2 opacity-0 shadow-[0_18px_45px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-[opacity,visibility,transform] duration-150 group-hover/flyout:visible group-hover/flyout:translate-x-0 group-hover/flyout:opacity-100 group-focus-within/flyout:visible group-focus-within/flyout:translate-x-0 group-focus-within/flyout:opacity-100 dark:shadow-[0_18px_45px_rgba(0,0,0,0.32)]',
                                        flyoutOnLeft
                                            ? 'right-full mr-2 translate-x-1'
                                            : 'left-full ml-2 -translate-x-1',
                                        depth > 0 && 'top-[-0.5rem]'
                                    )}>
                                    {renderMenuItems(item.children ?? [], depth + 1)}
                                </div>
                            )}
                        </div>
                    </React.Fragment>
                );
            }),
        [flyoutOnLeft, handleItemSelect, renderDescription, renderLabel]
    );

    React.useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (rootRef.current?.contains(target)) return;
            setOpen(false);
        };
        const handleFocusIn = (event: FocusEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (rootRef.current?.contains(target)) return;
            setOpen(false);
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
            onPointerEnter={handleRootPointerEnter}
            onPointerLeave={handleRootPointerLeave}
            style={{ left: position.x, top: position.y, visibility: mounted ? 'visible' : 'hidden' }}>
            {open && (
                <div
                    className={cn(
                        'border-border/30 bg-popover/75 text-popover-foreground fixed z-[79] w-[min(19rem,calc(100vw-2rem))] overflow-visible rounded-2xl border shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-xl transition-all duration-300 ease-in-out dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)]',
                        panelAbove ? 'origin-bottom' : 'origin-top'
                    )}
                    style={{
                        left: panelOnLeft
                            ? undefined
                            : clamp(position.x, EDGE_GAP, Math.max(EDGE_GAP, rightBoundary - MENU_PANEL_WIDTH - EDGE_GAP)),
                        right: panelOnLeft
                            ? Math.max(EDGE_GAP, viewport.width - position.x - BUTTON_SIZE, viewport.width - rightBoundary + EDGE_GAP)
                            : undefined,
                        top: panelAbove ? undefined : Math.min(position.y + BUTTON_SIZE + 8, viewport.height - 320),
                        bottom: panelAbove ? Math.max(EDGE_GAP, viewport.height - position.y + 8) : undefined
                    }}>
                    <div className='px-3.5 pt-3.5 pb-2'>
                        <p className='text-muted-foreground/60 truncate px-0.5 text-[11px] font-bold tracking-wider uppercase'>
                            {label}
                        </p>
                    </div>
                    <div className='flex flex-col gap-1 px-2 py-1'>
                        {renderMenuItems(sortedItems)}
                    </div>
                    <div className='bg-muted/30 flex items-center justify-between rounded-b-2xl px-3.5 py-2.5 transition-colors dark:bg-muted/10'>
                        <span className='text-muted-foreground/50 flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase'>
                            <Grip className='h-3.5 w-3.5' />
                            {label}
                        </span>
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            className='text-muted-foreground/80 hover:text-foreground hover:bg-background/50 h-6 gap-1 rounded-md px-2 text-[10px] font-semibold transition-all duration-200'
                            onClick={handleReset}>
                            <RotateCcw className='h-3 w-3' />
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
                onKeyDown={handleButtonKeyDown}
                className='border-border/30 bg-gradient-to-tr from-primary via-primary/95 to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 flex h-14 w-14 touch-none items-center justify-center rounded-full border transition-all duration-300 hover:scale-105 active:scale-95 focus:ring-2 focus:ring-primary/20 focus:outline-none'>
                <div className='relative h-5 w-5 flex items-center justify-center'>
                    <Sparkles className={cn(
                        'h-5 w-5 absolute transition-all duration-300 ease-out',
                        open ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'
                    )} />
                    <X className={cn(
                        'h-5 w-5 absolute transition-all duration-300 ease-out',
                        open ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0'
                    )} />
                </div>
            </button>
        </div>
    );
}
