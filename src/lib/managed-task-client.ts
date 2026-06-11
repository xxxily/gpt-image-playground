import type {
    ManagedTaskImportRequest,
    ManagedTaskImportResponse,
    ManagedTaskQueryRequest,
    ManagedTaskQueryResponse,
    ManagedTaskResolveRequest,
    ManagedTaskResolveResponse,
    ManagedTaskSubmitRequest,
    ManagedTaskSubmitResponse
} from '@/lib/managed-task-types';

type PendingStatusRequest = {
    taskServiceId: string;
    managedTaskId: string;
    passwordHash?: string;
    resolve: (value: ManagedTaskQueryResponse) => void;
    reject: (reason?: unknown) => void;
};

let pendingStatusRequests: PendingStatusRequest[] = [];
let pendingStatusFlushTimer: ReturnType<typeof setTimeout> | null = null;

async function postJson<TResponse>(url: string, body: unknown, signal?: AbortSignal): Promise<TResponse> {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal,
        cache: 'no-store'
    });
    const payload = (await response.json().catch(() => ({}))) as unknown;
    if (!response.ok) {
        const message =
            payload && typeof payload === 'object' && 'error' in payload
                ? String((payload as { error?: unknown }).error || `HTTP ${response.status}`)
                : `HTTP ${response.status}`;
        throw new Error(message);
    }
    return payload as TResponse;
}

export function resolveManagedTaskExecutionRequest(
    request: ManagedTaskResolveRequest,
    signal?: AbortSignal
): Promise<ManagedTaskResolveResponse> {
    return postJson<ManagedTaskResolveResponse>('/api/managed-tasks/resolve', request, signal);
}

export function submitManagedTaskRequest(
    request: ManagedTaskSubmitRequest,
    signal?: AbortSignal
): Promise<ManagedTaskSubmitResponse> {
    return postJson<ManagedTaskSubmitResponse>('/api/managed-tasks/submit', request, signal);
}

export function queryManagedTaskStatuses(
    request: ManagedTaskQueryRequest,
    signal?: AbortSignal
): Promise<ManagedTaskQueryResponse> {
    return postJson<ManagedTaskQueryResponse>('/api/managed-tasks/query', request, signal);
}

export function importManagedTaskResult(
    request: ManagedTaskImportRequest,
    signal?: AbortSignal
): Promise<ManagedTaskImportResponse> {
    return postJson<ManagedTaskImportResponse>('/api/managed-tasks/result', request, signal);
}

function flushPendingStatusRequests(): void {
    const pending = pendingStatusRequests;
    pendingStatusRequests = [];
    pendingStatusFlushTimer = null;

    const byService = new Map<string, PendingStatusRequest[]>();
    pending.forEach((request) => {
        const groupKey = `${request.taskServiceId}\u0000${request.passwordHash ?? ''}`;
        const group = byService.get(groupKey) ?? [];
        group.push(request);
        byService.set(groupKey, group);
    });

    byService.forEach((group) => {
        const first = group[0];
        if (!first) return;
        const taskIds = Array.from(new Set(group.map((request) => request.managedTaskId)));
        queryManagedTaskStatuses({
            tasks: taskIds.map((managedTaskId) => ({ taskServiceId: first.taskServiceId, managedTaskId })),
            ...(first.passwordHash ? { passwordHash: first.passwordHash } : {})
        })
            .then((response) => {
                group.forEach((request) => request.resolve(response));
            })
            .catch((error) => {
                group.forEach((request) => request.reject(error));
            });
    });
}

export function queryManagedTaskStatusBatched(
    taskServiceId: string,
    managedTaskId: string,
    signal?: AbortSignal,
    passwordHash?: string
): Promise<ManagedTaskQueryResponse> {
    if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));

    return new Promise((resolve, reject) => {
        const request: PendingStatusRequest = { taskServiceId, managedTaskId, passwordHash, resolve, reject };
        pendingStatusRequests.push(request);
        const abort = () => {
            pendingStatusRequests = pendingStatusRequests.filter((item) => item !== request);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', abort, { once: true });

        if (!pendingStatusFlushTimer) {
            pendingStatusFlushTimer = setTimeout(flushPendingStatusRequests, 25);
        }
    });
}
