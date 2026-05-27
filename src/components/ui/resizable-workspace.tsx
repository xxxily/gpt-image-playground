'use client';

import { WorkspaceResizeHandle } from '@/components/ui/workspace-resize-handle';
import {
    WORKSPACE_RIGHT_COLLAPSED_WIDTH_PX,
    getWorkspaceRightPaneDefaultWidth,
    getWorkspaceRightPaneMaxWidth
} from '@/lib/workspace-panel-preferences';
import { cn } from '@/lib/utils';
import * as React from 'react';

type ResizableWorkspaceProps = {
    main: React.ReactNode;
    auxiliary?: React.ReactNode;
    auxiliaryActive: boolean;
    auxiliaryCollapsed: boolean;
    auxiliaryWidthPx: number;
    className?: string;
    resizeLabel: string;
    onAuxiliaryWidthChange: (widthPx: number, options?: { persist?: boolean }) => void;
    onAuxiliaryResizeStart?: () => void;
    onAuxiliaryResizeEnd?: (widthPx: number) => void;
    onAuxiliaryReset?: () => void;
};

export function ResizableWorkspace({
    main,
    auxiliary,
    auxiliaryActive,
    auxiliaryCollapsed,
    auxiliaryWidthPx,
    className,
    resizeLabel,
    onAuxiliaryWidthChange,
    onAuxiliaryResizeStart,
    onAuxiliaryResizeEnd,
    onAuxiliaryReset
}: ResizableWorkspaceProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = React.useState(0);

    React.useEffect(() => {
        const element = containerRef.current;
        if (!element || typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            setContainerWidth(Math.round(entry.contentRect.width));
        });
        observer.observe(element);
        setContainerWidth(Math.round(element.getBoundingClientRect().width));
        return () => observer.disconnect();
    }, []);

    const maxWidth = containerWidth > 0 ? getWorkspaceRightPaneMaxWidth(containerWidth) : auxiliaryWidthPx;
    const defaultWidth = containerWidth > 0 ? getWorkspaceRightPaneDefaultWidth(containerWidth) : auxiliaryWidthPx;
    const width = auxiliaryCollapsed
        ? WORKSPACE_RIGHT_COLLAPSED_WIDTH_PX
        : Math.min(Math.max(auxiliaryWidthPx, 360), maxWidth);

    return (
        <div
            ref={containerRef}
            className={cn('grid h-full min-h-0 w-full overflow-hidden gap-0', className)}
            style={
                auxiliaryActive
                    ? ({
                          gridTemplateColumns: `minmax(0,1fr) ${auxiliaryCollapsed ? '0px' : '12px'} ${width}px`
                      } as React.CSSProperties)
                    : undefined
            }>
            <div className='h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain' data-workspace-scroll='main'>
                {main}
            </div>
            {auxiliaryActive && !auxiliaryCollapsed && (
                <WorkspaceResizeHandle
                    orientation='vertical'
                    ariaLabel={resizeLabel}
                    valuePx={auxiliaryWidthPx}
                    minValuePx={360}
                    maxValuePx={maxWidth}
                    defaultValuePx={defaultWidth}
                    invert
                    onResizeStart={onAuxiliaryResizeStart}
                    onResize={(nextWidth) => onAuxiliaryWidthChange(nextWidth, { persist: false })}
                    onResizeEnd={onAuxiliaryResizeEnd}
                    onReset={onAuxiliaryReset}
                />
            )}
            {auxiliaryActive && (
                <div className='h-full min-h-0 min-w-0 overflow-hidden overscroll-contain' data-workspace-scroll='auxiliary'>
                    {auxiliary}
                </div>
            )}
        </div>
    );
}
