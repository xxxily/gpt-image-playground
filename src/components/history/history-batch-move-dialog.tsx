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
import { ALL_CREATIVE_WORKSPACES_ID, type CreativeWorkspace } from '@/types/creative-workspace';
import { Check, FolderKanban, Plus, Search } from 'lucide-react';
import * as React from 'react';

type WorkspaceCreateResult = { ok: true; workspaceId?: string } | { ok: false; reason: string };

export type HistoryBatchMoveDialogProps = {
    open: boolean;
    selectedCount: number;
    workspaces: CreativeWorkspace[];
    currentWorkspaceScope: string;
    onOpenChange: (open: boolean) => void;
    onCreateWorkspace: (input: { name: string; description?: string; color?: string }) => WorkspaceCreateResult;
    onConfirmMove: (workspaceId: string) => void | Promise<void>;
};

function normalizeErrorMessage(reason: string, t: (key: string) => string): string {
    if (reason === 'empty') return t('creativeWorkspaces.error.emptyName');
    if (reason === 'duplicate') return t('creativeWorkspaces.error.duplicateName');
    if (reason === 'reserved') return t('creativeWorkspaces.error.reservedName');
    return reason;
}

export function HistoryBatchMoveDialog({
    open,
    selectedCount,
    workspaces,
    currentWorkspaceScope,
    onOpenChange,
    onCreateWorkspace,
    onConfirmMove
}: HistoryBatchMoveDialogProps) {
    const { t } = useAppLanguage();
    const [query, setQuery] = React.useState('');
    const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState('');
    const [showCreateForm, setShowCreateForm] = React.useState(false);
    const [nameDraft, setNameDraft] = React.useState('');
    const [descriptionDraft, setDescriptionDraft] = React.useState('');
    const [colorDraft, setColorDraft] = React.useState(DEFAULT_WORKSPACE_COLOR);
    const [formError, setFormError] = React.useState('');
    const [isMoving, setIsMoving] = React.useState(false);

    const defaultWorkspaceName = t('creativeWorkspaces.defaultName');
    const getDisplayName = React.useCallback(
        (workspace: CreativeWorkspace) => getCreativeWorkspaceDisplayName(workspace, defaultWorkspaceName),
        [defaultWorkspaceName]
    );

    const activeWorkspaces = React.useMemo(
        () => workspaces.filter((workspace) => workspace.status === 'active').sort(compareCreativeWorkspacesByDisplayOrder),
        [workspaces]
    );
    const candidateWorkspaces = React.useMemo(() => {
        if (activeWorkspaces.length <= 1) return [];
        if (currentWorkspaceScope === ALL_CREATIVE_WORKSPACES_ID) return activeWorkspaces;
        return activeWorkspaces.filter((workspace) => workspace.id !== currentWorkspaceScope);
    }, [activeWorkspaces, currentWorkspaceScope]);
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filteredWorkspaces = React.useMemo(() => {
        if (!normalizedQuery) return candidateWorkspaces;
        return candidateWorkspaces.filter((workspace) =>
            [getDisplayName(workspace), workspace.name, workspace.description]
                .filter(Boolean)
                .join(' ')
                .toLocaleLowerCase()
                .includes(normalizedQuery)
        );
    }, [candidateWorkspaces, getDisplayName, normalizedQuery]);

    React.useEffect(() => {
        if (!open) return;
        setQuery('');
        setShowCreateForm(false);
        setNameDraft('');
        setDescriptionDraft('');
        setColorDraft(DEFAULT_WORKSPACE_COLOR);
        setFormError('');
        setIsMoving(false);
        setSelectedWorkspaceId(candidateWorkspaces[0]?.id ?? '');
    }, [candidateWorkspaces, open]);

    React.useEffect(() => {
        if (!open || !selectedWorkspaceId) return;
        if (!candidateWorkspaces.some((workspace) => workspace.id === selectedWorkspaceId)) {
            setSelectedWorkspaceId(candidateWorkspaces[0]?.id ?? '');
        }
    }, [candidateWorkspaces, open, selectedWorkspaceId]);

    const handleCreateWorkspace = () => {
        const result = onCreateWorkspace({
            name: nameDraft,
            description: descriptionDraft,
            color: colorDraft
        });
        if (!result.ok) {
            setFormError(normalizeErrorMessage(result.reason, t));
            return;
        }
        setFormError('');
        setNameDraft('');
        setDescriptionDraft('');
        setColorDraft(DEFAULT_WORKSPACE_COLOR);
        setShowCreateForm(false);
        if (result.workspaceId) setSelectedWorkspaceId(result.workspaceId);
    };

    const handleConfirmMove = async () => {
        if (!selectedWorkspaceId || isMoving) return;
        setIsMoving(true);
        try {
            await onConfirmMove(selectedWorkspaceId);
            onOpenChange(false);
        } finally {
            setIsMoving(false);
        }
    };

    const selectedWorkspace = candidateWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId);
    const hasNoMoveTarget = candidateWorkspaces.length === 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='flex max-h-[min(720px,calc(100vh-2rem))] flex-col overflow-hidden sm:max-w-xl'>
                <DialogHeader>
                    <DialogTitle>{t('history.batchMove.title')}</DialogTitle>
                    <DialogDescription>
                        {t('history.batchMove.description', { count: selectedCount })}
                    </DialogDescription>
                </DialogHeader>

                <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-hidden'>
                    {hasNoMoveTarget && !showCreateForm ? (
                        <div className='app-panel-subtle rounded-xl border p-4'>
                            <div className='flex items-start gap-3'>
                                <span className='bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl'>
                                    <FolderKanban className='h-4 w-4' />
                                </span>
                                <div className='min-w-0 space-y-1'>
                                    <p className='text-sm font-semibold text-foreground'>
                                        {t('history.batchMove.emptyTargetTitle')}
                                    </p>
                                    <p className='text-sm leading-6 text-muted-foreground'>
                                        {t('history.batchMove.emptyTargetDescription')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className='relative'>
                                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                                <Input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder={t('history.batchMove.searchPlaceholder')}
                                    className='pl-9'
                                />
                            </div>
                            <div className='min-h-0 flex-1 space-y-2 overflow-y-auto pr-1'>
                                {filteredWorkspaces.length === 0 ? (
                                    <div className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
                                        {t('history.batchMove.noSearchResults')}
                                    </div>
                                ) : (
                                    filteredWorkspaces.map((workspace) => {
                                        const selected = workspace.id === selectedWorkspaceId;
                                        const displayName = getDisplayName(workspace);
                                        return (
                                            <button
                                                key={workspace.id}
                                                type='button'
                                                className={cn(
                                                    'app-panel-subtle flex w-full min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                                                    selected
                                                        ? 'border-primary/60 bg-primary/5'
                                                        : 'hover:border-primary/30 hover:bg-accent/50'
                                                )}
                                                aria-pressed={selected}
                                                onClick={() => setSelectedWorkspaceId(workspace.id)}>
                                                <span
                                                    className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white'
                                                    style={{ backgroundColor: workspace.color ?? DEFAULT_WORKSPACE_COLOR }}>
                                                    <FolderKanban className='h-4 w-4' />
                                                </span>
                                                <span className='min-w-0 flex-1'>
                                                    <span className='block truncate text-sm font-semibold text-foreground'>
                                                        {displayName}
                                                    </span>
                                                    <span className='mt-0.5 block truncate text-xs text-muted-foreground'>
                                                        {workspace.description || t('creativeWorkspaces.emptyDescription')}
                                                    </span>
                                                </span>
                                                {selected && <Check className='h-4 w-4 shrink-0 text-primary' />}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}

                    {showCreateForm && (
                        <div className='rounded-xl border bg-card/60 p-3'>
                            <div className='mb-3 flex items-center justify-between gap-2'>
                                <div>
                                    <p className='text-sm font-semibold text-foreground'>
                                        {t('creativeWorkspaces.create.title')}
                                    </p>
                                    <p className='text-xs text-muted-foreground'>
                                        {t('history.batchMove.createInlineDescription')}
                                    </p>
                                </div>
                                {!hasNoMoveTarget && (
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => setShowCreateForm(false)}>
                                        {t('common.cancel')}
                                    </Button>
                                )}
                            </div>
                            <div className='space-y-3'>
                                <Input
                                    value={nameDraft}
                                    onChange={(event) => setNameDraft(event.target.value)}
                                    placeholder={t('creativeWorkspaces.field.namePlaceholder')}
                                    aria-label={t('creativeWorkspaces.field.name')}
                                />
                                <Textarea
                                    value={descriptionDraft}
                                    onChange={(event) => setDescriptionDraft(event.target.value)}
                                    placeholder={t('creativeWorkspaces.field.descriptionPlaceholder')}
                                    aria-label={t('creativeWorkspaces.field.description')}
                                    rows={2}
                                />
                                <div className='flex flex-wrap gap-1.5'>
                                    {WORKSPACE_COLOR_PALETTE.map((color) => (
                                        <button
                                            key={color}
                                            type='button'
                                            className={cn(
                                                'h-6 w-6 rounded-full border transition-transform',
                                                colorDraft === color
                                                    ? 'scale-110 border-foreground ring-2 ring-primary/35'
                                                    : 'border-border'
                                            )}
                                            style={{ backgroundColor: color }}
                                            aria-label={`${t('creativeWorkspaces.field.color')} ${color}`}
                                            onClick={() => setColorDraft(color)}
                                        />
                                    ))}
                                </div>
                                {formError && <p className='text-sm text-destructive'>{formError}</p>}
                                <Button type='button' onClick={handleCreateWorkspace} className='w-full'>
                                    <Plus className='mr-2 h-4 w-4' />
                                    {t('history.batchMove.createWorkspace')}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className='gap-2 sm:justify-between'>
                    <Button type='button' variant='ghost' onClick={() => setShowCreateForm(true)}>
                        <Plus className='mr-2 h-4 w-4' />
                        {t('history.batchMove.newWorkspace')}
                    </Button>
                    <div className='flex gap-2'>
                        <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button type='button' onClick={handleConfirmMove} disabled={!selectedWorkspace || isMoving}>
                            {isMoving
                                ? t('history.batchMove.moving')
                                : t('history.batchMove.confirm', { count: selectedCount })}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
