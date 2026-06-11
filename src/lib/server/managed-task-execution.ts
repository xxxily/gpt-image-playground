import { formatApiError } from '@/lib/api-error';
import { CONFIGURATION_REQUIRED_MESSAGE } from '@/lib/configuration-guidance';
import {
    normalizeManagedTaskBaseUrl,
    resolveManagedTaskExecution,
    type ManagedTaskResolutionInput
} from '@/lib/managed-task-config';
import type {
    ManagedTaskEndpointDescriptor,
    ManagedTaskImportRequest,
    ManagedTaskImportResponse,
    ManagedTaskInputAssetDescriptor,
    ManagedTaskModelDescriptor,
    ManagedTaskQueryRequest,
    ManagedTaskQueryResponse,
    ManagedTaskResolveRequest,
    ManagedTaskResolveResponse,
    ManagedTaskStatusResponse,
    ManagedTaskSubmitRequest,
    ManagedTaskSubmitResponse
} from '@/lib/managed-task-types';
import type { ModelCapabilities, ProviderKind, ProviderProtocol } from '@/lib/provider-model-catalog';
import type { ProviderUsage } from '@/lib/provider-types';
import { validatePublicHttpBaseUrl } from '@/lib/server-url-safety';
import {
    getManagedTaskResolutionInput,
    getManagedTaskServiceInvocationConfig,
    type ManagedTaskServiceInvocationConfig
} from '@/lib/server/managed-task-admin';
import crypto from 'node:crypto';

type ManagedTaskServiceAccepted = {
    taskId: string;
    status: 'accepted' | 'queued';
    createdAt: string;
    updatedAt: string;
};

type ManagedTaskServiceQueryResponse = {
    tasks?: ManagedTaskStatusResponse[];
    missingTaskIds?: string[];
    requestedAt?: string;
};

type ManagedTaskResultManifest = {
    taskId: string;
    status: 'succeeded';
    outputs?: Array<{
        id: string;
        kind: string;
        filename?: string;
        mimeType?: string;
        size?: number;
        sha256?: string;
        downloadUrl?: string;
        expiresAt?: string;
    }>;
    providerUsage?: ProviderUsage;
    completedAt?: string;
    expiresAt?: string;
};

const MANAGED_TASK_CREDENTIAL_AAD = 'managed-task-execution-credential-v1';
const TASK_SERVICE_FETCH_TIMEOUT_MS = 10_000;
const TASK_SERVICE_RESULT_TIMEOUT_MS = 15_000;

function trimString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function sha256Hex(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function getCredentialSecret(): string {
    const configured =
        process.env.MANAGED_TASK_EXECUTION_CREDENTIAL_SECRET?.trim() ||
        process.env.MANAGED_TASK_CONFIG_SECRET?.trim() ||
        process.env.BETTER_AUTH_SECRET?.trim() ||
        process.env.ADMIN_BOOTSTRAP_SECRET?.trim();
    if (!configured) {
        throw new Error('缺少 MANAGED_TASK_EXECUTION_CREDENTIAL_SECRET，无法委托执行凭证。');
    }
    return configured;
}

function sealExecutionCredential(apiKey: string): { keyEnvelope: string; expiresAt: string; fingerprint: string } {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const plaintext = JSON.stringify({ apiKey, expiresAt });
    const key = crypto.createHash('sha256').update(getCredentialSecret()).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(MANAGED_TASK_CREDENTIAL_AAD));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        keyEnvelope: [
            'sealed-box-v1',
            iv.toString('base64url'),
            tag.toString('base64url'),
            ciphertext.toString('base64url')
        ].join(':'),
        expiresAt,
        fingerprint: sha256Hex(apiKey).slice(0, 16)
    };
}

function verifyAppPassword(passwordHash?: string): void {
    if (!process.env.APP_PASSWORD) return;
    if (!passwordHash) throw new Error('Unauthorized: Missing password hash.');
    const serverPasswordHash = sha256Hex(process.env.APP_PASSWORD);
    if (passwordHash !== serverPasswordHash) throw new Error('Unauthorized: Invalid password.');
}

function normalizeEndpoint(input: ManagedTaskEndpointDescriptor): ManagedTaskEndpointDescriptor {
    const id = trimString(input?.id);
    const provider = trimString(input?.provider);
    const protocol = trimString(input?.protocol);
    if (!id || !provider || !protocol) throw new Error('managed-task endpoint context is incomplete.');
    const rawBaseUrl = trimString(input?.apiBaseUrl);
    let apiBaseUrl = '';
    if (rawBaseUrl) {
        const normalized = normalizeManagedTaskBaseUrl(rawBaseUrl);
        const validation = validatePublicHttpBaseUrl(normalized);
        if (!validation.ok) throw new Error(validation.reason);
        apiBaseUrl = validation.normalizedUrl;
    }
    return {
        id,
        provider,
        protocol,
        ...(apiBaseUrl ? { apiBaseUrl } : {}),
        ...(trimString(input?.name) ? { name: trimString(input.name) } : {})
    };
}

function normalizeModel(input: ManagedTaskModelDescriptor): ManagedTaskModelDescriptor {
    const rawModelId = trimString(input?.rawModelId);
    if (!rawModelId) throw new Error('managed-task model context is incomplete.');
    return {
        rawModelId,
        ...(trimString(input?.catalogEntryId) ? { catalogEntryId: trimString(input.catalogEntryId) } : {}),
        ...(trimString(input?.providerEndpointId) ? { providerEndpointId: trimString(input.providerEndpointId) } : {}),
        ...(trimString(input?.provider) ? { provider: trimString(input.provider) } : {}),
        ...(trimString(input?.protocol) ? { protocol: trimString(input.protocol) } : {}),
        capabilities: {
            tasks: Array.isArray(input?.capabilities?.tasks)
                ? input.capabilities.tasks.filter(
                      (task): task is string => typeof task === 'string' && task.trim().length > 0
                  )
                : []
        }
    };
}

function toResolutionInput(
    request: ManagedTaskResolveRequest
): Omit<ManagedTaskResolutionInput, 'services' | 'policies'> {
    const endpoint = normalizeEndpoint(request.endpoint);
    const model = normalizeModel(request.model);
    return {
        providerEndpoint: {
            id: endpoint.id,
            apiBaseUrl: endpoint.apiBaseUrl || '',
            provider: endpoint.provider as ProviderKind,
            protocol: endpoint.protocol as ProviderProtocol
        },
        model: {
            id: model.catalogEntryId || `${endpoint.id}::${encodeURIComponent(model.rawModelId)}`,
            rawModelId: model.rawModelId,
            providerEndpointId: model.providerEndpointId || endpoint.id,
            provider: (model.provider || endpoint.provider) as ProviderKind,
            protocol: (model.protocol || endpoint.protocol) as ProviderProtocol,
            capabilities: {
                tasks: (model.capabilities?.tasks ?? []) as ModelCapabilities['tasks'],
                inputModalities: [],
                outputModalities: []
            }
        },
        taskCapability: request.taskType,
        defaultMode: request.defaultMode
    };
}

function toResolveResponse(resolution: ReturnType<typeof resolveManagedTaskExecution>): ManagedTaskResolveResponse {
    return {
        mode: resolution.mode,
        reason: resolution.reason,
        ...(resolution.policyId ? { policyId: resolution.policyId } : {}),
        ...(resolution.policyName ? { policyName: resolution.policyName } : {}),
        ...(resolution.taskServiceId ? { taskServiceId: resolution.taskServiceId } : {}),
        ...(resolution.taskServiceName ? { taskServiceName: resolution.taskServiceName } : {}),
        ...(resolution.fallbackMode ? { fallbackMode: resolution.fallbackMode } : {})
    };
}

export async function resolveManagedTaskUserRequest(
    request: ManagedTaskResolveRequest
): Promise<ManagedTaskResolveResponse> {
    verifyAppPassword(request.passwordHash);
    const config = await getManagedTaskResolutionInput();
    const resolution = resolveManagedTaskExecution({
        ...config,
        ...toResolutionInput(request)
    });
    return toResolveResponse(resolution);
}

function serviceUrl(service: ManagedTaskServiceInvocationConfig, pathname: string): string {
    return `${service.baseUrl.replace(/\/+$/u, '')}${pathname}`;
}

async function fetchTaskServiceJson<T>(
    service: ManagedTaskServiceInvocationConfig,
    pathname: string,
    options: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {}
): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TASK_SERVICE_FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(serviceUrl(service, pathname), {
            method: options.method ?? 'GET',
            headers: {
                ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
                ...(service.authToken ? { authorization: `Bearer ${service.authToken}` } : {})
            },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            signal: controller.signal,
            cache: 'no-store'
        });
        const payload = (await response.json().catch(() => ({}))) as unknown;
        if (!response.ok) {
            throw new Error(formatApiError(payload, `Task service request failed with status ${response.status}`));
        }
        return payload as T;
    } finally {
        clearTimeout(timer);
    }
}

function normalizeInputAssets(value: ManagedTaskInputAssetDescriptor[]): ManagedTaskInputAssetDescriptor[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((asset) => asset && typeof asset === 'object')
        .map((asset) => ({
            kind: asset.kind,
            uploadRef: trimString(asset.uploadRef),
            ...(trimString(asset.filename) ? { filename: trimString(asset.filename) } : {}),
            ...(trimString(asset.mimeType) ? { mimeType: trimString(asset.mimeType) } : {}),
            ...(typeof asset.size === 'number' && Number.isFinite(asset.size) && asset.size > 0
                ? { size: Math.floor(asset.size) }
                : {}),
            ...(trimString(asset.sha256) ? { sha256: trimString(asset.sha256) } : {})
        }))
        .filter((asset) => Boolean(asset.uploadRef) && asset.kind === 'image');
}

function buildTaskServiceRequest(request: ManagedTaskSubmitRequest) {
    const endpoint = normalizeEndpoint(request.endpoint);
    const model = normalizeModel(request.model);
    const rawApiKey = trimString(request.credential.apiKey);
    if (!rawApiKey) throw new Error(CONFIGURATION_REQUIRED_MESSAGE);
    const sealedCredential = sealExecutionCredential(rawApiKey);
    const baseUrl = endpoint.apiBaseUrl || '';
    return {
        idempotencyKey: request.idempotencyKey,
        taskType: request.taskType,
        providerEndpointRef: {
            id: endpoint.id,
            provider: endpoint.provider,
            protocol: endpoint.protocol,
            ...(baseUrl ? { baseUrl } : {}),
            baseUrlFingerprint: sha256Hex(baseUrl || endpoint.id).slice(0, 32),
            ...(endpoint.name ? { displayName: endpoint.name } : {})
        },
        executionCredential: {
            mode: request.credential.mode,
            keyEnvelope: sealedCredential.keyEnvelope,
            expiresAt: sealedCredential.expiresAt,
            fingerprint: sealedCredential.fingerprint,
            algorithm: 'sealed-box-v1' as const
        },
        model: {
            ...(model.catalogEntryId ? { catalogEntryId: model.catalogEntryId } : {}),
            rawModelId: model.rawModelId
        },
        prompt: request.prompt,
        parameters: request.parameters && typeof request.parameters === 'object' ? request.parameters : {},
        inputAssets: normalizeInputAssets(request.inputAssets),
        clientContext: {
            appInstanceId: trimString(request.clientContext.appInstanceId) || 'web',
            clientTaskId: request.clientTaskId,
            ...(trimString(request.clientContext.workspaceId)
                ? { workspaceId: trimString(request.clientContext.workspaceId) }
                : {}),
            source: request.clientContext.source,
            ...(trimString(request.clientContext.locale) ? { locale: trimString(request.clientContext.locale) } : {})
        }
    };
}

function assertServiceCapability(service: ManagedTaskServiceInvocationConfig, taskType: string): void {
    const taskTypes = service.capabilitiesSummary?.taskTypes ?? [];
    if (taskTypes.length > 0 && !taskTypes.includes(taskType)) {
        throw new Error(`Task service does not advertise ${taskType}.`);
    }
}

export async function submitManagedTaskUserRequest(
    request: ManagedTaskSubmitRequest
): Promise<ManagedTaskSubmitResponse> {
    verifyAppPassword(request.passwordHash);
    const resolution = await resolveManagedTaskUserRequest({
        taskType: request.taskType,
        endpoint: request.endpoint,
        model: request.model,
        defaultMode: request.defaultMode,
        passwordHash: request.passwordHash
    });
    if (resolution.mode !== 'managed-task' || !resolution.taskServiceId) {
        return { accepted: false, resolution };
    }

    const service = await getManagedTaskServiceInvocationConfig(resolution.taskServiceId);
    if (!service) throw new Error('任务服务配置不存在或已禁用。');
    assertServiceCapability(service, request.taskType);
    const serviceRequest = buildTaskServiceRequest(request);
    const accepted = await fetchTaskServiceJson<ManagedTaskServiceAccepted>(service, '/v1/tasks', {
        method: 'POST',
        body: serviceRequest
    });

    return {
        accepted: true,
        managedTaskId: accepted.taskId,
        status: accepted.status,
        createdAt: accepted.createdAt,
        updatedAt: accepted.updatedAt,
        taskServiceId: service.id,
        taskServiceName: service.name,
        ...(resolution.policyId ? { policyId: resolution.policyId } : {}),
        ...(resolution.policyName ? { policyName: resolution.policyName } : {})
    };
}

export async function queryManagedTaskUserRequest(request: ManagedTaskQueryRequest): Promise<ManagedTaskQueryResponse> {
    verifyAppPassword(request.passwordHash);
    const grouped = new Map<string, string[]>();
    request.tasks.forEach((task) => {
        const taskServiceId = trimString(task.taskServiceId);
        const managedTaskId = trimString(task.managedTaskId);
        if (!taskServiceId || !managedTaskId) return;
        const group = grouped.get(taskServiceId) ?? [];
        if (!group.includes(managedTaskId)) group.push(managedTaskId);
        grouped.set(taskServiceId, group);
    });

    const tasks: ManagedTaskStatusResponse[] = [];
    const missingTaskIds: string[] = [];
    const requestedAt = new Date().toISOString();

    for (const [taskServiceId, taskIds] of grouped.entries()) {
        const service = await getManagedTaskServiceInvocationConfig(taskServiceId);
        if (!service) {
            missingTaskIds.push(...taskIds);
            continue;
        }
        for (let index = 0; index < taskIds.length; index += 100) {
            const batch = taskIds.slice(index, index + 100);
            const response = await fetchTaskServiceJson<ManagedTaskServiceQueryResponse>(service, '/v1/tasks/query', {
                method: 'POST',
                body: { taskIds: batch }
            });
            tasks.push(...(Array.isArray(response.tasks) ? response.tasks : []));
            missingTaskIds.push(...(Array.isArray(response.missingTaskIds) ? response.missingTaskIds : []));
        }
    }

    return { tasks, missingTaskIds, requestedAt };
}

function resolveServiceDownloadUrl(service: ManagedTaskServiceInvocationConfig, downloadUrl: string): string {
    const serviceBase = new URL(service.baseUrl);
    const resolved = new URL(downloadUrl, service.baseUrl);
    if (resolved.origin !== serviceBase.origin) {
        throw new Error('Task result download URL origin is not allowed.');
    }
    return resolved.toString();
}

function outputFormatFromMime(filename: string | undefined, mimeType: string | undefined): 'png' | 'jpeg' | 'webp' {
    const normalizedMime = trimString(mimeType).toLowerCase();
    if (normalizedMime.includes('jpeg') || normalizedMime.includes('jpg')) return 'jpeg';
    if (normalizedMime.includes('webp')) return 'webp';
    const normalizedFilename = trimString(filename).toLowerCase();
    if (normalizedFilename.endsWith('.jpg') || normalizedFilename.endsWith('.jpeg')) return 'jpeg';
    if (normalizedFilename.endsWith('.webp')) return 'webp';
    return 'png';
}

async function downloadResultImage(
    service: ManagedTaskServiceInvocationConfig,
    output: NonNullable<ManagedTaskResultManifest['outputs']>[number]
): Promise<ManagedTaskImportResponse['images'][number]> {
    if (!output.downloadUrl) throw new Error('Task result image is missing a download URL.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TASK_SERVICE_RESULT_TIMEOUT_MS);
    try {
        const response = await fetch(resolveServiceDownloadUrl(service, output.downloadUrl), {
            headers: service.authToken ? { authorization: `Bearer ${service.authToken}` } : undefined,
            signal: controller.signal,
            cache: 'no-store'
        });
        if (!response.ok) throw new Error(`Task result image download failed with status ${response.status}.`);
        const buffer = Buffer.from(await response.arrayBuffer());
        const format = outputFormatFromMime(
            output.filename,
            output.mimeType || response.headers.get('content-type') || undefined
        );
        return {
            filename: output.filename || `${output.id}.${format}`,
            b64_json: buffer.toString('base64'),
            output_format: format,
            size: typeof output.size === 'number' ? output.size : buffer.byteLength
        };
    } finally {
        clearTimeout(timer);
    }
}

export async function importManagedTaskUserResult(
    request: ManagedTaskImportRequest
): Promise<ManagedTaskImportResponse> {
    verifyAppPassword(request.passwordHash);
    const taskServiceId = trimString(request.taskServiceId);
    const managedTaskId = trimString(request.managedTaskId);
    if (!taskServiceId || !managedTaskId) throw new Error('Missing managed task result context.');
    const service = await getManagedTaskServiceInvocationConfig(taskServiceId);
    if (!service) throw new Error('任务服务配置不存在或已禁用。');
    const manifest = await fetchTaskServiceJson<ManagedTaskResultManifest>(
        service,
        `/v1/tasks/${encodeURIComponent(managedTaskId)}/result`
    );
    const imageOutputs = (manifest.outputs ?? []).filter((output) => output.kind === 'image' && output.downloadUrl);
    if (imageOutputs.length === 0) throw new Error('Task result manifest did not include image outputs.');
    const images = await Promise.all(imageOutputs.map((output) => downloadResultImage(service, output)));
    return {
        managedTaskId,
        ...(manifest.completedAt ? { completedAt: manifest.completedAt } : {}),
        ...(manifest.expiresAt ? { expiresAt: manifest.expiresAt } : {}),
        ...(manifest.providerUsage ? { providerUsage: manifest.providerUsage } : {}),
        images
    };
}
