import { adminJsonError, requireAdminApi } from '@/lib/server/admin-api';
import { exportShowcaseAnalyticsRows, getShowcaseAnalyticsSummary } from '@/lib/server/showcase/analytics';
import { recordAuditLog } from '@/lib/server/audit';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await requireAdminApi(request, { roles: ['owner', 'admin', 'viewer'] });
        const format = request.nextUrl.searchParams.get('format');
        const daysValue = Number(request.nextUrl.searchParams.get('days') || 30);
        const days = Number.isFinite(daysValue) ? Math.max(1, Math.min(180, Math.floor(daysValue))) : 30;
        const to = Date.now();
        const from = to - days * 86_400_000;
        if (format === 'ndjson') {
            if (session.role !== 'owner' && session.role !== 'admin') {
                return NextResponse.json({ error: '只有管理员可以导出专题分析数据。' }, { status: 403 });
            }
            const rows = await exportShowcaseAnalyticsRows(from, to);
            await recordAuditLog({
                actorUserId: session.id,
                actorType: 'user',
                action: 'showcase_analytics_export',
                targetType: 'showcase_analytics',
                targetId: `${from}-${to}`,
                ip: null,
                userAgent: request.headers.get('user-agent'),
                metadata: { days, format, rowCount: rows.length }
            });
            const body = rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length > 0 ? '\n' : '');
            return new NextResponse(body, {
                status: 200,
                headers: {
                    'cache-control': 'no-store',
                    'content-type': 'application/x-ndjson; charset=utf-8',
                    'content-disposition': `attachment; filename="showcase-analytics-${days}d.ndjson"`
                }
            });
        }
        const summary = await getShowcaseAnalyticsSummary(from, to);
        return NextResponse.json({ summary, days });
    } catch (error) {
        return adminJsonError(error);
    }
}
