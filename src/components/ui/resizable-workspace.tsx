'use client';

import { WorkspaceResizeHandle } from '@/components/ui/workspace-resize-handle';
import {
    WORKSPACE_RIGHT_COLLAPSED_WIDTH_PX,
    getWorkspaceRightPaneDefaultWidth,
    getWorkspaceSidePaneMaxWidth
} from '@/lib/workspace-panel-preferences';
import { cn } from '@/lib/utils';
import * as React from 'react';

type SidePaneConfig = {
    node?: React.ReactNode;
    active: boolean;
    collapsed: boolean;
    widthPx: number;
    resizeLabel: string;
    onWidthChange: (widthPx: number, options?: { persist?: boolean }) => void;
    onResizeStart?: () => void;
    onResizeEnd?: (widthPx: number) => void;
    onReset?: () => void;
};

type ResizableWorkspaceProps = {
    main: React.ReactNode;
    className?: string;
    leftAuxiliary?: SidePaneConfig;
    rightAuxiliary?: SidePaneConfig;
};

function getPaneWidth(config: SidePaneConfig | undefined, maxWidth: number): number {
    if (!config?.active) return 0;
    if (config.collapsed) return WORKSPACE_RIGHT_COLLAPSED_WIDTH_PX;
    return Math.min(Math.max(config.widthPx, 360), maxWidth);
}

export function ResizableWorkspace({ main, className, leftAuxiliary, rightAuxiliary }: ResizableWorkspaceProps) {
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

    const leftMaxWidth =
        containerWidth > 0
            ? getWorkspaceSidePaneMaxWidth(
                  containerWidth,
                  rightAuxiliary?.active && !rightAuxiliary.collapsed ? rightAuxiliary.widthPx : 0
              )
            : leftAuxiliary?.widthPx ?? 0;
    const rightMaxWidth =
        containerWidth > 0
            ? getWorkspaceSidePaneMaxWidth(
                  containerWidth,
                  leftAuxiliary?.active && !leftAuxiliary.collapsed ? leftAuxiliary.widthPx : 0
              )
            : rightAuxiliary?.widthPx ?? 0;
    const leftDefaultWidth = containerWidth > 0 ? getWorkspaceRightPaneDefaultWidth(containerWidth) : leftAuxiliary?.widthPx ?? 0;
    const rightDefaultWidth = containerWidth > 0 ? getWorkspaceRightPaneDefaultWidth(containerWidth) : rightAuxiliary?.widthPx ?? 0;
    const leftWidth = getPaneWidth(leftAuxiliary, leftMaxWidth);
    const rightWidth = getPaneWidth(rightAuxiliary, rightMaxWidth);
    const leftOpen = Boolean(leftAuxiliary?.active);
    const rightOpen = Boolean(rightAuxiliary?.active);
    const columns = [
        leftOpen ? `${leftWidth}px` : null,
        leftOpen && !leftAuxiliary?.collapsed ? '12px' : null,
        'minmax(0,1fr)',
        rightOpen && !rightAuxiliary?.collapsed ? '12px' : null,
        rightOpen ? `${rightWidth}px` : null
    ].filter(Boolean);

    return (
        <div
            ref={containerRef}
            className={cn('grid h-full min-h-0 w-full overflow-hidden gap-0', className)}
            style={{ gridTemplateColumns: columns.join(' ') }}>
            {leftOpen && (
                <div className='h-full min-h-0 min-w-0 overflow-hidden overscroll-contain' data-workspace-scroll='left'>
                    {leftAuxiliary?.node}
                </div>
            )}
            {leftAuxiliary && leftOpen && !leftAuxiliary.collapsed && (
                <WorkspaceResizeHandle
                    orientation='vertical'
                    ariaLabel={leftAuxiliary.resizeLabel}
                    valuePx={leftAuxiliary.widthPx}
                    minValuePx={360}
                    maxValuePx={leftMaxWidth}
                    defaultValuePx={leftDefaultWidth}
                    onResizeStart={leftAuxiliary.onResizeStart}
                    onResize={(nextWidth) => leftAuxiliary.onWidthChange(nextWidth, { persist: false })}
                    onResizeEnd={leftAuxiliary.onResizeEnd}
                    onReset={leftAuxiliary.onReset}
                />
            )}
            <div className='h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain' data-workspace-scroll='main'>
                {main}
            </div>
            {rightAuxiliary && rightOpen && !rightAuxiliary.collapsed && (
                <WorkspaceResizeHandle
                    orientation='vertical'
                    ariaLabel={rightAuxiliary.resizeLabel}
                    valuePx={rightAuxiliary.widthPx}
                    minValuePx={360}
                    maxValuePx={rightMaxWidth}
                    defaultValuePx={rightDefaultWidth}
                    invert
                    onResizeStart={rightAuxiliary.onResizeStart}
                    onResize={(nextWidth) => rightAuxiliary.onWidthChange(nextWidth, { persist: false })}
                    onResizeEnd={rightAuxiliary.onResizeEnd}
                    onReset={rightAuxiliary.onReset}
                />
            )}
            {rightOpen && (
                <div className='h-full min-h-0 min-w-0 overflow-hidden overscroll-contain' data-workspace-scroll='right'>
                    {rightAuxiliary?.node}
                </div>
            )}
        </div>
    );
}
