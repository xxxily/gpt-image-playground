import { z } from 'zod';

const stringArraySchema = z.array(z.string().trim().min(1)).default([]);
const p0TaskCapabilitySchema = z.enum(['image.generate', 'image.edit']);

export const managedTaskPolicyMatchSchema = z
    .object({
        providerEndpointIds: stringArraySchema.optional(),
        normalizedBaseUrls: stringArraySchema.optional(),
        providerKinds: stringArraySchema.optional(),
        providerProtocols: stringArraySchema.optional(),
        modelCatalogEntryIds: stringArraySchema.optional(),
        taskCapabilities: z.array(p0TaskCapabilitySchema).optional()
    })
    .default({});

export const managedTaskPolicyLimitsSchema = z
    .object({
        maxSubmittedTasksPerUserPerHour: z.coerce.number().int().positive().optional(),
        maxQueuedTasksPerUser: z.coerce.number().int().positive().optional(),
        maxInputAssetBytes: z.coerce.number().int().positive().optional(),
        maxOutputAssetBytes: z.coerce.number().int().positive().optional(),
        timeoutSeconds: z.coerce.number().int().positive().optional()
    })
    .default({});

export const managedTaskServiceCreateSchema = z.object({
    name: z.string().trim().min(1).max(120),
    baseUrl: z.string().trim().min(1).max(2048),
    enabled: z.boolean().optional(),
    authMode: z.enum(['none', 'bearer']).optional(),
    authToken: z.string().trim().max(4096).nullable().optional(),
    clearAuthToken: z.boolean().optional(),
    healthCheckEnabled: z.boolean().optional(),
    healthCheckIntervalSeconds: z.coerce.number().int().min(15).max(3600).optional()
});

export const managedTaskServiceUpdateSchema = managedTaskServiceCreateSchema.partial();

export const managedTaskPolicyCreateSchema = z.object({
    name: z.string().trim().min(1).max(120),
    enabled: z.boolean().optional(),
    priority: z.coerce.number().int().min(-1_000_000).max(1_000_000).optional(),
    match: managedTaskPolicyMatchSchema.optional(),
    mode: z.enum(['direct', 'proxy', 'managed-task', 'auto']).optional(),
    taskServiceId: z.string().trim().max(160).nullable().optional(),
    fallbackMode: z.enum(['proxy', 'direct', 'fail-closed', 'ask-user']).optional(),
    limits: managedTaskPolicyLimitsSchema.optional()
});

export const managedTaskPolicyUpdateSchema = managedTaskPolicyCreateSchema.partial();
