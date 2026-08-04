import { GET } from './route';
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    adminJsonError,
    exportShowcaseAnalyticsRows,
    getShowcaseAnalyticsSummary,
    recordAuditLog,
    requireAdminApi
} = vi.hoisted(() => ({
    adminJsonError: vi.fn((error: unknown) =>
        NextResponse.json({ error: error instanceof Error ? error.message : '操作失败。' }, { status: 400 })
    ),
    exportShowcaseAnalyticsRows: vi.fn(),
    getShowcaseAnalyticsSummary: vi.fn(),
    recordAuditLog: vi.fn(),
    requireAdminApi: vi.fn()
}));

vi.mock('@/lib/server/admin-api', () => ({ adminJsonError, requireAdminApi }));
vi.mock('@/lib/server/showcase/analytics', () => ({
    exportShowcaseAnalyticsRows,
    getShowcaseAnalyticsSummary
}));
vi.mock('@/lib/server/audit', () => ({ recordAuditLog }));

function session(role: 'owner' | 'admin' | 'viewer') {
    return { id: `${role}-1`, email: `${role}@example.com`, role };
}

describe('GET /api/admin/showcase-metrics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 7, 4, 12));
        getShowcaseAnalyticsSummary.mockResolvedValue({ totals: { showcase_open: 3 }, topics: [] });
        exportShowcaseAnalyticsRows.mockResolvedValue([
            { id: 1, createdAt: Date.UTC(2026, 7, 4), event: 'showcase_open', topicId: 'old-photo-restoration' }
        ]);
        recordAuditLog.mockResolvedValue(undefined);
    });

    it('allows every admin role to read an aggregated summary', async () => {
        requireAdminApi.mockResolvedValue(session('viewer'));

        const response = await GET(new NextRequest('https://app.example/api/admin/showcase-metrics?days=14'));

        expect(requireAdminApi).toHaveBeenCalledWith(expect.any(NextRequest), {
            roles: ['owner', 'admin', 'viewer']
        });
        expect(getShowcaseAnalyticsSummary).toHaveBeenCalledWith(
            Date.UTC(2026, 7, 4, 12) - 14 * 86_400_000,
            Date.UTC(2026, 7, 4, 12)
        );
        expect(exportShowcaseAnalyticsRows).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toEqual({
            summary: { totals: { showcase_open: 3 }, topics: [] },
            days: 14
        });
    });

    it.each(['owner', 'admin'] as const)('allows %s to export bounded NDJSON and records an audit log', async (role) => {
        requireAdminApi.mockResolvedValue(session(role));

        const response = await GET(
            new NextRequest('https://app.example/api/admin/showcase-metrics?format=ndjson&days=999', {
                headers: { 'user-agent': 'Vitest' }
            })
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('content-type')).toContain('application/x-ndjson');
        expect(response.headers.get('content-disposition')).toContain('showcase-analytics-180d.ndjson');
        expect(await response.text()).toBe(
            `${JSON.stringify({
                id: 1,
                createdAt: Date.UTC(2026, 7, 4),
                event: 'showcase_open',
                topicId: 'old-photo-restoration'
            })}\n`
        );
        expect(recordAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                actorUserId: `${role}-1`,
                action: 'showcase_analytics_export',
                targetType: 'showcase_analytics',
                userAgent: 'Vitest',
                metadata: expect.objectContaining({ days: 180, format: 'ndjson', rowCount: 1 })
            })
        );
    });

    it('forbids viewers from exporting raw events without querying or auditing them', async () => {
        requireAdminApi.mockResolvedValue(session('viewer'));

        const response = await GET(
            new NextRequest('https://app.example/api/admin/showcase-metrics?format=ndjson&days=30')
        );

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toEqual({ error: '只有管理员可以导出专题分析数据。' });
        expect(exportShowcaseAnalyticsRows).not.toHaveBeenCalled();
        expect(recordAuditLog).not.toHaveBeenCalled();
    });
});
