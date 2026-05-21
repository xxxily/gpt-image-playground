import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { PreventPageZoom } from '@/components/prevent-page-zoom';
import { DisableDevtoolBootstrap } from '@/components/disable-devtool-bootstrap';
import { NoticeProvider } from '@/components/notice-provider';
import { AppLanguageProvider } from '@/components/app-language-provider';
import { DocumentLanguageMetaSync } from '@/components/document-language-meta-sync';
import { I18nTextBridge } from '@/components/i18n-text-bridge';
import { KeyboardInsetWatcher } from '@/components/keyboard-inset-watcher';
import { NetworkBanner } from '@/components/network-banner';
import { buildLanguageInitializerScript } from '@/lib/i18n/initializer';
import { appThemeProviderConfig, buildThemeInitializerScript } from '@/lib/theme-config';

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
};

export const metadata: Metadata = {
    title: 'GPT Image Playground',
    description: "Generate and edit images using OpenAI's GPT Image models.",
    icons: {
        icon: '/favicon.svg'
    }
};

const umamiScriptUrl = process.env.UMAMI_SCRIPT_URL?.trim();
const umamiWebsiteId = process.env.UMAMI_WEBSITE_ID?.trim();
const isUmamiAnalyticsEnabled = Boolean(umamiScriptUrl && umamiWebsiteId);

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang='zh-CN' suppressHydrationWarning>
            <body className='bg-background text-foreground antialiased'>
                <a
                    href='#main-content'
                    className='sr-only focus:not-sr-only fixed top-2 left-2 z-[100] bg-background text-foreground border border-border px-3 py-1.5 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background'
                >
                    跳到主内容
                </a>
                <Script id='app-theme-init' strategy='beforeInteractive' dangerouslySetInnerHTML={{ __html: buildThemeInitializerScript() }} />
                <Script id='app-language-init' strategy='beforeInteractive' dangerouslySetInnerHTML={{ __html: buildLanguageInitializerScript() }} />
                {isUmamiAnalyticsEnabled ? (
                    <Script id='umami-analytics' src={umamiScriptUrl} strategy='afterInteractive' data-website-id={umamiWebsiteId} />
                ) : null}
                <DisableDevtoolBootstrap />
                <div className='pointer-events-none fixed inset-0' aria-hidden='true'>
                    <div className='app-grid-pattern absolute inset-0' />
                </div>
                <ThemeProvider {...appThemeProviderConfig}>
                    <AppLanguageProvider>
                        <NoticeProvider>
                            <DocumentLanguageMetaSync />
                            <I18nTextBridge />
                            <PreventPageZoom />
                            <KeyboardInsetWatcher />
                            <NetworkBanner />
                            <div className='relative z-10 touch-manipulation'>
                                {children}
                            </div>
                        </NoticeProvider>
                    </AppLanguageProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
