import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

type LoadedManagedTaskModules = {
    admin: typeof import('@/lib/server/managed-task-admin');
    audit: typeof import('@/lib/server/audit');
    db: typeof import('@/lib/server/db');
    cleanup: () => void;
};

const originalEnv = {
    ADMIN_DATABASE_PATH: process.env.ADMIN_DATABASE_PATH,
    MANAGED_TASK_CONFIG_SECRET: process.env.MANAGED_TASK_CONFIG_SECRET,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    ADMIN_BOOTSTRAP_SECRET: process.env.ADMIN_BOOTSTRAP_SECRET,
    NODE_ENV: process.env.NODE_ENV
};

let loadedModules: LoadedManagedTaskModules | null = null;

function restoreEnv() {
    for (const [key, value] of Object.entries(originalEnv)) {
        if (typeof value === 'string') {
            process.env[key] = value;
        } else {
            delete process.env[key];
        }
    }
}

async function loadManagedTaskModules(): Promise<LoadedManagedTaskModules> {
    vi.resetModules();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'managed-task-admin-'));
    process.env.ADMIN_DATABASE_PATH = path.join(tempDir, 'admin.sqlite');
    process.env.MANAGED_TASK_CONFIG_SECRET = 'managed-task-admin-test-secret';

    const db = await import('@/lib/server/db');
    await db.getServerDatabaseReady();
    db.getSqliteClient()
        .prepare(
            `INSERT INTO "user" ("id", "name", "email", "role", "status")
             VALUES ('actor-1', 'Actor', 'actor@example.test', 'owner', 'active');`
        )
        .run();

    const [admin, audit] = await Promise.all([import('@/lib/server/managed-task-admin'), import('@/lib/server/audit')]);
    loadedModules = {
        admin,
        audit,
        db,
        cleanup: () => {
            db.getSqliteClient().close();
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    };
    return loadedModules;
}

function createActor(role = 'owner'): import('@/lib/server/managed-task-admin').ManagedTaskAdminActor {
    return {
        userId: 'actor-1',
        email: 'actor@example.test',
        role,
        request: new Request('https://admin.example.test/api/admin/managed-task-services', {
            headers: {
                'user-agent': 'vitest',
                'x-real-ip': '203.0.113.10'
            }
        })
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    loadedModules?.cleanup();
    loadedModules = null;
    vi.resetModules();
    restoreEnv();
});

describe('managed task admin config', () => {
    it('rejects localhost and private task service URLs', async () => {
        const { admin } = await loadManagedTaskModules();
        await expect(
            admin.createManagedTaskServiceAdmin(
                {
                    name: 'Local task service',
                    baseUrl: 'http://127.0.0.1:3001',
                    enabled: true
                },
                createActor()
            )
        ).rejects.toThrow(/任务服务 URL 不允许/u);
    });

    it('encrypts bearer tokens, returns only token metadata, and keeps audit metadata redacted', async () => {
        const { admin, audit, db } = await loadManagedTaskModules();
        const token = 'unit-test-bearer-token-value';
        const service = await admin.createManagedTaskServiceAdmin(
            {
                name: 'Managed Task Service',
                baseUrl: 'https://tasks.example.test/api/',
                enabled: true,
                authMode: 'bearer',
                authToken: token,
                healthCheckEnabled: true
            },
            createActor()
        );

        expect(service).toMatchObject({
            name: 'Managed Task Service',
            baseUrl: 'https://tasks.example.test/api',
            authTokenConfigured: true,
            authTokenPrefix: 'unit-tes'
        });
        expect('authToken' in service).toBe(false);

        const row = db
            .getSqliteClient()
            .prepare(`SELECT "authTokenCiphertext", "authTokenPrefix" FROM "managed_task_services" WHERE "id" = ?;`)
            .get(service.id) as { authTokenCiphertext: string; authTokenPrefix: string };
        expect(row.authTokenCiphertext).not.toContain(token);
        expect(row.authTokenCiphertext).toMatch(/^v1:/u);
        expect(row.authTokenPrefix).toBe('unit-tes');

        const logs = await audit.listAuditLogs(10);
        expect(JSON.stringify(logs.map((log) => log.metadataJson))).not.toContain(token);
    });

    it('creates policies, exposes resolver input, and nulls policy service bindings when a service is deleted', async () => {
        const { admin } = await loadManagedTaskModules();
        const actor = createActor();
        const service = await admin.createManagedTaskServiceAdmin(
            {
                name: 'Primary service',
                baseUrl: 'https://tasks.example.test',
                enabled: true
            },
            actor
        );
        const policy = await admin.createManagedTaskPolicyAdmin(
            {
                name: 'OpenAI image takeover',
                enabled: true,
                priority: 10,
                taskServiceId: service.id,
                match: {
                    providerEndpointIds: ['endpoint-1'],
                    normalizedBaseUrls: ['https://api.example.test/v1/'],
                    modelCatalogEntryIds: ['model-1'],
                    taskCapabilities: ['image.generate']
                },
                limits: {
                    maxQueuedTasksPerUser: 5,
                    timeoutSeconds: 300
                }
            },
            actor
        );

        expect(policy).toMatchObject({
            name: 'OpenAI image takeover',
            taskServiceId: service.id,
            match: {
                providerEndpointIds: ['endpoint-1'],
                normalizedBaseUrls: ['https://api.example.test/v1'],
                modelCatalogEntryIds: ['model-1'],
                taskCapabilities: ['image.generate']
            },
            limits: {
                maxQueuedTasksPerUser: 5,
                timeoutSeconds: 300
            }
        });

        const resolverInput = await admin.getManagedTaskResolutionInput();
        expect(resolverInput.services).toHaveLength(1);
        expect(resolverInput.policies).toHaveLength(1);
        expect(await admin.countManagedTaskServices()).toBe(1);
        expect(await admin.countManagedTaskPolicies()).toBe(1);

        await expect(
            admin.createManagedTaskPolicyAdmin({ name: 'Invalid policy', mode: 'managed-task' }, actor)
        ).rejects.toThrow(/必须选择任务服务/u);

        expect(await admin.deleteManagedTaskServiceAdmin(service.id, actor)).toBe(true);
        const policies = await admin.listManagedTaskPoliciesAdmin();
        expect(policies[0]?.taskServiceId).toBeNull();
    });

    it('checks task service health and stores safe capabilities without persisting bearer tokens in audit logs', async () => {
        const { admin, audit } = await loadManagedTaskModules();
        const actor = createActor();
        const token = 'health-check-secret-token';
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        status: 'ok',
                        version: '1.0.0',
                        schemaVersion: 'gpt-image-task-service.admin.health.v1',
                        dependencies: [{ name: 'hatchet', status: 'ok', safeMessage: 'connected' }]
                    }),
                    { status: 200, headers: { 'content-type': 'application/json' } }
                )
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        schemaVersion: 'gpt-image-task-service.admin.capabilities.v1',
                        serviceVersion: '1.0.0',
                        taskTypes: ['image.generate', 'image.edit', 'video.generate'],
                        credentialModes: ['ephemeral-user-key'],
                        storage: { primary: 'local-filesystem', s3CompatibleAvailable: true },
                        events: { sse: true, batchPolling: true },
                        limits: { maxBatchQueryTasks: 50 },
                        retryPolicy: {
                            enabled: false,
                            maxAttempts: 1,
                            feeWarning: 'retry may cost extra'
                        }
                    }),
                    { status: 200, headers: { 'content-type': 'application/json' } }
                )
            );

        const service = await admin.createManagedTaskServiceAdmin(
            {
                name: 'Health service',
                baseUrl: 'https://tasks.example.test',
                enabled: true,
                authMode: 'bearer',
                authToken: token
            },
            actor
        );
        const checked = await admin.checkManagedTaskServiceAdmin(service.id, actor);

        expect(checked.healthStatus).toBe('ok');
        expect(checked.healthSummary).toMatchObject({ status: 'ok', version: '1.0.0' });
        expect(checked.capabilitiesSummary).toMatchObject({
            taskTypes: ['image.generate', 'image.edit', 'video.generate'],
            storage: { primary: 'local-filesystem', s3CompatibleAvailable: true },
            events: { sse: true, batchPolling: true },
            retryPolicy: { feeRiskWarning: 'retry may cost extra' }
        });
        expect(fetchMock).toHaveBeenCalledWith(
            'https://tasks.example.test/v1/admin/health',
            expect.objectContaining({
                headers: { authorization: `Bearer ${token}` }
            })
        );

        const logs = await audit.listAuditLogs(10);
        expect(JSON.stringify(logs.map((log) => log.metadataJson))).not.toContain(token);
    });

    it('updates task service retry policy with fee warning and redacted audit metadata', async () => {
        const { admin, audit } = await loadManagedTaskModules();
        const actor = createActor();
        const service = await admin.createManagedTaskServiceAdmin(
            { name: 'Retry service', baseUrl: 'https://tasks.example.test', enabled: true },
            actor
        );
        vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        enabled: false,
                        maxAttempts: 1,
                        backoffMs: 5000,
                        feeWarning: 'automatic retry may cost extra'
                    }),
                    { status: 200, headers: { 'content-type': 'application/json' } }
                )
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        enabled: true,
                        maxAttempts: 3,
                        backoffMs: 1000,
                        feeWarning: 'automatic retry may cost extra'
                    }),
                    { status: 200, headers: { 'content-type': 'application/json' } }
                )
            );

        const policy = await admin.updateManagedTaskServiceRetryPolicyAdmin(
            service.id,
            { enabled: true, maxAttempts: 3, backoffMs: 1000 },
            actor
        );
        expect(policy).toMatchObject({
            enabled: true,
            maxAttempts: 3,
            backoffMs: 1000,
            feeRiskWarning: 'automatic retry may cost extra'
        });

        const logs = await audit.listAuditLogs(10);
        expect(logs.some((log) => log.action === 'managed_task_retry_policy_update')).toBe(true);
        expect(JSON.stringify(logs.map((log) => log.metadataJson))).not.toContain('Bearer');
    });

    it('lists redacted task summaries and only lets owners request full diagnostics', async () => {
        const { admin, audit } = await loadManagedTaskModules();
        const owner = createActor('owner');
        const service = await admin.createManagedTaskServiceAdmin(
            { name: 'Diagnostics service', baseUrl: 'https://tasks.example.test', enabled: true },
            owner
        );
        vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        tasks: [
                            {
                                visibility: 'summary',
                                taskId: 'mgt_1',
                                status: 'failed',
                                taskType: 'image.generate',
                                createdAt: '2026-06-11T00:00:00.000Z',
                                updatedAt: '2026-06-11T00:01:00.000Z',
                                attempt: 1,
                                maxAttempts: 2,
                                retryable: true,
                                cancellable: false,
                                endpoint: { baseUrlFingerprint: 'fp_gateway' },
                                model: { rawModelId: 'gpt-image-2' },
                                credentialFingerprint: 'key_fp_test',
                                promptSummary: { sha256: 'a'.repeat(64), length: 42 },
                                outputCount: 0,
                                errorCode: 'provider_failed'
                            }
                        ],
                        requestedAt: '2026-06-11T00:02:00.000Z'
                    }),
                    { status: 200, headers: { 'content-type': 'application/json' } }
                )
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        task: {
                            visibility: 'full',
                            taskId: 'mgt_1',
                            status: 'failed',
                            taskType: 'image.generate',
                            createdAt: '2026-06-11T00:00:00.000Z',
                            updatedAt: '2026-06-11T00:01:00.000Z',
                            attempt: 1,
                            maxAttempts: 2,
                            retryable: true,
                            cancellable: false,
                            endpoint: { baseUrlFingerprint: 'fp_gateway' },
                            model: { rawModelId: 'gpt-image-2' },
                            credentialFingerprint: 'key_fp_test',
                            promptSummary: { sha256: 'a'.repeat(64), length: 42 },
                            outputCount: 0,
                            prompt: 'full prompt for owner',
                            executionCredential: {
                                mode: 'user-delegated',
                                fingerprint: 'key_fp_test',
                                keyEnvelope: 'sealed-secret-envelope',
                                keyEnvelopeStored: true
                            },
                            result: {
                                outputs: [
                                    {
                                        id: 'asset_1',
                                        kind: 'image',
                                        downloadUrl: '/v1/assets/asset_1/download?token=download-secret-token'
                                    }
                                ]
                            }
                        }
                    }),
                    { status: 200, headers: { 'content-type': 'application/json' } }
                )
            );

        const tasks = await admin.listManagedTaskServiceTasksAdmin(service.id, 5);
        expect(tasks.tasks[0]).toMatchObject({
            visibility: 'summary',
            taskId: 'mgt_1',
            credentialFingerprint: 'key_fp_test',
            promptSummary: { length: 42 }
        });

        await expect(
            admin.getManagedTaskServiceTaskDiagnosticAdmin(service.id, 'mgt_1', 'full', createActor('admin'))
        ).rejects.toThrow(/超级管理员/u);
        const diagnostic = await admin.getManagedTaskServiceTaskDiagnosticAdmin(service.id, 'mgt_1', 'full', owner);
        expect(diagnostic).toMatchObject({ visibility: 'full', prompt: 'full prompt for owner' });
        expect(JSON.stringify(diagnostic)).not.toContain('sealed-secret-envelope');
        expect(JSON.stringify(diagnostic)).not.toContain('download-secret-token');
        expect(JSON.stringify(diagnostic)).toContain('[redacted]');

        const logs = await audit.listAuditLogs(10);
        expect(logs.some((log) => log.action === 'managed_task_full_diagnostic_view')).toBe(true);
        expect(JSON.stringify(logs.map((log) => log.metadataJson))).not.toContain('full prompt for owner');
    });
});
