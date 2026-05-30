'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    DEFAULT_WORKSPACE_COLOR,
    WORKSPACE_COLOR_PALETTE,
    compareCreativeWorkspacesByDisplayOrder,
    getCreativeWorkspaceDisplayName
} from '@/lib/creative-workspace-store';
import { cn } from '@/lib/utils';
import {
    ALL_CREATIVE_WORKSPACES_ID,
    DEFAULT_CREATIVE_WORKSPACE_ID,
    type CreativeWorkspace,
    type CreativeWorkspaceHistoryScope
} from '@/types/creative-workspace';
import {
    Archive,
    ArchiveRestore,
    Check,
    FolderKanban,
    Grid2X2,
    List,
    Pencil,
    Pin,
    Plus,
    Search,
    Trash2
} from 'lucide-react';
import * as React from 'react';

type WorkspaceStats = {
    imageHistoryCount: number;
    visionTextHistoryCount: number;
    videoHistoryCount: number;
    fileCount: number;
    totalBytes?: number;
};

type CreativeWorkspacesPanelProps = {
    workspaces: CreativeWorkspace[];
    activeWorkspaceId: string;
    historyScope: CreativeWorkspaceHistoryScope;
    statsByWorkspaceId: Map<string, WorkspaceStats>;
    onCreateWorkspace: (input: { name: string; description?: string; color?: string }) => { ok: true } | { ok: false; reason: string };
    onEnterWorkspace: (workspaceId: string) => void;
    onRenameWorkspace: (
        workspaceId: string,
        name: string,
        description?: string,
        color?: string
    ) => { ok: true } | { ok: false; reason: string };
    onToggleWorkspacePinned: (workspaceId: string, pinned: boolean) => void;
    onArchiveWorkspace: (workspaceId: string, archived: boolean) => void;
    onDeleteWorkspace: (workspaceId: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
    onHistoryScopeChange: (scope: CreativeWorkspaceHistoryScope) => void;
    compact?: boolean;
};

type WorkspaceDialogState =
    | { type: 'create' }
    | { type: 'rename'; workspace: CreativeWorkspace }
    | { type: 'delete'; workspace: CreativeWorkspace }
    | null;

function getWorkspaceStats(
    workspace: CreativeWorkspace,
    statsByWorkspaceId: Map<string, WorkspaceStats>
): WorkspaceStats {
    return (
        statsByWorkspaceId.get(workspace.id) ??
        workspace.stats ?? {
            imageHistoryCount: 0,
            visionTextHistoryCount: 0,
            videoHistoryCount: 0,
            fileCount: 0,
            totalBytes: 0
        }
    );
}

function normalizeErrorMessage(reason: string, t: (key: string) => string): string {
    if (reason === 'empty') return t('creativeWorkspaces.error.emptyName');
    if (reason === 'duplicate') return t('creativeWorkspaces.error.duplicateName');
    if (reason === 'reserved') return t('creativeWorkspaces.error.reservedName');
    if (reason === 'running-tasks') return t('creativeWorkspaces.delete.blockedRunning');
    if (reason === 'default-workspace-delete-disabled') return t('creativeWorkspaces.delete.blockedDefault');
    if (reason === 'missing') return t('creativeWorkspaces.delete.blockedMissing');
    return reason;
}

export function CreativeWorkspacesPanel({
    workspaces,
    activeWorkspaceId,
    historyScope,
    statsByWorkspaceId,
    onCreateWorkspace,
    onEnterWorkspace,
    onRenameWorkspace,
    onToggleWorkspacePinned,
    onArchiveWorkspace,
    onDeleteWorkspace,
    onHistoryScopeChange,
    compact = false
}: CreativeWorkspacesPanelProps) {
    const { t } = useAppLanguage();
    const [query, setQuery] = React.useState('');
    const [view, setView] = React.useState<'grid' | 'list'>('list');
    const [statusFilter, setStatusFilter] = React.useState<'active' | 'archived' | 'all'>('active');
    const [dialog, setDialog] = React.useState<WorkspaceDialogState>(null);
    const [nameDraft, setNameDraft] = React.useState('');
    const [descriptionDraft, setDescriptionDraft] = React.useState('');
    const [colorDraft, setColorDraft] = React.useState(DEFAULT_WORKSPACE_COLOR);
    const [deleteConfirmation, setDeleteConfirmation] = React.useState('');
    const [formError, setFormError] = React.useState('');
    const [isDeleting, setIsDeleting] = React.useState(false);

    const defaultWorkspaceName = t('creativeWorkspaces.defaultName');
    const getDisplayName = React.useCallback(
        (workspace: CreativeWorkspace) => getCreativeWorkspaceDisplayName(workspace, defaultWorkspaceName),
        [defaultWorkspaceName]
    );
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filteredWorkspaces = React.useMemo(() => {
        return workspaces
            .filter((workspace) => {
                if (statusFilter !== 'all' && workspace.status !== statusFilter) return false;
                if (!normalizedQuery) return true;
                const haystack = [getDisplayName(workspace), workspace.name, workspace.description, workspace.icon]
                    .filter(Boolean)
                    .join(' ')
                    .toLocaleLowerCase();
                return haystack.includes(normalizedQuery);
            })
            .sort(compareCreativeWorkspacesByDisplayOrder);
    }, [getDisplayName, normalizedQuery, statusFilter, workspaces]);

    const openCreateDialog = () => {
        setDialog({ type: 'create' });
        setNameDraft('');
        setDescriptionDraft('');
        setColorDraft(DEFAULT_WORKSPACE_COLOR);
        setFormError('');
    };

    const openRenameDialog = (workspace: CreativeWorkspace) => {
        setDialog({ type: 'rename', workspace });
        setNameDraft(getDisplayName(workspace));
        setDescriptionDraft(workspace.description ?? '');
        setColorDraft(workspace.color ?? DEFAULT_WORKSPACE_COLOR);
        setFormError('');
    };

    const openDeleteDialog = (workspace: CreativeWorkspace) => {
        setDialog({ type: 'delete', workspace });
        setDeleteConfirmation('');
        setFormError('');
    };

    const handleSave = () => {
        if (dialog?.type === 'create') {
            const result = onCreateWorkspace({
                name: nameDraft,
                description: descriptionDraft,
                color: colorDraft
            });
            if (!result.ok) {
                setFormError(normalizeErrorMessage(result.reason, t));
                return;
            }
            setDialog(null);
            return;
        }

        if (dialog?.type === 'rename') {
            const result = onRenameWorkspace(dialog.workspace.id, nameDraft, descriptionDraft, colorDraft);
            if (!result.ok) {
                setFormError(normalizeErrorMessage(result.reason, t));
                return;
            }
            setDialog(null);
        }
    };

    const handleConfirmDelete = async () => {
        if (dialog?.type !== 'delete') return;
        setIsDeleting(true);
        setFormError('');
        const result = await onDeleteWorkspace(dialog.workspace.id);
        setIsDeleting(false);
        if (!result.ok) {
            setFormError(normalizeErrorMessage(result.reason, t));
            return;
        }
        setDialog(null);
    };

    const renderWorkspaceActions = (workspace: CreativeWorkspace) => {
        const archived = workspace.status === 'archived';
        return (
            <div className='flex shrink-0 flex-wrap items-center justify-end gap-1.5 md:opacity-0 md:pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 ease-out transform translate-x-1 group-hover:translate-x-0'>
                <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 cursor-pointer rounded-lg text-muted-foreground/80 hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition-colors'
                    aria-label={t('creativeWorkspaces.action.rename')}
                    title={t('creativeWorkspaces.action.rename')}
                    onClick={(event) => {
                        event.stopPropagation();
                        openRenameDialog(workspace);
                    }}>
                    <Pencil className='h-3.5 w-3.5' />
                </Button>
                <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 cursor-pointer rounded-lg text-muted-foreground/80 hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition-colors'
                    aria-label={
                        archived
                            ? t('creativeWorkspaces.action.restore')
                            : t('creativeWorkspaces.action.archive')
                    }
                    title={
                        archived
                            ? t('creativeWorkspaces.action.restore')
                            : t('creativeWorkspaces.action.archive')
                    }
                    onClick={(event) => {
                        event.stopPropagation();
                        onArchiveWorkspace(workspace.id, !archived);
                    }}>
                    {archived ? <ArchiveRestore className='h-3.5 w-3.5' /> : <Archive className='h-3.5 w-3.5' />}
                </Button>
                {workspace.id !== DEFAULT_CREATIVE_WORKSPACE_ID && (
                    <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8 cursor-pointer rounded-lg text-muted-foreground/80 hover:text-destructive hover:bg-destructive/10 transition-colors'
                        aria-label={t('creativeWorkspaces.action.delete')}
                        title={t('creativeWorkspaces.action.delete')}
                        onClick={(event) => {
                            event.stopPropagation();
                            openDeleteDialog(workspace);
                        }}>
                        <Trash2 className='h-3.5 w-3.5' />
                    </Button>
                )}
            </div>
        );
    };

    const renderPinButton = (workspace: CreativeWorkspace, isRow = false) => {
        const pinned = Boolean(workspace.favorite);
        const pinLabel = pinned ? t('creativeWorkspaces.action.unpin') : t('creativeWorkspaces.action.pin');
        return (
            <Button
                type='button'
                variant='ghost'
                size='icon'
                className={cn(
                    'absolute z-10 h-7.5 w-7.5 cursor-pointer rounded-lg transition-all duration-300 ease-out',
                    isRow ? 'top-1/2 -translate-y-1/2 right-3' : 'top-3 right-3',
                    pinned
                        ? 'text-amber-500 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-400 dark:hover:bg-amber-400/10 dark:hover:text-amber-300'
                        : 'text-muted-foreground/50 hover:bg-slate-200/50 hover:text-foreground dark:hover:bg-slate-800/60',
                    !pinned && 'md:opacity-0 md:pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                )}
                aria-label={`${pinLabel} ${getDisplayName(workspace)}`}
                title={pinLabel}
                onClick={(event) => {
                    event.stopPropagation();
                    onToggleWorkspacePinned(workspace.id, !pinned);
                }}>
                <Pin className={cn('h-3.5 w-3.5 transition-transform duration-300', pinned && 'rotate-45')} />
            </Button>
        );
    };

    const renderWorkspaceCard = (workspace: CreativeWorkspace) => {
        const stats = getWorkspaceStats(workspace, statsByWorkspaceId);
        const active = workspace.id === activeWorkspaceId;
        const displayName = getDisplayName(workspace);
        return (
            <article
                key={workspace.id}
                className={cn(
                    'app-panel-subtle group relative flex min-w-0 flex-col gap-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/30 p-4 text-left transition-all duration-300 ease-out bg-slate-50/80 dark:bg-slate-900/10 shadow-[0_2px_8px_rgba(15,23,42,0.01)] dark:shadow-[0_2px_8px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:bg-slate-100/45 dark:hover:bg-slate-900/25 hover:shadow-[0_12px_24px_-4px_rgba(15,23,42,0.03)] dark:hover:shadow-[0_12px_24px_-4px_rgba(15,23,42,0.22)] hover:border-slate-200 dark:hover:border-slate-700',
                    active && 'border-primary/25 bg-primary/[0.015] dark:border-primary/20 dark:bg-primary/[0.01] shadow-[inset_0_0_0_1px_rgba(var(--primary),0.005)] hover:border-primary/35 hover:-translate-y-0.5'
                )}>
                {/* 侧边极光指示条 */}
                {active && (
                    <div className='absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/85 to-primary rounded-l-2xl animate-fade-in' />
                )}
                {renderPinButton(workspace)}
                <button type='button' className='min-w-0 cursor-pointer text-left focus:outline-none' onClick={() => onEnterWorkspace(workspace.id)}>
                    <div className='mb-3 flex items-start gap-3'>
                        <span
                            className='mt-0.5 flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl text-white transition-transform duration-300 group-hover:scale-[1.03]'
                            style={{
                                backgroundColor: workspace.color ?? DEFAULT_WORKSPACE_COLOR,
                                boxShadow: `0 4px 14px ${workspace.color ? `${workspace.color}25` : 'rgba(0,0,0,0.06)'}`
                            }}>
                            <FolderKanban className='h-4 w-4' />
                        </span>
                        <span className='min-w-0 flex-1 pr-7'>
                            <span className='flex min-w-0 items-center gap-1.5'>
                                <span className='text-foreground block truncate text-[14.5px] font-semibold tracking-wide' data-i18n-skip='true'>
                                    {displayName}
                                </span>
                                {active && <Check className='text-primary h-4 w-4 shrink-0' />}
                            </span>
                            <span className='text-muted-foreground/75 mt-1 block truncate text-xs font-medium' data-i18n-skip='true'>
                                {workspace.description || t('creativeWorkspaces.emptyDescription')}
                            </span>
                        </span>
                    </div>
                    {/* 一体化胶囊统计 */}
                    <div className='flex flex-wrap items-center gap-1.5 mt-2.5'>
                        <span className='inline-flex items-center rounded-lg bg-slate-200/40 dark:bg-slate-800/40 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground/80 transition-colors'>
                            {t('creativeWorkspaces.stats.images', { count: stats.imageHistoryCount })}
                        </span>
                        <span className='inline-flex items-center rounded-lg bg-slate-200/40 dark:bg-slate-800/40 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground/80 transition-colors'>
                            {t('creativeWorkspaces.stats.vision', { count: stats.visionTextHistoryCount })}
                        </span>
                        {stats.videoHistoryCount > 0 && (
                            <span className='inline-flex items-center rounded-lg bg-slate-200/40 dark:bg-slate-800/40 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground/80 transition-colors'>
                                {t('creativeWorkspaces.stats.video', { count: stats.videoHistoryCount })}
                            </span>
                        )}
                        {stats.fileCount > 0 && (
                            <span className='inline-flex items-center rounded-lg bg-slate-200/40 dark:bg-slate-800/40 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground/80 transition-colors'>
                                {t('creativeWorkspaces.stats.files', { count: stats.fileCount })}
                            </span>
                        )}
                    </div>
                </button>
                <div className='flex items-center justify-end gap-2 mt-0.5'>
                    {renderWorkspaceActions(workspace)}
                </div>
            </article>
        );
    };

    const renderWorkspaceRow = (workspace: CreativeWorkspace) => {
        const stats = getWorkspaceStats(workspace, statsByWorkspaceId);
        const active = workspace.id === activeWorkspaceId;
        const displayName = getDisplayName(workspace);
        return (
            <article
                key={workspace.id}
                className={cn(
                    'relative flex min-w-0 items-center gap-3.5 p-3.5 pr-12 group transition-all duration-300 ease-out bg-transparent hover:bg-slate-50/60 dark:hover:bg-slate-900/10 shadow-[inset_0_-1px_0_rgba(15,23,42,0.08),inset_0_-3px_6px_-2px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.09),inset_0_-3px_8px_-2px_rgba(99,102,241,0.12),0_4px_16px_rgba(0,0,0,0.45)] last:shadow-none',
                    active && 'bg-primary/[0.015] dark:bg-primary/[0.01] z-10'
                )}>
                {/* 左侧极光指示线 */}
                {active && (
                    <div className='absolute left-0 top-2.5 bottom-2.5 w-[3px] bg-gradient-to-b from-primary/80 to-primary rounded-full animate-fade-in' />
                )}
                {renderPinButton(workspace, true)}
                <button
                    type='button'
                    className='flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left focus:outline-none'
                    onClick={() => onEnterWorkspace(workspace.id)}>
                    <span
                        className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-transform duration-300 group-hover:scale-[1.03]'
                        style={{
                            backgroundColor: workspace.color ?? DEFAULT_WORKSPACE_COLOR,
                            boxShadow: `0 4px 10px ${workspace.color ? `${workspace.color}25` : 'rgba(0,0,0,0.06)'}`
                        }}>
                        <FolderKanban className='h-4 w-4' />
                    </span>
                    <span className='min-w-0 flex-1'>
                        <span className='flex min-w-0 items-center gap-1.5'>
                            <span className='text-foreground truncate text-sm font-semibold tracking-wide' data-i18n-skip='true'>
                                {displayName}
                            </span>
                            {active && <Check className='text-primary h-3.5 w-3.5 shrink-0' />}
                        </span>
                        <span className='text-muted-foreground/75 block truncate text-[11px] font-medium mt-0.5'>
                            {t('creativeWorkspaces.stats.compact', {
                                images: stats.imageHistoryCount,
                                vision: stats.visionTextHistoryCount,
                                video: stats.videoHistoryCount
                            })}
                        </span>
                    </span>
                </button>
                {renderWorkspaceActions(workspace)}
            </article>
        );
    };

    return (
        <div className='flex h-full min-h-0 flex-col bg-background text-foreground'>
            <div className='border-b border-border/30 shrink-0 p-4 bg-background'>
                <div className='flex min-w-0 items-center gap-2.5'>
                    <div className='relative min-w-0 flex-1'>
                        <Search className='text-muted-foreground/50 pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2' />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={t('creativeWorkspaces.search.placeholder')}
                            className='h-9.5 pl-9 rounded-xl border-0 bg-slate-100/50 hover:bg-slate-100/80 dark:bg-slate-900/35 dark:hover:bg-slate-900/50 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary/20 transition-all duration-200'
                        />
                    </div>
                    {/* 一体化双段视图切换 */}
                    <div className='flex items-center gap-0.5 bg-slate-100/50 dark:bg-slate-900/35 p-0.5 rounded-xl border-0 h-9.5 shrink-0'>
                        <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className={cn(
                                'h-8.5 w-8.5 rounded-lg cursor-pointer transition-all duration-200',
                                view === 'grid' 
                                    ? 'bg-background dark:bg-slate-800 text-foreground shadow-xs font-semibold' 
                                    : 'text-muted-foreground/60 hover:text-foreground hover:bg-transparent'
                            )}
                            aria-label={t('creativeWorkspaces.view.grid')}
                            onClick={() => setView('grid')}>
                            <Grid2X2 className='h-4 w-4' />
                        </Button>
                        <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className={cn(
                                'h-8.5 w-8.5 rounded-lg cursor-pointer transition-all duration-200',
                                view === 'list' 
                                    ? 'bg-background dark:bg-slate-800 text-foreground shadow-xs font-semibold' 
                                    : 'text-muted-foreground/60 hover:text-foreground hover:bg-transparent'
                            )}
                            aria-label={t('creativeWorkspaces.view.list')}
                            onClick={() => setView('list')}>
                            <List className='h-4 w-4' />
                        </Button>
                    </div>
                    <Button
                        type='button'
                        size='sm'
                        className='h-9.5 shrink-0 cursor-pointer rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-semibold shadow-xs transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]'
                        onClick={openCreateDialog}
                        title={t('creativeWorkspaces.action.new')}
                        aria-label={t('creativeWorkspaces.action.new')}>
                        <Plus className='h-4 w-4' />
                        <span className='ml-1 text-xs font-bold'>{t('creativeWorkspaces.action.new')}</span>
                    </Button>
                </div>
                {/* 胶囊化过滤器 */}
                <div className='mt-3 flex flex-wrap items-center justify-between gap-2.5'>
                    <div className='flex items-center gap-0.5 bg-slate-100/50 dark:bg-slate-900/35 p-0.5 rounded-xl border-0 h-8 shrink-0'>
                        {(['active', 'archived', 'all'] as const).map((value) => (
                            <Button
                                key={value}
                                type='button'
                                variant='ghost'
                                size='sm'
                                className={cn(
                                    'h-7 cursor-pointer rounded-lg px-3 text-xs font-semibold transition-all duration-200',
                                    statusFilter === value 
                                        ? 'bg-background dark:bg-slate-800 text-foreground shadow-xs' 
                                        : 'text-muted-foreground/80 hover:text-foreground'
                                )}
                                onClick={() => setStatusFilter(value)}>
                                {t(`creativeWorkspaces.filter.${value}`)}
                            </Button>
                        ))}
                    </div>
                    <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className={cn(
                            'h-8 cursor-pointer rounded-xl px-3 text-xs font-semibold border-0 transition-all duration-200 bg-slate-100/50 dark:bg-slate-900/35 text-muted-foreground/80 hover:text-foreground',
                            historyScope === ALL_CREATIVE_WORKSPACES_ID && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
                        )}
                        onClick={() => onHistoryScopeChange(ALL_CREATIVE_WORKSPACES_ID)}>
                        {t('creativeWorkspaces.scope.all')}
                    </Button>
                </div>
            </div>

            <div className='min-h-0 flex-1 overflow-y-auto px-4 py-3'>
                {filteredWorkspaces.length === 0 ? (
                    <div className='text-muted-foreground/60 flex min-h-[16rem] flex-col items-center justify-center gap-3.5 text-center animate-fade-in'>
                        <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100/60 dark:bg-slate-900/40 text-muted-foreground/40 shadow-xs'>
                            <FolderKanban className='h-5 w-5' />
                        </div>
                        <p className='text-xs font-bold tracking-wide'>{t('creativeWorkspaces.empty.title')}</p>
                    </div>
                ) : view === 'grid' && !compact ? (
                    <div className='grid grid-cols-1 gap-3.5 xl:grid-cols-2'>
                        {filteredWorkspaces.map(renderWorkspaceCard)}
                    </div>
                ) : (
                    <div className='flex flex-col bg-background'>{filteredWorkspaces.map(renderWorkspaceRow)}</div>
                )}
            </div>

            <Dialog
                open={dialog?.type === 'create' || dialog?.type === 'rename'}
                onOpenChange={(open) => {
                    if (!open) setDialog(null);
                }}>
                <DialogContent className='border-0 bg-background text-foreground sm:max-w-md rounded-2xl shadow-xl'>
                    <DialogHeader className='space-y-1.5'>
                        <DialogTitle className='text-lg font-bold tracking-wide'>
                            {dialog?.type === 'rename'
                                ? t('creativeWorkspaces.rename.title')
                                : t('creativeWorkspaces.create.title')}
                        </DialogTitle>
                        <DialogDescription className='text-xs text-muted-foreground/80 font-medium'>
                            {dialog?.type === 'rename'
                                ? t('creativeWorkspaces.rename.description')
                                : t('creativeWorkspaces.create.description')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className='space-y-4 py-2'>
                        <div className='space-y-1.5'>
                            <label className='text-xs font-bold text-muted-foreground/80 tracking-wide' htmlFor='creative-workspace-name'>
                                {t('creativeWorkspaces.field.name')}
                            </label>
                            <Input
                                id='creative-workspace-name'
                                value={nameDraft}
                                onChange={(event) => setNameDraft(event.target.value)}
                                placeholder={t('creativeWorkspaces.field.namePlaceholder')}
                                className='h-9.5 rounded-xl border-0 bg-slate-100/50 hover:bg-slate-100/80 dark:bg-slate-900/35 dark:hover:bg-slate-900/50 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary/20 transition-all duration-200 text-sm font-medium'
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <label className='text-xs font-bold text-muted-foreground/80 tracking-wide' htmlFor='creative-workspace-description'>
                                {t('creativeWorkspaces.field.description')}
                            </label>
                            <Textarea
                                id='creative-workspace-description'
                                value={descriptionDraft}
                                onChange={(event) => setDescriptionDraft(event.target.value)}
                                placeholder={t('creativeWorkspaces.field.descriptionPlaceholder')}
                                className='min-h-20 rounded-xl border-0 bg-slate-100/50 hover:bg-slate-100/80 dark:bg-slate-900/35 dark:hover:bg-slate-900/50 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary/20 transition-all duration-200 p-3 text-xs font-medium resize-none'
                            />
                        </div>
                        <div className='space-y-2'>
                            <span className='text-xs font-bold text-muted-foreground/80 tracking-wide block'>{t('creativeWorkspaces.field.color')}</span>
                            <div className='flex flex-wrap gap-2.5'>
                                {WORKSPACE_COLOR_PALETTE.map((color) => (
                                    <button
                                        key={color}
                                        type='button'
                                        className={cn(
                                            'ring-offset-background h-7.5 w-7.5 rounded-full border-0 focus:outline-none transition-all duration-300 relative scale-95 hover:scale-105 active:scale-95 cursor-pointer shadow-xs',
                                            colorDraft === color && 'scale-100 ring-2 ring-primary ring-offset-2 shadow-md'
                                        )}
                                        style={{ backgroundColor: color }}
                                        aria-label={color}
                                        onClick={() => setColorDraft(color)}
                                    />
                                ))}
                            </div>
                        </div>
                        {formError && <p className='text-destructive text-xs font-bold mt-1'>{formError}</p>}
                    </div>
                    <DialogFooter className='gap-2 sm:gap-0 mt-1'>
                        <Button type='button' variant='outline' className='h-9 rounded-xl font-semibold border-0 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors' onClick={() => setDialog(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button type='button' className='h-9 rounded-xl font-semibold bg-primary hover:bg-primary/95 text-primary-foreground shadow-xs transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]' onClick={handleSave}>
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={dialog?.type === 'delete'}
                onOpenChange={(open) => {
                    if (!open) setDialog(null);
                }}>
                <DialogContent className='border-0 bg-background text-foreground sm:max-w-lg rounded-2xl shadow-xl'>
                    <DialogHeader className='space-y-1.5'>
                        <DialogTitle className='text-lg font-bold tracking-wide'>{t('creativeWorkspaces.delete.title')}</DialogTitle>
                        <DialogDescription className='text-xs text-muted-foreground/80 font-medium'>
                            {dialog?.type === 'delete' && (
                                <>
                                    {t('creativeWorkspaces.delete.description')}{' '}
                                    <span className='font-bold text-foreground' data-i18n-skip='true'>
                                        {dialog.workspace.name}
                                    </span>
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    {dialog?.type === 'delete' && (
                        <div className='space-y-4 py-2'>
                            <div className='bg-red-500/5 border border-red-500/10 rounded-xl p-3 text-xs'>
                                <p className='text-muted-foreground font-semibold'>
                                    {t('creativeWorkspaces.delete.confirmPrompt')}
                                </p>
                                <p className='text-red-600 dark:text-red-400 mt-1.5 font-bold' data-i18n-skip='true'>
                                    {dialog.workspace.name}
                                </p>
                            </div>
                            <Input
                                value={deleteConfirmation}
                                onChange={(event) => setDeleteConfirmation(event.target.value)}
                                aria-label={t('creativeWorkspaces.delete.inputLabel')}
                                placeholder={t('creativeWorkspaces.delete.confirmPrompt')}
                                className='h-9.5 rounded-xl border-0 bg-slate-100/50 hover:bg-slate-100/80 dark:bg-slate-900/35 dark:hover:bg-slate-900/50 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary/20 transition-all duration-200 text-sm font-semibold'
                                data-i18n-skip='true'
                            />
                            {formError && <p className='text-destructive text-xs font-bold'>{formError}</p>}
                        </div>
                    )}
                    <DialogFooter className='gap-2 sm:gap-0 mt-1'>
                        <Button type='button' variant='outline' className='h-9 rounded-xl font-semibold border-0 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors' onClick={() => setDialog(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            disabled={
                                dialog?.type !== 'delete' ||
                                deleteConfirmation !== dialog.workspace.name ||
                                isDeleting
                            }
                            className='h-9 rounded-xl font-semibold shadow-xs transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]'
                            onClick={handleConfirmDelete}>
                            <Trash2 className='h-3.5 w-3.5 mr-1.5' />
                            <span>{t('creativeWorkspaces.delete.confirm')}</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
