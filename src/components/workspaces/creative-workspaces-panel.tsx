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
import { compareCreativeWorkspacesByDisplayOrder, getCreativeWorkspaceDisplayName } from '@/lib/creative-workspace-store';
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
    MoreHorizontal,
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
        description?: string
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

const WORKSPACE_COLORS = ['#2563eb', '#059669', '#dc2626', '#7c3aed', '#d97706', '#0891b2'];

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
    const [view, setView] = React.useState<'grid' | 'list'>('grid');
    const [statusFilter, setStatusFilter] = React.useState<'active' | 'archived' | 'all'>('active');
    const [dialog, setDialog] = React.useState<WorkspaceDialogState>(null);
    const [nameDraft, setNameDraft] = React.useState('');
    const [descriptionDraft, setDescriptionDraft] = React.useState('');
    const [colorDraft, setColorDraft] = React.useState(WORKSPACE_COLORS[0]);
    const [deleteConfirmation, setDeleteConfirmation] = React.useState('');
    const [formError, setFormError] = React.useState('');
    const [isDeleting, setIsDeleting] = React.useState(false);

    const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
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
        setColorDraft(WORKSPACE_COLORS[0]);
        setFormError('');
    };

    const openRenameDialog = (workspace: CreativeWorkspace) => {
        setDialog({ type: 'rename', workspace });
        setNameDraft(getDisplayName(workspace));
        setDescriptionDraft(workspace.description ?? '');
        setColorDraft(workspace.color ?? WORKSPACE_COLORS[0]);
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
            const result = onRenameWorkspace(dialog.workspace.id, nameDraft, descriptionDraft);
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
            <div className='flex shrink-0 flex-wrap items-center justify-end gap-1'>
                <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 cursor-pointer'
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
                    className='h-8 w-8 cursor-pointer'
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
                        className='text-muted-foreground hover:text-destructive h-8 w-8 cursor-pointer'
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

    const renderPinButton = (workspace: CreativeWorkspace) => {
        const pinned = Boolean(workspace.favorite);
        const pinLabel = pinned ? t('creativeWorkspaces.action.unpin') : t('creativeWorkspaces.action.pin');
        return (
            <Button
                type='button'
                variant='ghost'
                size='icon'
                className={cn(
                    'absolute top-2 right-2 z-10 h-8 w-8 cursor-pointer rounded-md transition-opacity',
                    pinned
                        ? 'text-amber-600 hover:bg-amber-500/12 hover:text-amber-700 dark:text-amber-200 dark:hover:bg-amber-400/10 dark:hover:text-amber-100'
                        : 'text-slate-500 hover:bg-accent hover:text-slate-700 dark:text-on-panel-faint dark:hover:text-foreground'
                )}
                aria-label={`${pinLabel} ${getDisplayName(workspace)}`}
                title={pinLabel}
                onClick={(event) => {
                    event.stopPropagation();
                    onToggleWorkspacePinned(workspace.id, !pinned);
                }}>
                <Pin className='h-3.5 w-3.5' />
            </Button>
        );
    };

    const renderWorkspaceCard = (workspace: CreativeWorkspace) => {
        const stats = getWorkspaceStats(workspace, statsByWorkspaceId);
        const active = workspace.id === activeWorkspaceId;
        const scopeActive = historyScope === workspace.id;
        const displayName = getDisplayName(workspace);
        return (
            <article
                key={workspace.id}
                className={cn(
                    'app-panel-subtle group relative flex min-w-0 flex-col gap-3 rounded-xl border p-3 text-left transition-[border-color,box-shadow]',
                    active && 'border-primary/45 bg-primary/5',
                    scopeActive && !active && 'border-primary/25'
                )}>
                {renderPinButton(workspace)}
                <button type='button' className='min-w-0 cursor-pointer text-left' onClick={() => onEnterWorkspace(workspace.id)}>
                    <div className='mb-2 flex items-start gap-2'>
                        <span
                            className='mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm'
                            style={{ backgroundColor: workspace.color ?? WORKSPACE_COLORS[0] }}>
                            <FolderKanban className='h-4 w-4' />
                        </span>
                        <span className='min-w-0 flex-1 pr-8'>
                            <span className='flex min-w-0 items-center gap-1.5'>
                                <span className='text-foreground block truncate text-sm font-semibold' data-i18n-skip='true'>
                                    {displayName}
                                </span>
                                {active && <Check className='text-primary h-3.5 w-3.5 shrink-0' />}
                            </span>
                            <span className='text-muted-foreground mt-0.5 block truncate text-xs' data-i18n-skip='true'>
                                {workspace.description || t('creativeWorkspaces.emptyDescription')}
                            </span>
                        </span>
                    </div>
                    <div className='text-muted-foreground grid grid-cols-2 gap-2 text-xs'>
                        <span>{t('creativeWorkspaces.stats.images', { count: stats.imageHistoryCount })}</span>
                        <span>{t('creativeWorkspaces.stats.vision', { count: stats.visionTextHistoryCount })}</span>
                        <span>{t('creativeWorkspaces.stats.video', { count: stats.videoHistoryCount })}</span>
                        <span>{t('creativeWorkspaces.stats.files', { count: stats.fileCount })}</span>
                    </div>
                </button>
                <div className='flex items-center justify-between gap-2'>
                    <Button
                        type='button'
                        variant={scopeActive ? 'default' : 'outline'}
                        size='sm'
                        className='h-8 min-w-0 flex-1 cursor-pointer'
                        onClick={() => onHistoryScopeChange(workspace.id)}>
                        {scopeActive ? t('creativeWorkspaces.scope.current') : t('creativeWorkspaces.scope.view')}
                    </Button>
                    {renderWorkspaceActions(workspace)}
                </div>
            </article>
        );
    };

    const renderWorkspaceRow = (workspace: CreativeWorkspace) => {
        const stats = getWorkspaceStats(workspace, statsByWorkspaceId);
        const active = workspace.id === activeWorkspaceId;
        const scopeActive = historyScope === workspace.id;
        const displayName = getDisplayName(workspace);
        return (
            <article
                key={workspace.id}
                className={cn(
                    'app-panel-subtle relative flex min-w-0 items-center gap-3 rounded-xl border p-2.5 pr-11',
                    active && 'border-primary/45 bg-primary/5'
                )}>
                {renderPinButton(workspace)}
                <button
                    type='button'
                    className='flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left'
                    onClick={() => onEnterWorkspace(workspace.id)}>
                    <span
                        className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white'
                        style={{ backgroundColor: workspace.color ?? WORKSPACE_COLORS[0] }}>
                        <FolderKanban className='h-4 w-4' />
                    </span>
                    <span className='min-w-0 flex-1'>
                            <span className='flex min-w-0 items-center gap-1.5'>
                                <span className='text-foreground truncate text-sm font-semibold' data-i18n-skip='true'>
                                    {displayName}
                                </span>
                                {active && <Check className='text-primary h-3.5 w-3.5 shrink-0' />}
                            </span>
                        <span className='text-muted-foreground block truncate text-xs'>
                            {t('creativeWorkspaces.stats.compact', {
                                images: stats.imageHistoryCount,
                                vision: stats.visionTextHistoryCount,
                                video: stats.videoHistoryCount
                            })}
                        </span>
                    </span>
                </button>
                <Button
                    type='button'
                    variant={scopeActive ? 'default' : 'outline'}
                    size='sm'
                    className='h-8 shrink-0 cursor-pointer'
                    onClick={() => onHistoryScopeChange(workspace.id)}>
                    {scopeActive ? t('creativeWorkspaces.scope.current') : t('creativeWorkspaces.scope.view')}
                </Button>
                {renderWorkspaceActions(workspace)}
            </article>
        );
    };

    return (
        <div className='flex h-full min-h-0 flex-col bg-background text-foreground'>
            <div className='border-border shrink-0 border-b p-3'>
                <div className='mb-3 flex items-start justify-between gap-2'>
                    <div className='min-w-0'>
                        <h3 className='truncate text-sm font-semibold'>{t('creativeWorkspaces.panel.title')}</h3>
                        <p className='text-muted-foreground truncate text-xs'>
                            {activeWorkspace ? (
                                <>
                                    {t('creativeWorkspaces.panel.activePrefix')}{' '}
                                    <span data-i18n-skip='true'>{getDisplayName(activeWorkspace)}</span>
                                </>
                            ) : (
                                t('creativeWorkspaces.panel.description')
                            )}
                        </p>
                    </div>
                    <Button type='button' size='sm' className='h-8 shrink-0 cursor-pointer' onClick={openCreateDialog}>
                        <Plus className='h-3.5 w-3.5' />
                        <span className='ml-1.5'>{t('creativeWorkspaces.action.new')}</span>
                    </Button>
                </div>
                <div className='flex min-w-0 items-center gap-2'>
                    <div className='relative min-w-0 flex-1'>
                        <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2' />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={t('creativeWorkspaces.search.placeholder')}
                            className='h-9 pl-8'
                        />
                    </div>
                    <Button
                        type='button'
                        variant={view === 'grid' ? 'default' : 'outline'}
                        size='icon'
                        className='h-9 w-9 shrink-0 cursor-pointer'
                        aria-label={t('creativeWorkspaces.view.grid')}
                        onClick={() => setView('grid')}>
                        <Grid2X2 className='h-4 w-4' />
                    </Button>
                    <Button
                        type='button'
                        variant={view === 'list' ? 'default' : 'outline'}
                        size='icon'
                        className='h-9 w-9 shrink-0 cursor-pointer'
                        aria-label={t('creativeWorkspaces.view.list')}
                        onClick={() => setView('list')}>
                        <List className='h-4 w-4' />
                    </Button>
                </div>
                <div className='mt-2 flex flex-wrap items-center gap-1.5'>
                    {(['active', 'archived', 'all'] as const).map((value) => (
                        <Button
                            key={value}
                            type='button'
                            variant={statusFilter === value ? 'secondary' : 'ghost'}
                            size='sm'
                            className='h-7 cursor-pointer rounded-lg px-2 text-xs'
                            onClick={() => setStatusFilter(value)}>
                            {t(`creativeWorkspaces.filter.${value}`)}
                        </Button>
                    ))}
                    <Button
                        type='button'
                        variant={historyScope === ALL_CREATIVE_WORKSPACES_ID ? 'default' : 'outline'}
                        size='sm'
                        className='ml-auto h-7 cursor-pointer rounded-lg px-2 text-xs'
                        onClick={() => onHistoryScopeChange(ALL_CREATIVE_WORKSPACES_ID)}>
                        {t('creativeWorkspaces.scope.all')}
                    </Button>
                </div>
            </div>

            <div className='min-h-0 flex-1 overflow-y-auto p-3'>
                {filteredWorkspaces.length === 0 ? (
                    <div className='text-muted-foreground flex min-h-[12rem] flex-col items-center justify-center gap-2 text-center'>
                        <MoreHorizontal className='h-5 w-5' />
                        <p className='text-sm'>{t('creativeWorkspaces.empty.title')}</p>
                    </div>
                ) : view === 'grid' && !compact ? (
                    <div className='grid grid-cols-1 gap-3 xl:grid-cols-2'>
                        {filteredWorkspaces.map(renderWorkspaceCard)}
                    </div>
                ) : (
                    <div className='space-y-2'>{filteredWorkspaces.map(renderWorkspaceRow)}</div>
                )}
            </div>

            <Dialog
                open={dialog?.type === 'create' || dialog?.type === 'rename'}
                onOpenChange={(open) => {
                    if (!open) setDialog(null);
                }}>
                <DialogContent className='border-border bg-background text-foreground sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>
                            {dialog?.type === 'rename'
                                ? t('creativeWorkspaces.rename.title')
                                : t('creativeWorkspaces.create.title')}
                        </DialogTitle>
                        <DialogDescription>
                            {dialog?.type === 'rename'
                                ? t('creativeWorkspaces.rename.description')
                                : t('creativeWorkspaces.create.description')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className='space-y-3'>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium' htmlFor='creative-workspace-name'>
                                {t('creativeWorkspaces.field.name')}
                            </label>
                            <Input
                                id='creative-workspace-name'
                                value={nameDraft}
                                onChange={(event) => setNameDraft(event.target.value)}
                                placeholder={t('creativeWorkspaces.field.namePlaceholder')}
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium' htmlFor='creative-workspace-description'>
                                {t('creativeWorkspaces.field.description')}
                            </label>
                            <Textarea
                                id='creative-workspace-description'
                                value={descriptionDraft}
                                onChange={(event) => setDescriptionDraft(event.target.value)}
                                placeholder={t('creativeWorkspaces.field.descriptionPlaceholder')}
                                className='min-h-20'
                            />
                        </div>
                        {dialog?.type === 'create' && (
                            <div className='space-y-1.5'>
                                <span className='text-sm font-medium'>{t('creativeWorkspaces.field.color')}</span>
                                <div className='flex flex-wrap gap-2'>
                                    {WORKSPACE_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type='button'
                                            className={cn(
                                                'ring-offset-background h-7 w-7 rounded-full border border-border focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none',
                                                colorDraft === color && 'ring-2 ring-ring ring-offset-2'
                                            )}
                                            style={{ backgroundColor: color }}
                                            aria-label={color}
                                            onClick={() => setColorDraft(color)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                        {formError && <p className='text-destructive text-sm'>{formError}</p>}
                    </div>
                    <DialogFooter>
                        <Button type='button' variant='outline' onClick={() => setDialog(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button type='button' onClick={handleSave}>
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
                <DialogContent className='border-border bg-background text-foreground sm:max-w-lg'>
                    <DialogHeader>
                        <DialogTitle>{t('creativeWorkspaces.delete.title')}</DialogTitle>
                        <DialogDescription>
                            {dialog?.type === 'delete' && (
                                <>
                                    {t('creativeWorkspaces.delete.description')}{' '}
                                    <span className='font-medium text-foreground' data-i18n-skip='true'>
                                        {dialog.workspace.name}
                                    </span>
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    {dialog?.type === 'delete' && (
                        <div className='space-y-3'>
                            <div className='app-panel-subtle rounded-xl border p-3 text-sm'>
                                <p className='text-muted-foreground'>
                                    {t('creativeWorkspaces.delete.confirmPrompt')}
                                </p>
                                <p className='text-foreground mt-1 font-medium' data-i18n-skip='true'>
                                    {dialog.workspace.name}
                                </p>
                            </div>
                            <Input
                                value={deleteConfirmation}
                                onChange={(event) => setDeleteConfirmation(event.target.value)}
                                aria-label={t('creativeWorkspaces.delete.inputLabel')}
                                data-i18n-skip='true'
                            />
                            {formError && <p className='text-destructive text-sm'>{formError}</p>}
                        </div>
                    )}
                    <DialogFooter>
                        <Button type='button' variant='outline' onClick={() => setDialog(null)}>
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
                            onClick={handleConfirmDelete}>
                            <Trash2 className='h-3.5 w-3.5' />
                            <span className='ml-1.5'>{t('creativeWorkspaces.delete.confirm')}</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
