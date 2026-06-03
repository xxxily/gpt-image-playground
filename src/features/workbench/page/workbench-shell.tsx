'use client';

import { BatchPlanOutput } from '@/components/batch-plan-output';
import { ConfigurationRequiredActions } from '@/components/configuration-required-actions';
import { CreativeResourceWorkspacePanel } from '@/components/creative-resource-workspace-panel';
import { EditingForm, type EditingFormHandle } from '@/components/editing-form';
import { HistoryPanel } from '@/components/history-panel';
import { ImageOutput } from '@/components/image-output';
import { PromoSlot } from '@/components/promo-slot';
import { TaskTracker } from '@/components/task-tracker';
import { TextOutput } from '@/components/text-output';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ResizableWorkspace } from '@/components/ui/resizable-workspace';
import { WorkspacePane } from '@/components/ui/workspace-pane';
import { VideoOutput } from '@/components/video-output';
import { CreativeWorkspacesPanel } from '@/components/workspaces/creative-workspaces-panel';
import { WorkspaceStatusChip } from '@/components/workspaces/workspace-status-chip';
import { WorkbenchDialogs } from '@/features/workbench/workbench-dialogs';
import { WorkbenchHeader } from '@/features/workbench/workbench-header';
import type { ConfigurationGuidanceTarget } from '@/lib/configuration-guidance';
import { ALL_CREATIVE_WORKSPACES_ID } from '@/types/creative-workspace';
import type { WorkspacePanelTab } from '@/types/workspace-panel';
import { Boxes, Compass, FolderKanban, X } from 'lucide-react';
import * as React from 'react';

type Translate = (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string;

type AuxiliaryPaneProps = {
    active: boolean;
    collapsed: boolean;
    widthPx: number;
};

type WorkspaceShellProps = {
    left: AuxiliaryPaneProps & { tab: WorkspacePanelTab };
    right: AuxiliaryPaneProps & { tab: WorkspacePanelTab };
    currentSourceFiles: File[];
    creativeWorkspacesPanelProps: React.ComponentProps<typeof CreativeWorkspacesPanel>;
    featureMenuRightBoundary: number;
    onPanelTabChange: (side: 'left' | 'right', tab: WorkspacePanelTab) => void;
    onPanelClose: (side: 'left' | 'right') => void;
    onPanelCollapseChange: (side: 'left' | 'right', collapsed: boolean) => void;
    onPanelWidthChange: (side: 'left' | 'right', widthPx: number, options?: { persist?: boolean }) => void;
    onPanelResizeEnd: (side: 'left' | 'right', widthPx: number) => void;
    onPanelReset: (side: 'left' | 'right') => void;
    onUseAssetLibraryFiles: (files: File[]) => boolean;
    onOpenAssetLibrarySurface: (tab?: 'assets' | 'inspiration', surface?: 'default' | 'drawer') => void;
};

type WorkbenchShellProps = {
    t: Translate;
    isGlobalDragOver: boolean;
    workspace: WorkspaceShellProps;
    header: React.ComponentProps<typeof WorkbenchHeader>;
    dialogs: React.ComponentProps<typeof WorkbenchDialogs>;
    generationAnnouncement: string;
    editingFormRef: React.RefObject<EditingFormHandle | null>;
    editingFormProps: React.ComponentProps<typeof EditingForm>;
    activeWorkspaceStatus: {
        key: string;
        name: string;
        openLabel: string;
        onOpen: () => void;
    };
    outputAnchorRef: React.RefObject<HTMLDivElement | null>;
    errorState: {
        error: string | null;
        displayedMessage: string | null;
        guidanceTarget: ConfigurationGuidanceTarget | null;
        onConfigureGuidance: (target: ConfigurationGuidanceTarget) => void;
        onDismiss: () => void;
    };
    batchOutput: {
        plan: React.ComponentProps<typeof BatchPlanOutput>['plan'] | null;
        isLoading: boolean;
        error: string | null;
        onPlanChange: React.ComponentProps<typeof BatchPlanOutput>['onPlanChange'];
        onRegenerate: React.ComponentProps<typeof BatchPlanOutput>['onRegenerate'];
        onConfirm: React.ComponentProps<typeof BatchPlanOutput>['onConfirm'];
        onDismiss: React.ComponentProps<typeof BatchPlanOutput>['onDismiss'];
        onConfigureError: React.ComponentProps<typeof BatchPlanOutput>['onConfigureError'];
        confirmDisabled: boolean;
        canRegenerate: boolean;
        imageEditRuntime: React.ComponentProps<typeof BatchPlanOutput>['imageEditRuntime'];
    };
    videoOutput: {
        shouldShow: boolean;
        task: React.ComponentProps<typeof VideoOutput>['task'];
        onCancel: React.ComponentProps<typeof VideoOutput>['onCancel'];
        onDismiss: React.ComponentProps<typeof VideoOutput>['onDismiss'];
        onConfigureError: React.ComponentProps<typeof VideoOutput>['onConfigureError'];
    };
    textOutput: React.ComponentProps<typeof TextOutput> & {
        shouldShow: boolean;
    };
    imageOutput: React.ComponentProps<typeof ImageOutput>;
    taskTracker: React.ComponentProps<typeof TaskTracker>;
    promoProfileId: string | null;
    historyPanel: React.ComponentProps<typeof HistoryPanel>;
};

function WorkspaceSidePane({
    t,
    workspace,
    side,
    activeTab,
    collapsed
}: {
    t: Translate;
    workspace: WorkspaceShellProps;
    side: 'left' | 'right';
    activeTab: WorkspacePanelTab;
    collapsed: boolean;
}) {
    const tabs: Array<{ id: WorkspacePanelTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
        { id: 'workspaces', label: t('featureMenu.creativeWorkspaces'), icon: FolderKanban },
        { id: 'assets', label: t('featureMenu.assetLibrary'), icon: Boxes },
        { id: 'inspiration', label: t('featureMenu.inspirationHub'), icon: Compass }
    ];
    const isWorkspaceTab = activeTab === 'workspaces';
    const resourceTab = activeTab === 'inspiration' ? 'inspiration' : 'assets';

    return (
        <WorkspacePane
            side={side}
            title={isWorkspaceTab ? t('creativeWorkspaces.panel.title') : t('assets.drawer.title')}
            description={isWorkspaceTab ? t('creativeWorkspaces.panel.description') : t('workspace.panel.description')}
            collapsed={collapsed}
            collapseLabel={t('workspace.action.collapse')}
            expandLabel={t('workspace.action.expand')}
            closeLabel={t('workspace.action.close')}
            toolbar={
                <div className='flex items-center gap-1'>
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <Button
                                key={tab.id}
                                type='button'
                                variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                                size='icon'
                                className='h-8 w-8'
                                aria-label={tab.label}
                                title={tab.label}
                                onClick={() => workspace.onPanelTabChange(side, tab.id)}>
                                <Icon className='h-3.5 w-3.5' />
                            </Button>
                        );
                    })}
                </div>
            }
            onCollapseChange={(nextCollapsed) => workspace.onPanelCollapseChange(side, nextCollapsed)}
            onClose={() => workspace.onPanelClose(side)}
            className='h-dvh'>
            {isWorkspaceTab ? (
                <CreativeWorkspacesPanel {...workspace.creativeWorkspacesPanelProps} />
            ) : (
                <CreativeResourceWorkspacePanel
                    activeTab={resourceTab}
                    currentSourceFiles={workspace.currentSourceFiles}
                    onActiveTabChange={(tab) => {
                        if (tab !== 'workspaces') workspace.onPanelTabChange(side, tab);
                    }}
                    onUseAssetFiles={workspace.onUseAssetLibraryFiles}
                    onOpenDrawer={(tab) =>
                        workspace.onOpenAssetLibrarySurface(tab === 'workspaces' ? 'assets' : tab, 'drawer')
                    }
                />
            )}
        </WorkspacePane>
    );
}

function WorkbenchOutputPanel({
    t,
    outputAnchorRef,
    errorState,
    batchOutput,
    videoOutput,
    textOutput,
    imageOutput
}: Pick<
    WorkbenchShellProps,
    't' | 'outputAnchorRef' | 'errorState' | 'batchOutput' | 'videoOutput' | 'textOutput' | 'imageOutput'
>) {
    return (
        <div
            ref={outputAnchorRef}
            className='flex min-h-[420px] scroll-mt-4 flex-col lg:col-span-1 lg:h-[70vh] lg:min-h-[600px]'>
            {errorState.error && (
                <Alert
                    variant='destructive'
                    className='relative mb-4 border-red-200 bg-red-50 pr-11 text-red-700 dark:border-red-500/50 dark:bg-red-900/20 dark:text-red-300'>
                    <AlertTitle className='text-red-800 dark:text-red-200'>错误</AlertTitle>
                    <AlertDescription className='flex flex-wrap items-center gap-x-2 gap-y-1 text-red-700 dark:text-red-300'>
                        {errorState.guidanceTarget ? (
                            <ConfigurationRequiredActions
                                onConfigure={() => errorState.onConfigureGuidance(errorState.guidanceTarget!)}
                                actionClassName='hover:text-red-900 dark:hover:text-red-100'
                            />
                        ) : (
                            <span>{errorState.displayedMessage}</span>
                        )}
                    </AlertDescription>
                    <button
                        type='button'
                        onClick={errorState.onDismiss}
                        className='absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-md text-red-700/70 transition-colors hover:bg-red-100 hover:text-red-900 focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-red-50 focus-visible:outline-none dark:text-red-200/70 dark:hover:bg-red-500/20 dark:hover:text-red-50 dark:focus-visible:ring-offset-red-950'
                        aria-label={t('workbench.error.dismiss')}>
                        <X className='h-4 w-4' aria-hidden='true' />
                    </button>
                </Alert>
            )}
            {batchOutput.plan ? (
                <BatchPlanOutput
                    plan={batchOutput.plan}
                    isLoading={batchOutput.isLoading}
                    error={batchOutput.error}
                    onPlanChange={batchOutput.onPlanChange}
                    onRegenerate={batchOutput.onRegenerate}
                    onConfirm={batchOutput.onConfirm}
                    onDismiss={batchOutput.onDismiss}
                    onConfigureError={batchOutput.onConfigureError}
                    confirmDisabled={batchOutput.confirmDisabled}
                    canRegenerate={batchOutput.canRegenerate}
                    imageEditRuntime={batchOutput.imageEditRuntime}
                />
            ) : videoOutput.shouldShow ? (
                <VideoOutput
                    task={videoOutput.task}
                    onCancel={videoOutput.onCancel}
                    onDismiss={videoOutput.onDismiss}
                    onConfigureError={videoOutput.onConfigureError}
                />
            ) : textOutput.shouldShow ? (
                <TextOutput
                    text={textOutput.text}
                    structured={textOutput.structured}
                    isLoading={textOutput.isLoading}
                    taskStartedAt={textOutput.taskStartedAt}
                    sourceLabel={textOutput.sourceLabel}
                    createdAt={textOutput.createdAt}
                    durationMs={textOutput.durationMs}
                    usage={textOutput.usage}
                    isHistoryReplay={textOutput.isHistoryReplay}
                    onSendToGenerator={textOutput.onSendToGenerator}
                    onReplacePrompt={textOutput.onReplacePrompt}
                    onAppendPrompt={textOutput.onAppendPrompt}
                />
            ) : (
                <ImageOutput {...imageOutput} />
            )}
        </div>
    );
}

export function WorkbenchShell({
    t,
    isGlobalDragOver,
    workspace,
    header,
    dialogs,
    generationAnnouncement,
    editingFormRef,
    editingFormProps,
    activeWorkspaceStatus,
    outputAnchorRef,
    errorState,
    batchOutput,
    videoOutput,
    textOutput,
    imageOutput,
    taskTracker,
    promoProfileId,
    historyPanel
}: WorkbenchShellProps) {
    return (
        <main id='main-content' tabIndex={-1} className='app-theme-scope text-foreground h-dvh overflow-hidden'>
            {isGlobalDragOver && (
                <div className='border-primary/60 bg-background/85 pointer-events-none fixed inset-0 z-[9998] flex items-center justify-center border-4 border-dashed backdrop-blur-sm'>
                    <div className='flex flex-col items-center gap-4 text-center'>
                        <div className='border-primary bg-primary/10 flex h-20 w-20 items-center justify-center rounded-full border-2'>
                            <svg
                                className='text-primary h-10 w-10'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                                strokeWidth={1.5}>
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    d='M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5'
                                />
                            </svg>
                        </div>
                        <p className='text-foreground text-2xl font-semibold'>释放以添加图片</p>
                        <p className='text-muted-foreground text-sm'>添加源图片后将自动执行编辑任务</p>
                    </div>
                </div>
            )}
            <ResizableWorkspace
                className='h-dvh w-full'
                leftAuxiliary={{
                    node: (
                        <WorkspaceSidePane
                            t={t}
                            workspace={workspace}
                            side='left'
                            activeTab={workspace.left.tab}
                            collapsed={workspace.left.collapsed}
                        />
                    ),
                    active: workspace.left.active,
                    collapsed: workspace.left.collapsed,
                    widthPx: workspace.left.widthPx,
                    resizeLabel: t('workspace.resizeHandle.label'),
                    onWidthChange: (widthPx, options) => workspace.onPanelWidthChange('left', widthPx, options),
                    onResizeEnd: (widthPx) => workspace.onPanelResizeEnd('left', widthPx),
                    onReset: () => workspace.onPanelReset('left')
                }}
                rightAuxiliary={{
                    node: (
                        <WorkspaceSidePane
                            t={t}
                            workspace={workspace}
                            side='right'
                            activeTab={workspace.right.tab}
                            collapsed={workspace.right.collapsed}
                        />
                    ),
                    active: workspace.right.active,
                    collapsed: workspace.right.collapsed,
                    widthPx: workspace.right.widthPx,
                    resizeLabel: t('workspace.resizeHandle.label'),
                    onWidthChange: (widthPx, options) => workspace.onPanelWidthChange('right', widthPx, options),
                    onResizeEnd: (widthPx) => workspace.onPanelResizeEnd('right', widthPx),
                    onReset: () => workspace.onPanelReset('right')
                }}
                main={
                    <div className='flex min-h-full flex-col items-center overflow-x-hidden px-0 pt-0 pb-4 md:p-6 lg:p-8'>
                        <WorkbenchHeader {...header} />
                        <WorkbenchDialogs {...dialogs} />
                        <div className='sr-only' aria-live='polite' aria-atomic='true'>
                            {generationAnnouncement}
                        </div>
                        <div className='w-full max-w-screen-2xl space-y-6'>
                            <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
                                <div
                                    className='relative flex min-h-0 flex-col lg:col-span-1 lg:h-[70vh] lg:min-h-[600px]'
                                    data-editing-form-anchor>
                                    <EditingForm
                                        ref={editingFormRef}
                                        workspaceStatusSlot={
                                            <WorkspaceStatusChip
                                                key={activeWorkspaceStatus.key}
                                                name={activeWorkspaceStatus.name}
                                                openLabel={activeWorkspaceStatus.openLabel}
                                                onOpen={activeWorkspaceStatus.onOpen}
                                            />
                                        }
                                        {...editingFormProps}
                                    />
                                </div>
                                <WorkbenchOutputPanel
                                    t={t}
                                    outputAnchorRef={outputAnchorRef}
                                    errorState={errorState}
                                    batchOutput={batchOutput}
                                    videoOutput={videoOutput}
                                    textOutput={textOutput}
                                    imageOutput={imageOutput}
                                />
                            </div>

                            <div className='min-h-[150px]'>
                                <TaskTracker {...taskTracker} />
                                <div className='mt-6 mb-4'>
                                    <PromoSlot
                                        slotKey='history_top_banner'
                                        surface='home'
                                        promoProfileId={promoProfileId}
                                        className='w-full'
                                    />
                                </div>
                                <HistoryPanel
                                    {...historyPanel}
                                    showWorkspaceBadges={
                                        historyPanel.currentWorkspaceScope === ALL_CREATIVE_WORKSPACES_ID
                                    }
                                />
                            </div>
                        </div>
                    </div>
                }
            />
        </main>
    );
}
