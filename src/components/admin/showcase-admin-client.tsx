'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { useNotice } from '@/components/notice-provider';
import { ShowcaseTopicDetail } from '@/components/showcase/showcase-detail';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { translateMessage } from '@/lib/i18n/translator';
import type { ShowcaseAdminTopic, ShowcasePublicationSummary, ShowcaseTopicDraft } from '@/lib/server/showcase/types';
import type { ShowcaseCatalog } from '@/lib/showcase';
import { setShowcaseRecipeOutputQuality, setShowcaseRecipeOutputSize } from '@/lib/showcase-admin-draft';
import { cn } from '@/lib/utils';
import {
    Archive,
    CheckCircle2,
    Copy,
    Eye,
    Loader2,
    Plus,
    RefreshCw,
    Rocket,
    RotateCcw,
    Save,
    Search,
    Sparkles,
    StopCircle
} from 'lucide-react';
import * as React from 'react';

type ShowcaseAdminClientProps = {
    initialTopics: ShowcaseAdminTopic[];
    initialActorRole: string;
    defaultDraft: ShowcaseTopicDraft;
};

type TopicDetailPayload = {
    topic: ShowcaseAdminTopic;
    publications: ShowcasePublicationSummary[];
};

type ConfirmAction =
    | { kind: 'publish'; topic: ShowcaseAdminTopic }
    | { kind: 'unpublish'; topic: ShowcaseAdminTopic }
    | { kind: 'archive'; topic: ShowcaseAdminTopic }
    | { kind: 'rollback'; topic: ShowcaseAdminTopic; publication: ShowcasePublicationSummary };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        ...init,
        headers: {
            ...(init?.body ? { 'content-type': 'application/json' } : {}),
            ...(init?.headers ?? {})
        }
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
        const message =
            payload &&
            typeof payload === 'object' &&
            'error' in payload &&
            typeof (payload as { error?: unknown }).error === 'string'
                ? (payload as { error: string }).error
                : 'Operation failed.';
        throw new Error(message);
    }
    return payload as T;
}

function formatJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

function toDateTimeLocal(value: number | null): string {
    if (!value) return '';
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

function StatusBadge({ status }: { status: ShowcaseAdminTopic['status'] }) {
    const { t } = useAppLanguage();
    const tone =
        status === 'published'
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : status === 'scheduled'
              ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
              : status === 'archived'
                ? 'bg-muted text-muted-foreground'
                : status === 'unpublished'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  : 'bg-violet-500/10 text-violet-700 dark:text-violet-300';
    return (
        <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-xs font-medium', tone)}>
            {t(`admin.showcases.status.${status}`)}
        </span>
    );
}

function replaceDraftIdentity(draft: ShowcaseTopicDraft, suffix: string): ShowcaseTopicDraft {
    const oldTopicId = draft.topic.id;
    const topicId = `${oldTopicId}-${suffix}`;
    const caseIdMap = new Map(draft.cases.map((item) => [item.id, `${item.id}-${suffix}`]));
    const assetIdMap = new Map(draft.assets.map((item) => [item.id, `${item.id}-${suffix}`]));
    return {
        topic: {
            ...draft.topic,
            id: topicId,
            slug: `${draft.topic.slug}-${suffix}`,
            coverAssetId: assetIdMap.get(draft.topic.coverAssetId) ?? draft.topic.coverAssetId,
            caseIds: draft.topic.caseIds.map((id) => caseIdMap.get(id) ?? id)
        },
        cases: draft.cases.map((item) => ({
            ...item,
            id: caseIdMap.get(item.id) ?? item.id,
            topicId,
            coverAssetId: assetIdMap.get(item.coverAssetId) ?? item.coverAssetId,
            inputAssetIds: item.inputAssetIds.map((id) => assetIdMap.get(id) ?? id),
            outputAssetIds: item.outputAssetIds.map((id) => assetIdMap.get(id) ?? id)
        })),
        assets: draft.assets.map((item) => ({ ...item, id: assetIdMap.get(item.id) ?? item.id }))
    };
}

function parseTagLines(value: string): ShowcaseTopicDraft['topic']['tags'] {
    return value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [zhCN = '', enUS = zhCN] = line.split('|').map((part) => part.trim());
            return { 'zh-CN': zhCN, 'en-US': enUS || zhCN };
        });
}

function stringifyTagLines(tags: ShowcaseTopicDraft['topic']['tags']): string {
    return tags.map((tag) => `${tag['zh-CN']} | ${tag['en-US']}`).join('\n');
}

export function ShowcaseAdminClient({ initialTopics, initialActorRole, defaultDraft }: ShowcaseAdminClientProps) {
    const { t, formatDateTime } = useAppLanguage();
    const { addNotice } = useNotice();
    const canWrite = initialActorRole === 'owner' || initialActorRole === 'admin';
    const [topics, setTopics] = React.useState(initialTopics);
    const [selectedId, setSelectedId] = React.useState(initialTopics[0]?.id ?? '');
    const [detail, setDetail] = React.useState<TopicDetailPayload | null>(null);
    const [draftJson, setDraftJson] = React.useState(() =>
        formatJson(initialTopics[0]?.draft ?? replaceDraftIdentity(defaultDraft, 'custom'))
    );
    const [startsAt, setStartsAt] = React.useState(() => toDateTimeLocal(initialTopics[0]?.startsAt ?? null));
    const [endsAt, setEndsAt] = React.useState(() => toDateTimeLocal(initialTopics[0]?.endsAt ?? null));
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<'all' | ShowcaseAdminTopic['status']>('all');
    const [isCreating, setIsCreating] = React.useState(initialTopics.length === 0);
    const [busyKey, setBusyKey] = React.useState('');
    const [jsonError, setJsonError] = React.useState('');
    const [previewCatalog, setPreviewCatalog] = React.useState<ShowcaseCatalog | null>(null);
    const [confirmAction, setConfirmAction] = React.useState<ConfirmAction | null>(null);
    const [editorTab, setEditorTab] = React.useState<'structured' | 'advanced'>('structured');

    const selectedTopic = topics.find((topic) => topic.id === selectedId) ?? null;

    const filteredTopics = React.useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        return topics.filter((topic) => {
            if (statusFilter !== 'all' && topic.status !== statusFilter) return false;
            if (!query) return true;
            const searchable = [
                topic.id,
                topic.slug,
                topic.draft.topic.title['zh-CN'],
                topic.draft.topic.title['en-US'],
                ...topic.draft.topic.tags.flatMap((tag) => [tag['zh-CN'], tag['en-US']])
            ]
                .join(' ')
                .toLocaleLowerCase();
            return searchable.includes(query);
        });
    }, [search, statusFilter, topics]);

    const loadDetail = React.useCallback(async (id: string) => {
        const payload = await requestJson<TopicDetailPayload>(`/api/admin/showcases/${encodeURIComponent(id)}`);
        setDetail(payload);
        setDraftJson(formatJson(payload.topic.draft));
        setStartsAt(toDateTimeLocal(payload.topic.startsAt));
        setEndsAt(toDateTimeLocal(payload.topic.endsAt));
        return payload;
    }, []);

    React.useEffect(() => {
        if (!selectedId || isCreating) return;
        setBusyKey('load');
        void loadDetail(selectedId)
            .catch((error) =>
                addNotice(error instanceof Error ? error.message : t('admin.showcases.notice.failed'), 'error')
            )
            .finally(() => setBusyKey(''));
    }, [addNotice, isCreating, loadDetail, selectedId, t]);

    const refreshTopics = React.useCallback(async () => {
        const payload = await requestJson<{ topics: ShowcaseAdminTopic[] }>('/api/admin/showcases');
        setTopics(payload.topics);
        return payload.topics;
    }, []);

    const handleRefresh = async () => {
        if (busyKey) return;
        setBusyKey('refresh');
        try {
            const next = await refreshTopics();
            if (!isCreating && selectedId && next.some((item) => item.id === selectedId)) {
                await loadDetail(selectedId);
            }
        } catch (error) {
            addNotice(error instanceof Error ? error.message : t('admin.showcases.notice.failed'), 'error');
        } finally {
            setBusyKey('');
        }
    };

    const selectTopic = (topic: ShowcaseAdminTopic) => {
        setIsCreating(false);
        setSelectedId(topic.id);
        setPreviewCatalog(null);
        setJsonError('');
    };

    const startCreate = () => {
        const suffix = Date.now().toString(36).slice(-6);
        setIsCreating(true);
        setSelectedId('');
        setDetail(null);
        setPreviewCatalog(null);
        setJsonError('');
        setDraftJson(formatJson(replaceDraftIdentity(defaultDraft, suffix)));
        setStartsAt('');
        setEndsAt('');
    };

    const startCopy = () => {
        if (!selectedTopic) return;
        const suffix = Date.now().toString(36).slice(-6);
        setIsCreating(true);
        setSelectedId('');
        setDetail(null);
        setPreviewCatalog(null);
        setJsonError('');
        setDraftJson(formatJson(replaceDraftIdentity(selectedTopic.draft, suffix)));
        setStartsAt('');
        setEndsAt('');
        setEditorTab('structured');
    };

    const parseDraft = (): ShowcaseTopicDraft | null => {
        try {
            const value = JSON.parse(draftJson) as ShowcaseTopicDraft;
            setJsonError('');
            return value;
        } catch (error) {
            const message = error instanceof Error ? error.message : t('admin.showcases.editor.invalidJson');
            setJsonError(message);
            return null;
        }
    };

    const saveDraft = async () => {
        const draft = parseDraft();
        if (!draft || busyKey || !canWrite) return;
        setBusyKey('save');
        try {
            const payload = {
                draft,
                startsAt: startsAt ? new Date(startsAt).toISOString() : null,
                endsAt: endsAt ? new Date(endsAt).toISOString() : null
            };
            const response = await requestJson<{ topic: ShowcaseAdminTopic }>(
                isCreating ? '/api/admin/showcases' : `/api/admin/showcases/${encodeURIComponent(selectedId)}`,
                { method: isCreating ? 'POST' : 'PUT', body: JSON.stringify(payload) }
            );
            const nextTopics = await refreshTopics();
            setIsCreating(false);
            setSelectedId(response.topic.id);
            await loadDetail(response.topic.id);
            if (!nextTopics.some((item) => item.id === response.topic.id)) {
                setTopics((items) => [response.topic, ...items]);
            }
            addNotice(t(isCreating ? 'admin.showcases.notice.created' : 'admin.showcases.notice.saved'), 'success');
        } catch (error) {
            addNotice(error instanceof Error ? error.message : t('admin.showcases.notice.failed'), 'error');
        } finally {
            setBusyKey('');
        }
    };

    const previewDraft = async () => {
        const draft = parseDraft();
        if (!draft || busyKey) return;
        setBusyKey('preview');
        try {
            if (isCreating) {
                setPreviewCatalog({
                    schemaVersion: 1,
                    catalogRevision: 'admin-local-preview',
                    generatedAt: Date.now(),
                    contentNotice: {
                        'zh-CN': translateMessage('zh-CN', 'admin.showcases.localPreviewNotice'),
                        'en-US': translateMessage('en-US', 'admin.showcases.localPreviewNotice')
                    },
                    topics: [draft.topic],
                    cases: draft.cases,
                    assets: draft.assets
                });
            } else {
                const payload = await requestJson<{ catalog: ShowcaseCatalog }>(
                    `/api/admin/showcases/${encodeURIComponent(selectedId)}/preview`
                );
                setPreviewCatalog(payload.catalog);
            }
        } catch (error) {
            addNotice(error instanceof Error ? error.message : t('admin.showcases.notice.failed'), 'error');
        } finally {
            setBusyKey('');
        }
    };

    const executeConfirmedAction = async () => {
        if (!confirmAction || busyKey || !canWrite) return;
        const action = confirmAction;
        const id = action.topic.id;
        setBusyKey(action.kind);
        try {
            if (action.kind === 'archive') {
                await requestJson(`/api/admin/showcases/${encodeURIComponent(id)}`, { method: 'DELETE' });
            } else if (action.kind === 'rollback') {
                await requestJson(`/api/admin/showcases/${encodeURIComponent(id)}/rollback`, {
                    method: 'POST',
                    body: JSON.stringify({ publicationId: action.publication.id })
                });
            } else {
                await requestJson(`/api/admin/showcases/${encodeURIComponent(id)}/${action.kind}`, { method: 'POST' });
            }
            const next = await refreshTopics();
            const refreshed = next.find((item) => item.id === id);
            if (refreshed && action.kind !== 'archive') {
                setSelectedId(id);
                await loadDetail(id);
            } else if (action.kind === 'archive') {
                setSelectedId(next.find((item) => item.status !== 'archived')?.id ?? next[0]?.id ?? '');
            }
            addNotice(t(`admin.showcases.notice.${action.kind}`), 'success');
            setConfirmAction(null);
        } catch (error) {
            addNotice(error instanceof Error ? error.message : t('admin.showcases.notice.failed'), 'error');
        } finally {
            setBusyKey('');
        }
    };

    const parsedDraft = React.useMemo(() => {
        try {
            return JSON.parse(draftJson) as ShowcaseTopicDraft;
        } catch {
            return null;
        }
    }, [draftJson]);

    const updateStructuredDraft = (mutate: (draft: ShowcaseTopicDraft) => ShowcaseTopicDraft) => {
        if (!parsedDraft) return;
        setDraftJson(formatJson(mutate(parsedDraft)));
        setJsonError('');
    };

    const updateTopicText = (field: keyof ShowcaseTopicDraft['topic'], language: 'zh-CN' | 'en-US', value: string) => {
        updateStructuredDraft((draft) => ({
            ...draft,
            topic: {
                ...draft.topic,
                [field]: {
                    ...(draft.topic[field] as Record<string, string>),
                    [language]: value
                }
            }
        }));
    };

    return (
        <section className='space-y-6'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
                <div>
                    <Heading level={1} size='section'>
                        {t('admin.showcases.title')}
                    </Heading>
                    <p className='text-muted-foreground mt-1 max-w-3xl text-sm'>{t('admin.showcases.description')}</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={() => void handleRefresh()}
                        disabled={Boolean(busyKey)}>
                        <RefreshCw className={cn('h-4 w-4', busyKey === 'refresh' && 'animate-spin')} />
                        {t('admin.showcases.refresh')}
                    </Button>
                    <Button size='sm' onClick={startCreate} disabled={!canWrite || Boolean(busyKey)}>
                        <Plus className='h-4 w-4' />
                        {t('admin.showcases.new')}
                    </Button>
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={startCopy}
                        disabled={!canWrite || !selectedTopic || isCreating || Boolean(busyKey)}>
                        <Copy className='h-4 w-4' />
                        {t('admin.showcases.copy')}
                    </Button>
                </div>
            </div>

            {!canWrite ? (
                <div className='rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-700 dark:text-sky-300'>
                    {t('admin.showcases.viewerNotice')}
                </div>
            ) : null}

            <div className='grid min-w-0 gap-5 xl:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.55fr)]'>
                <Card className='min-w-0 gap-4 py-4'>
                    <CardHeader className='px-4'>
                        <CardTitle>{t('admin.showcases.list.title')}</CardTitle>
                        <CardDescription>
                            {t('admin.showcases.list.description', { count: topics.length })}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-3 px-4'>
                        <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem] xl:grid-cols-1'>
                            <label className='border-input bg-background flex h-9 items-center gap-2 rounded-md border px-3'>
                                <Search className='text-muted-foreground h-4 w-4 shrink-0' />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder={t('admin.showcases.search')}
                                    className='min-w-0 flex-1 bg-transparent text-sm outline-none'
                                />
                            </label>
                            <select
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value as 'all' | ShowcaseAdminTopic['status'])
                                }
                                className='border-input bg-background h-9 rounded-md border px-3 text-sm'>
                                <option value='all'>{t('admin.showcases.status.all')}</option>
                                {(['draft', 'scheduled', 'published', 'unpublished', 'archived'] as const).map(
                                    (status) => (
                                        <option key={status} value={status}>
                                            {t(`admin.showcases.status.${status}`)}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>
                        <div className='max-h-[70vh] space-y-2 overflow-y-auto pr-1'>
                            {filteredTopics.map((topic) => (
                                <button
                                    key={topic.id}
                                    type='button'
                                    onClick={() => selectTopic(topic)}
                                    className={cn(
                                        'border-border bg-card hover:bg-muted/50 focus-visible:ring-ring/50 w-full rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                                        !isCreating && selectedId === topic.id && 'border-primary bg-primary/5'
                                    )}>
                                    <div className='flex items-start justify-between gap-2'>
                                        <div className='min-w-0'>
                                            <p className='truncate text-sm font-semibold' data-i18n-skip='true'>
                                                {topic.draft.topic.title['zh-CN']}
                                            </p>
                                            <p
                                                className='text-muted-foreground mt-0.5 truncate text-xs'
                                                data-i18n-skip='true'>
                                                {topic.slug}
                                            </p>
                                        </div>
                                        <StatusBadge status={topic.status} />
                                    </div>
                                    <div className='text-muted-foreground mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs'>
                                        <span>
                                            {t('admin.showcases.caseCount', { count: topic.draft.cases.length })}
                                        </span>
                                        <span>
                                            {t('admin.showcases.draftRevision', { revision: topic.draftRevision })}
                                        </span>
                                        <span>{formatDateTime(topic.updatedAt)}</span>
                                    </div>
                                </button>
                            ))}
                            {filteredTopics.length === 0 ? (
                                <div className='border-border text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm'>
                                    {t('admin.showcases.list.empty')}
                                </div>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>

                <div className='min-w-0 space-y-5'>
                    <Card className='min-w-0 gap-4 py-4'>
                        <CardHeader className='px-4 sm:px-6'>
                            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                                <div className='min-w-0'>
                                    <CardTitle>
                                        {isCreating
                                            ? t('admin.showcases.editor.createTitle')
                                            : t('admin.showcases.editor.editTitle')}
                                    </CardTitle>
                                    <CardDescription className='mt-1'>
                                        {t('admin.showcases.editor.description')}
                                    </CardDescription>
                                </div>
                                {selectedTopic && !isCreating ? <StatusBadge status={selectedTopic.status} /> : null}
                            </div>
                        </CardHeader>
                        <CardContent className='space-y-4 px-4 sm:px-6'>
                            <div className='grid gap-3 sm:grid-cols-2'>
                                <label className='space-y-1.5 text-sm'>
                                    <span className='font-medium'>{t('admin.showcases.startsAt')}</span>
                                    <Input
                                        type='datetime-local'
                                        value={startsAt}
                                        disabled={!canWrite}
                                        onChange={(event) => setStartsAt(event.target.value)}
                                    />
                                </label>
                                <label className='space-y-1.5 text-sm'>
                                    <span className='font-medium'>{t('admin.showcases.endsAt')}</span>
                                    <Input
                                        type='datetime-local'
                                        value={endsAt}
                                        disabled={!canWrite}
                                        onChange={(event) => setEndsAt(event.target.value)}
                                    />
                                </label>
                            </div>
                            <Tabs
                                value={editorTab}
                                onValueChange={(value) =>
                                    setEditorTab(value === 'advanced' ? 'advanced' : 'structured')
                                }>
                                <div className='flex flex-wrap items-center justify-between gap-3'>
                                    <TabsList className='w-full sm:w-auto'>
                                        <TabsTrigger value='structured'>
                                            {t('admin.showcases.editor.structured')}
                                        </TabsTrigger>
                                        <TabsTrigger value='advanced'>
                                            {t('admin.showcases.editor.advanced')}
                                        </TabsTrigger>
                                    </TabsList>
                                    <div className='text-muted-foreground flex items-center gap-3 text-xs'>
                                        <span>
                                            {t('admin.showcases.caseCount', { count: parsedDraft?.cases.length ?? 0 })}
                                        </span>
                                        <span>
                                            {t('admin.showcases.assetCount', {
                                                count: parsedDraft?.assets.length ?? 0
                                            })}
                                        </span>
                                    </div>
                                </div>
                                <TabsContent value='structured' className='mt-3 space-y-4'>
                                    {parsedDraft ? (
                                        <>
                                            <div className='grid gap-3 sm:grid-cols-2'>
                                                <label className='space-y-1.5 text-sm'>
                                                    <span className='font-medium'>{t('admin.showcases.field.id')}</span>
                                                    <Input
                                                        name='showcase-topic-id'
                                                        autoComplete='off'
                                                        value={parsedDraft.topic.id}
                                                        disabled={!canWrite || !isCreating}
                                                        onChange={(event) =>
                                                            updateStructuredDraft((draft) => ({
                                                                ...draft,
                                                                topic: { ...draft.topic, id: event.target.value }
                                                            }))
                                                        }
                                                    />
                                                </label>
                                                <label className='space-y-1.5 text-sm'>
                                                    <span className='font-medium'>
                                                        {t('admin.showcases.field.slug')}
                                                    </span>
                                                    <Input
                                                        name='showcase-topic-slug'
                                                        autoComplete='off'
                                                        value={parsedDraft.topic.slug}
                                                        disabled={!canWrite}
                                                        onChange={(event) =>
                                                            updateStructuredDraft((draft) => ({
                                                                ...draft,
                                                                topic: { ...draft.topic, slug: event.target.value }
                                                            }))
                                                        }
                                                    />
                                                </label>
                                                <label className='space-y-1.5 text-sm'>
                                                    <span className='font-medium'>
                                                        {t('admin.showcases.field.sortOrder')}
                                                    </span>
                                                    <Input
                                                        name='showcase-topic-sort-order'
                                                        type='number'
                                                        min={0}
                                                        value={parsedDraft.topic.sortOrder}
                                                        disabled={!canWrite}
                                                        onChange={(event) =>
                                                            updateStructuredDraft((draft) => ({
                                                                ...draft,
                                                                topic: {
                                                                    ...draft.topic,
                                                                    sortOrder: Number(event.target.value) || 0
                                                                }
                                                            }))
                                                        }
                                                    />
                                                </label>
                                                <label className='border-border flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm sm:self-end'>
                                                    <Checkbox
                                                        checked={parsedDraft.topic.featured}
                                                        disabled={!canWrite}
                                                        onCheckedChange={(checked) =>
                                                            updateStructuredDraft((draft) => ({
                                                                ...draft,
                                                                topic: { ...draft.topic, featured: checked === true }
                                                            }))
                                                        }
                                                    />
                                                    <span>{t('admin.showcases.field.featured')}</span>
                                                </label>
                                            </div>

                                            <div className='grid gap-4 lg:grid-cols-2'>
                                                {(['zh-CN', 'en-US'] as const).map((locale) => (
                                                    <div
                                                        key={locale}
                                                        className='app-panel-subtle border-border space-y-3 rounded-xl border p-3'>
                                                        <p className='text-sm font-semibold'>
                                                            {t(`admin.showcases.language.${locale}`)}
                                                        </p>
                                                        {(
                                                            [
                                                                'title',
                                                                'summary',
                                                                'preparation',
                                                                'limitations',
                                                                'capabilities',
                                                                'suitableFor',
                                                                'unsuitableFor',
                                                                'recommendedInputQuality'
                                                            ] as const
                                                        ).map((field) => {
                                                            const value = parsedDraft.topic[field]?.[locale] ?? '';
                                                            const label = t(`admin.showcases.field.${field}`);
                                                            return field === 'title' ? (
                                                                <label
                                                                    key={field}
                                                                    className='block space-y-1.5 text-sm'>
                                                                    <span className='font-medium'>{label}</span>
                                                                    <Input
                                                                        name={`showcase-${field}-${locale}`}
                                                                        autoComplete='off'
                                                                        value={value}
                                                                        disabled={!canWrite}
                                                                        onChange={(event) =>
                                                                            updateTopicText(
                                                                                field,
                                                                                locale,
                                                                                event.target.value
                                                                            )
                                                                        }
                                                                    />
                                                                </label>
                                                            ) : (
                                                                <label
                                                                    key={field}
                                                                    className='block space-y-1.5 text-sm'>
                                                                    <span className='font-medium'>{label}</span>
                                                                    <Textarea
                                                                        name={`showcase-${field}-${locale}`}
                                                                        value={value}
                                                                        disabled={!canWrite}
                                                                        onChange={(event) =>
                                                                            updateTopicText(
                                                                                field,
                                                                                locale,
                                                                                event.target.value
                                                                            )
                                                                        }
                                                                        className='min-h-20'
                                                                    />
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                ))}
                                            </div>

                                            <label className='block space-y-1.5 text-sm'>
                                                <span className='font-medium'>{t('admin.showcases.field.tags')}</span>
                                                <Textarea
                                                    name='showcase-topic-tags'
                                                    value={stringifyTagLines(parsedDraft.topic.tags)}
                                                    disabled={!canWrite}
                                                    onChange={(event) =>
                                                        updateStructuredDraft((draft) => ({
                                                            ...draft,
                                                            topic: {
                                                                ...draft.topic,
                                                                tags: parseTagLines(event.target.value)
                                                            }
                                                        }))
                                                    }
                                                    className='min-h-24 font-mono text-xs'
                                                />
                                                <span className='text-muted-foreground block text-xs'>
                                                    {t('admin.showcases.field.tagsHint')}
                                                </span>
                                            </label>

                                            <div className='space-y-2'>
                                                <div>
                                                    <p className='text-sm font-medium'>
                                                        {t('admin.showcases.cases.title')}
                                                    </p>
                                                    <p className='text-muted-foreground text-xs'>
                                                        {t('admin.showcases.cases.description')}
                                                    </p>
                                                </div>
                                                {parsedDraft.cases.map((item, index) => (
                                                    <details
                                                        key={item.id}
                                                        className='border-border bg-panel-ghost rounded-xl border p-3'>
                                                        <summary className='cursor-pointer text-sm font-medium'>
                                                            {index + 1}.{' '}
                                                            <span data-i18n-skip='true'>
                                                                {item.title['zh-CN']} / {item.slug}
                                                            </span>
                                                        </summary>
                                                        <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                                                            <label className='space-y-1.5 text-sm'>
                                                                <span className='font-medium'>
                                                                    {t('admin.showcases.field.titleZh')}
                                                                </span>
                                                                <Input
                                                                    value={item.title['zh-CN']}
                                                                    disabled={!canWrite}
                                                                    onChange={(event) =>
                                                                        updateStructuredDraft((draft) => ({
                                                                            ...draft,
                                                                            cases: draft.cases.map((candidate) =>
                                                                                candidate.id === item.id
                                                                                    ? {
                                                                                          ...candidate,
                                                                                          title: {
                                                                                              ...candidate.title,
                                                                                              'zh-CN':
                                                                                                  event.target.value
                                                                                          }
                                                                                      }
                                                                                    : candidate
                                                                            )
                                                                        }))
                                                                    }
                                                                />
                                                            </label>
                                                            <label className='space-y-1.5 text-sm'>
                                                                <span className='font-medium'>
                                                                    {t('admin.showcases.field.titleEn')}
                                                                </span>
                                                                <Input
                                                                    value={item.title['en-US']}
                                                                    disabled={!canWrite}
                                                                    onChange={(event) =>
                                                                        updateStructuredDraft((draft) => ({
                                                                            ...draft,
                                                                            cases: draft.cases.map((candidate) =>
                                                                                candidate.id === item.id
                                                                                    ? {
                                                                                          ...candidate,
                                                                                          title: {
                                                                                              ...candidate.title,
                                                                                              'en-US':
                                                                                                  event.target.value
                                                                                          }
                                                                                      }
                                                                                    : candidate
                                                                            )
                                                                        }))
                                                                    }
                                                                />
                                                            </label>
                                                            <label className='space-y-1.5 text-sm sm:col-span-2'>
                                                                <span className='font-medium'>
                                                                    {t('admin.showcases.field.promptZh')}
                                                                </span>
                                                                <Textarea
                                                                    value={item.recipe.prompt['zh-CN']}
                                                                    disabled={!canWrite}
                                                                    className='min-h-28'
                                                                    onChange={(event) =>
                                                                        updateStructuredDraft((draft) => ({
                                                                            ...draft,
                                                                            cases: draft.cases.map((candidate) =>
                                                                                candidate.id === item.id
                                                                                    ? {
                                                                                          ...candidate,
                                                                                          recipe: {
                                                                                              ...candidate.recipe,
                                                                                              prompt: {
                                                                                                  ...candidate.recipe
                                                                                                      .prompt,
                                                                                                  'zh-CN':
                                                                                                      event.target.value
                                                                                              }
                                                                                          }
                                                                                      }
                                                                                    : candidate
                                                                            )
                                                                        }))
                                                                    }
                                                                />
                                                            </label>
                                                            <label className='space-y-1.5 text-sm sm:col-span-2'>
                                                                <span className='font-medium'>
                                                                    {t('admin.showcases.field.promptEn')}
                                                                </span>
                                                                <Textarea
                                                                    value={item.recipe.prompt['en-US']}
                                                                    disabled={!canWrite}
                                                                    className='min-h-28'
                                                                    onChange={(event) =>
                                                                        updateStructuredDraft((draft) => ({
                                                                            ...draft,
                                                                            cases: draft.cases.map((candidate) =>
                                                                                candidate.id === item.id
                                                                                    ? {
                                                                                          ...candidate,
                                                                                          recipe: {
                                                                                              ...candidate.recipe,
                                                                                              prompt: {
                                                                                                  ...candidate.recipe
                                                                                                      .prompt,
                                                                                                  'en-US':
                                                                                                      event.target.value
                                                                                              }
                                                                                          }
                                                                                      }
                                                                                    : candidate
                                                                            )
                                                                        }))
                                                                    }
                                                                />
                                                            </label>
                                                            <div className='text-muted-foreground text-xs sm:col-span-2'>
                                                                {t('admin.showcases.cases.slotSummary', {
                                                                    count: item.recipe.inputSlots.length
                                                                })}{' '}
                                                                ·{' '}
                                                                {t('admin.showcases.cases.assetSummary', {
                                                                    count:
                                                                        item.inputAssetIds.length +
                                                                        item.outputAssetIds.length
                                                                })}
                                                            </div>
                                                            <div className='space-y-2 sm:col-span-2'>
                                                                <p className='text-sm font-medium'>
                                                                    {t('admin.showcases.cases.slotsTitle')}
                                                                </p>
                                                                {item.recipe.inputSlots.map((slot) => (
                                                                    <div
                                                                        key={slot.id}
                                                                        className='border-border grid gap-2 rounded-lg border p-2 sm:grid-cols-2'>
                                                                        <label className='space-y-1 text-xs'>
                                                                            <span>
                                                                                {t('admin.showcases.field.slotLabelZh')}
                                                                            </span>
                                                                            <Input
                                                                                value={slot.label['zh-CN']}
                                                                                disabled={!canWrite}
                                                                                onChange={(event) =>
                                                                                    updateStructuredDraft((draft) => ({
                                                                                        ...draft,
                                                                                        cases: draft.cases.map(
                                                                                            (candidate) =>
                                                                                                candidate.id === item.id
                                                                                                    ? {
                                                                                                          ...candidate,
                                                                                                          recipe: {
                                                                                                              ...candidate.recipe,
                                                                                                              inputSlots:
                                                                                                                  candidate.recipe.inputSlots.map(
                                                                                                                      (
                                                                                                                          candidateSlot
                                                                                                                      ) =>
                                                                                                                          candidateSlot.id ===
                                                                                                                          slot.id
                                                                                                                              ? {
                                                                                                                                    ...candidateSlot,
                                                                                                                                    label: {
                                                                                                                                        ...candidateSlot.label,
                                                                                                                                        'zh-CN':
                                                                                                                                            event
                                                                                                                                                .target
                                                                                                                                                .value
                                                                                                                                    }
                                                                                                                                }
                                                                                                                              : candidateSlot
                                                                                                                  )
                                                                                                          }
                                                                                                      }
                                                                                                    : candidate
                                                                                        )
                                                                                    }))
                                                                                }
                                                                            />
                                                                        </label>
                                                                        <label className='space-y-1 text-xs'>
                                                                            <span>
                                                                                {t('admin.showcases.field.slotLabelEn')}
                                                                            </span>
                                                                            <Input
                                                                                value={slot.label['en-US']}
                                                                                disabled={!canWrite}
                                                                                onChange={(event) =>
                                                                                    updateStructuredDraft((draft) => ({
                                                                                        ...draft,
                                                                                        cases: draft.cases.map(
                                                                                            (candidate) =>
                                                                                                candidate.id === item.id
                                                                                                    ? {
                                                                                                          ...candidate,
                                                                                                          recipe: {
                                                                                                              ...candidate.recipe,
                                                                                                              inputSlots:
                                                                                                                  candidate.recipe.inputSlots.map(
                                                                                                                      (
                                                                                                                          candidateSlot
                                                                                                                      ) =>
                                                                                                                          candidateSlot.id ===
                                                                                                                          slot.id
                                                                                                                              ? {
                                                                                                                                    ...candidateSlot,
                                                                                                                                    label: {
                                                                                                                                        ...candidateSlot.label,
                                                                                                                                        'en-US':
                                                                                                                                            event
                                                                                                                                                .target
                                                                                                                                                .value
                                                                                                                                    }
                                                                                                                                }
                                                                                                                              : candidateSlot
                                                                                                                  )
                                                                                                          }
                                                                                                      }
                                                                                                    : candidate
                                                                                        )
                                                                                    }))
                                                                                }
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className='border-border grid gap-3 rounded-lg border p-3 sm:col-span-2 sm:grid-cols-3'>
                                                                <label className='space-y-1.5 text-sm'>
                                                                    <span className='font-medium'>
                                                                        {t('admin.showcases.field.outputSize')}
                                                                    </span>
                                                                    <Input
                                                                        value={item.recipe.output?.size ?? ''}
                                                                        disabled={!canWrite}
                                                                        placeholder='auto / 1024x1024'
                                                                        onChange={(event) =>
                                                                            updateStructuredDraft((draft) => ({
                                                                                ...draft,
                                                                                cases: draft.cases.map((candidate) =>
                                                                                    candidate.id === item.id
                                                                                        ? {
                                                                                              ...candidate,
                                                                                              recipe: {
                                                                                                  ...candidate.recipe,
                                                                                                  output: setShowcaseRecipeOutputSize(
                                                                                                      candidate.recipe
                                                                                                          .output,
                                                                                                      event.target.value
                                                                                                  )
                                                                                              }
                                                                                          }
                                                                                        : candidate
                                                                                )
                                                                            }))
                                                                        }
                                                                    />
                                                                </label>
                                                                <label className='space-y-1.5 text-sm'>
                                                                    <span className='font-medium'>
                                                                        {t('admin.showcases.field.outputQuality')}
                                                                    </span>
                                                                    <select
                                                                        value={item.recipe.output?.quality ?? ''}
                                                                        disabled={!canWrite}
                                                                        onChange={(event) =>
                                                                            updateStructuredDraft((draft) => ({
                                                                                ...draft,
                                                                                cases: draft.cases.map((candidate) =>
                                                                                    candidate.id === item.id
                                                                                        ? {
                                                                                              ...candidate,
                                                                                              recipe: {
                                                                                                  ...candidate.recipe,
                                                                                                  output: setShowcaseRecipeOutputQuality(
                                                                                                      candidate.recipe
                                                                                                          .output,
                                                                                                      event.target
                                                                                                          .value as
                                                                                                          | ''
                                                                                                          | 'low'
                                                                                                          | 'medium'
                                                                                                          | 'high'
                                                                                                          | 'auto'
                                                                                                  )
                                                                                              }
                                                                                          }
                                                                                        : candidate
                                                                                )
                                                                            }))
                                                                        }
                                                                        className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'>
                                                                        <option value=''>
                                                                            {t('showcase.recipe.auto')}
                                                                        </option>
                                                                        {(
                                                                            ['low', 'medium', 'high', 'auto'] as const
                                                                        ).map((value) => (
                                                                            <option key={value} value={value}>
                                                                                {t(`showcase.recipe.quality.${value}`)}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </label>
                                                                <label className='space-y-1.5 text-sm'>
                                                                    <span className='font-medium'>
                                                                        {t('admin.showcases.field.outputCount')}
                                                                    </span>
                                                                    <Input
                                                                        type='number'
                                                                        min={1}
                                                                        max={10}
                                                                        value={item.recipe.output?.n ?? 1}
                                                                        disabled={!canWrite}
                                                                        onChange={(event) =>
                                                                            updateStructuredDraft((draft) => ({
                                                                                ...draft,
                                                                                cases: draft.cases.map((candidate) =>
                                                                                    candidate.id === item.id
                                                                                        ? {
                                                                                              ...candidate,
                                                                                              recipe: {
                                                                                                  ...candidate.recipe,
                                                                                                  output: {
                                                                                                      ...(candidate
                                                                                                          .recipe
                                                                                                          .output ??
                                                                                                          {}),
                                                                                                      n:
                                                                                                          Number(
                                                                                                              event
                                                                                                                  .target
                                                                                                                  .value
                                                                                                          ) || 1
                                                                                                  }
                                                                                              }
                                                                                          }
                                                                                        : candidate
                                                                                )
                                                                            }))
                                                                        }
                                                                    />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    </details>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className='border-destructive/40 bg-destructive/5 text-destructive rounded-xl border p-4 text-sm'>
                                            {t('admin.showcases.editor.invalidJson')}
                                        </div>
                                    )}
                                </TabsContent>
                                <TabsContent value='advanced' className='mt-3 space-y-1.5'>
                                    <div>
                                        <p className='text-sm font-medium'>{t('admin.showcases.editor.jsonTitle')}</p>
                                        <p className='text-muted-foreground text-xs'>
                                            {t('admin.showcases.editor.jsonDescription')}
                                        </p>
                                    </div>
                                    <Textarea
                                        name='showcase-advanced-json'
                                        value={draftJson}
                                        onChange={(event) => setDraftJson(event.target.value)}
                                        disabled={!canWrite}
                                        spellCheck={false}
                                        data-i18n-skip='true'
                                        className='bg-panel-ghost min-h-[34rem] resize-y rounded-xl font-mono text-xs leading-5'
                                    />
                                    {jsonError ? <p className='text-destructive text-xs'>{jsonError}</p> : null}
                                </TabsContent>
                            </Tabs>
                            <div className='flex flex-wrap gap-2'>
                                <Button onClick={() => void saveDraft()} disabled={!canWrite || Boolean(busyKey)}>
                                    {busyKey === 'save' ? <Loader2 className='animate-spin' /> : <Save />}
                                    {t('admin.showcases.save')}
                                </Button>
                                <Button
                                    variant='outline'
                                    onClick={() => void previewDraft()}
                                    disabled={Boolean(busyKey)}>
                                    {busyKey === 'preview' ? <Loader2 className='animate-spin' /> : <Eye />}
                                    {t('admin.showcases.preview')}
                                </Button>
                                {selectedTopic && !isCreating ? (
                                    <>
                                        <Button
                                            variant='outline'
                                            onClick={() => setConfirmAction({ kind: 'publish', topic: selectedTopic })}
                                            disabled={!canWrite || Boolean(busyKey)}>
                                            <Rocket />
                                            {t('admin.showcases.publish')}
                                        </Button>
                                        {selectedTopic.publishedPublicationId ? (
                                            <Button
                                                variant='outline'
                                                onClick={() =>
                                                    setConfirmAction({ kind: 'unpublish', topic: selectedTopic })
                                                }
                                                disabled={!canWrite || Boolean(busyKey)}>
                                                <StopCircle />
                                                {t('admin.showcases.unpublish')}
                                            </Button>
                                        ) : null}
                                        <Button
                                            variant='outline'
                                            onClick={() => setConfirmAction({ kind: 'archive', topic: selectedTopic })}
                                            disabled={!canWrite || Boolean(busyKey)}>
                                            <Archive />
                                            {t('admin.showcases.archive')}
                                        </Button>
                                    </>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>

                    {detail && !isCreating ? (
                        <Card className='gap-4 py-4'>
                            <CardHeader className='px-4 sm:px-6'>
                                <CardTitle>{t('admin.showcases.publications.title')}</CardTitle>
                                <CardDescription>{t('admin.showcases.publications.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className='space-y-2 px-4 sm:px-6'>
                                {detail.publications.map((publication) => (
                                    <div
                                        key={publication.id}
                                        className='border-border bg-panel-ghost flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between'>
                                        <div className='min-w-0'>
                                            <div className='flex flex-wrap items-center gap-2'>
                                                <span className='font-medium'>
                                                    {t('admin.showcases.publications.revision', {
                                                        revision: publication.revision
                                                    })}
                                                </span>
                                                {publication.active ? (
                                                    <span className='inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300'>
                                                        <CheckCircle2 className='h-3 w-3' />
                                                        {t('admin.showcases.publications.active')}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p
                                                className='text-muted-foreground mt-1 truncate font-mono text-xs'
                                                data-i18n-skip='true'>
                                                {publication.catalogRevision}
                                            </p>
                                            <p className='text-muted-foreground mt-1 text-xs'>
                                                {formatDateTime(publication.publishedAt)}
                                            </p>
                                        </div>
                                        {!publication.active ? (
                                            <Button
                                                variant='outline'
                                                size='sm'
                                                disabled={!canWrite || Boolean(busyKey)}
                                                onClick={() =>
                                                    setConfirmAction({
                                                        kind: 'rollback',
                                                        topic: detail.topic,
                                                        publication
                                                    })
                                                }>
                                                <RotateCcw />
                                                {t('admin.showcases.rollback')}
                                            </Button>
                                        ) : null}
                                    </div>
                                ))}
                                {detail.publications.length === 0 ? (
                                    <div className='border-border text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm'>
                                        {t('admin.showcases.publications.empty')}
                                    </div>
                                ) : null}
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            </div>

            <Dialog open={Boolean(previewCatalog)} onOpenChange={(open) => !open && setPreviewCatalog(null)}>
                <DialogContent className='max-w-6xl p-0'>
                    <DialogHeader className='border-border border-b px-5 py-4 pr-14'>
                        <DialogTitle>{t('admin.showcases.previewTitle')}</DialogTitle>
                        <DialogDescription>{t('admin.showcases.previewDescription')}</DialogDescription>
                    </DialogHeader>
                    <div className='max-h-[75dvh] overflow-y-auto p-4 sm:p-6'>
                        {previewCatalog?.topics[0] ? (
                            <ShowcaseTopicDetail catalog={previewCatalog} topic={previewCatalog.topics[0]} />
                        ) : null}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {confirmAction ? t(`admin.showcases.confirm.${confirmAction.kind}.title`) : ''}
                        </DialogTitle>
                        <DialogDescription>
                            {confirmAction
                                ? t(`admin.showcases.confirm.${confirmAction.kind}.description`, {
                                      title: confirmAction.topic.draft.topic.title['zh-CN']
                                  })
                                : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setConfirmAction(null)} disabled={Boolean(busyKey)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={() => void executeConfirmedAction()} disabled={Boolean(busyKey)}>
                            {busyKey ? <Loader2 className='animate-spin' /> : <Sparkles />}
                            {t('admin.showcases.confirm.action')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
