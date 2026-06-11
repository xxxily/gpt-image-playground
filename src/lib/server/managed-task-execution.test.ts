import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = {
    ADMIN_DATABASE_PATH: process.env.ADMIN_DATABASE_PATH,
    APP_PASSWORD: process.env.APP_PASSWORD,
    MANAGED_TASK_CONFIG_SECRET: process.env.MANAGED_TASK_CONFIG_SECRET,
    MANAGED_TASK_EXECUTION_CREDENTIAL_SECRET: process.env.MANAGED_TASK_EXECUTION_CREDENTIAL_SECRET,
    NODE_ENV: process.env.NODE_ENV
};

let cleanup: (() => void) | null = null;

function restoreEnv() {
    for (const [key, value] of Object.entries(originalEnv)) {
        if (typeof value === 'string') {
            process.env[key] = value;
        } else {
            delete process.env[key];
        }
    }
}

async function loadModules() {
    vi.resetModules();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'managed-task-execution-'));
    process.env.ADMIN_DATABASE_PATH = path.join(tempDir, 'admin.sqlite');
    process.env.MANAGED_TASK_CONFIG_SECRET = 'managed-task-config-secret';
    process.env.MANAGED_TASK_EXECUTION_CREDENTIAL_SECRET = 'managed-task-execution-secret';

    const db = await import('@/lib/server/db');
    await db.getServerDatabaseReady();
    db.getSqliteClient()
        .prepare(
            `INSERT INTO "user" ("id", "name", "email", "role", "status")
             VALUES ('actor-1', 'Actor', 'actor@example.test', 'owner', 'active');`
        )
        .run();

    cleanup = () => {
        db.getSqliteClient().close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    };

    const [admin, execution, audit] = await Promise.all([
        import('@/lib/server/managed-task-admin'),
        import('@/lib/server/managed-task-execution'),
        import('@/lib/server/audit')
    ]);
    return { admin, execution, audit };
}

function actor(): import('@/lib/server/managed-task-admin').ManagedTaskAdminActor {
    return {
        userId: 'actor-1',
        email: 'actor@example.test',
        role: 'owner',
        request: new Request('https://admin.example.test')
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    cleanup?.();
    cleanup = null;
    vi.resetModules();
    restoreEnv();
});

describe('managed task execution facade', () => {
    it('submits a sealed execution credential without sending the raw user key to the task service', async () => {
        const { admin, execution, audit } = await loadModules();
        const service = await admin.createManagedTaskServiceAdmin(
            { name: 'Task service', baseUrl: 'https://tasks.example.test', enabled: true },
            actor()
        );
        await admin.createManagedTaskPolicyAdmin(
            {
                name: 'OpenAI takeover',
                enabled: true,
                taskServiceId: service.id,
                match: { providerEndpointIds: ['openai:default'], taskCapabilities: ['image.generate'] }
            },
            actor()
        );

        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({
                    taskId: 'mgt_accepted',
                    status: 'queued',
                    createdAt: '2026-06-11T00:00:00.000Z',
                    updatedAt: '2026-06-11T00:00:00.000Z',
                    statusUrl: 'https://tasks.example.test/v1/tasks/mgt_accepted'
                }),
                { status: 202, headers: { 'content-type': 'application/json' } }
            )
        );

        const response = await execution.submitManagedTaskUserRequest({
            clientTaskId: 'task_1',
            idempotencyKey: 'idem_1',
            taskType: 'image.generate',
            endpoint: {
                id: 'openai:default',
                provider: 'openai-compatible',
                protocol: 'openai-images',
                apiBaseUrl: 'https://api.openai.com/v1'
            },
            model: {
                catalogEntryId: 'openai:default::gpt-image-2',
                rawModelId: 'gpt-image-2',
                providerEndpointId: 'openai:default',
                provider: 'openai-compatible',
                protocol: 'openai-images',
                capabilities: { tasks: ['image.generate'] }
            },
            defaultMode: 'proxy',
            prompt: 'draw an icon',
            parameters: { n: 1 },
            inputAssets: [],
            credential: { mode: 'user-delegated', apiKey: 'sk-user-secret' },
            clientContext: { appInstanceId: 'app_1', source: 'web' },
            historyInput: {
                mode: 'generate',
                model: 'gpt-image-2',
                n: 1,
                imageStorageMode: 'indexeddb'
            }
        });

        expect(response).toMatchObject({ accepted: true, managedTaskId: 'mgt_accepted' });
        const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
            executionCredential: { keyEnvelope: string; fingerprint: string };
        };
        expect(JSON.stringify(body)).not.toContain('sk-user-secret');
        expect(body.executionCredential.keyEnvelope).toMatch(/^sealed-box-v1:/u);
        expect(body.executionCredential.fingerprint).toHaveLength(16);

        const logs = await audit.listAuditLogs(10);
        const serializedLogs = JSON.stringify(logs.map((log) => log.metadataJson));
        expect(logs.some((log) => log.action === 'managed_task_submit')).toBe(true);
        expect(serializedLogs).not.toContain('sk-user-secret');
        expect(serializedLogs).not.toContain('draw an icon');
    });

    it('audits result reads without storing manifest download URLs', async () => {
        const { admin, execution, audit } = await loadModules();
        const service = await admin.createManagedTaskServiceAdmin(
            { name: 'Task service', baseUrl: 'https://tasks.example.test', enabled: true },
            actor()
        );
        vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        taskId: 'mgt_done',
                        status: 'succeeded',
                        outputs: [
                            {
                                id: 'asset_1',
                                kind: 'image',
                                filename: 'result.png',
                                mimeType: 'image/png',
                                size: 4,
                                downloadUrl: '/v1/assets/asset_1/download?token=secret-download-token',
                                expiresAt: '2026-06-11T00:15:00.000Z'
                            }
                        ],
                        providerUsage: { mock: true },
                        completedAt: '2026-06-11T00:00:00.000Z'
                    }),
                    { status: 200, headers: { 'content-type': 'application/json' } }
                )
            )
            .mockResolvedValueOnce(
                new Response(new Uint8Array([1, 2, 3, 4]), {
                    status: 200,
                    headers: { 'content-type': 'image/png' }
                })
            );

        const result = await execution.importManagedTaskUserResult({
            taskServiceId: service.id,
            managedTaskId: 'mgt_done'
        });
        expect(result.images[0]?.filename).toBe('result.png');

        const logs = await audit.listAuditLogs(10);
        const serializedLogs = JSON.stringify(logs.map((log) => log.metadataJson));
        expect(logs.some((log) => log.action === 'managed_task_result_read')).toBe(true);
        expect(serializedLogs).not.toContain('secret-download-token');
        expect(serializedLogs).not.toContain('/v1/assets/asset_1/download');
    });

    it('requires the app password hash before querying or importing managed task results', async () => {
        const { execution } = await loadModules();
        process.env.APP_PASSWORD = 'phase4-password';

        await expect(execution.queryManagedTaskUserRequest({ tasks: [] })).rejects.toThrow(
            'Unauthorized: Missing password hash.'
        );
        await expect(
            execution.importManagedTaskUserResult({ managedTaskId: 'mgt_1', taskServiceId: 'svc_1' })
        ).rejects.toThrow('Unauthorized: Missing password hash.');
    });
});
