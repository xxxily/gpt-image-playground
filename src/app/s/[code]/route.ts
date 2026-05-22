import { NextRequest, NextResponse } from 'next/server';
import { resolveShortLinkRedirect } from '@/lib/server/short-links';

type Params = { params: Promise<{ code: string }> };

function shortLinkErrorPage(status: number): NextResponse {
    const title = status === 410 ? '短链已失效' : '短链不存在';
    const body = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: Canvas; color: CanvasText; }
    main { width: min(480px, calc(100vw - 32px)); border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 12px; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    p { margin: 0; line-height: 1.7; color: color-mix(in srgb, CanvasText 72%, transparent); }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>这个分享短链不可用。请检查链接是否完整，或联系分享者重新生成。</p>
  </main>
</body>
</html>`;
    return new NextResponse(body, {
        status,
        headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store'
        }
    });
}

async function handle(request: NextRequest, { params }: Params, method: 'GET' | 'HEAD') {
    const { code } = await params;
    const result = await resolveShortLinkRedirect(request, code, method);
    if (!result.ok) return method === 'HEAD' ? new NextResponse(null, { status: result.status }) : shortLinkErrorPage(result.status);

    return new NextResponse(null, {
        status: 302,
        headers: {
            location: result.url,
            'cache-control': 'no-store'
        }
    });
}

export async function GET(request: NextRequest, params: Params) {
    return handle(request, params, 'GET');
}

export async function HEAD(request: NextRequest, params: Params) {
    return handle(request, params, 'HEAD');
}
