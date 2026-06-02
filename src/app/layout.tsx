import './globals.css';
import { AppLanguageProvider } from '@/components/app-language-provider';
import { DisableDevtoolBootstrap } from '@/components/disable-devtool-bootstrap';
import { DocumentLanguageMetaSync } from '@/components/document-language-meta-sync';
import { I18nTextBridge } from '@/components/i18n-text-bridge';
import { KeyboardInsetWatcher } from '@/components/keyboard-inset-watcher';
import { NetworkBanner } from '@/components/network-banner';
import { NoticeProvider } from '@/components/notice-provider';
import { PreventPageZoom } from '@/components/prevent-page-zoom';
import { PublicRuntimeConfigProvider } from '@/components/public-runtime-config-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { buildLanguageInitializerScript } from '@/lib/i18n/initializer';
import { appThemeProviderConfig, buildThemeInitializerScript } from '@/lib/theme-config';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover'
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
                <Script
                    id='app-theme-init'
                    strategy='beforeInteractive'
                    dangerouslySetInnerHTML={{ __html: buildThemeInitializerScript() }}
                />
                <Script
                    id='app-language-init'
                    strategy='beforeInteractive'
                    dangerouslySetInnerHTML={{ __html: buildLanguageInitializerScript() }}
                />
                <Script
                    id='extension-error-filter'
                    strategy='beforeInteractive'
                    dangerouslySetInnerHTML={{
                        __html: `
                            (() => {
                                const isExtensionCommandError = (value) => {
                                    const message = String(value?.message ?? value ?? '');
                                    const filename = String(value?.filename ?? '');
                                    const stack = String(value?.error?.stack ?? value?.stack ?? value?.reason?.stack ?? '');
                                    return message.includes('commandFunc.apply is not a function') &&
                                        (filename.startsWith('chrome-extension://') || stack.includes('chrome-extension://'));
                                };
                                window.addEventListener('error', (event) => {
                                    if (!isExtensionCommandError(event)) return;
                                    event.preventDefault();
                                    event.stopImmediatePropagation();
                                }, true);
                                window.addEventListener('unhandledrejection', (event) => {
                                    if (!isExtensionCommandError(event.reason)) return;
                                    event.preventDefault();
                                    event.stopImmediatePropagation();
                                }, true);
                            })();
                        `
                    }}
                />
                <a
                    href='#main-content'
                    className='bg-background text-foreground border-border focus:ring-ring focus:ring-offset-background sr-only fixed top-2 left-2 z-[100] rounded-md border px-3 py-1.5 text-sm font-medium focus:not-sr-only focus:ring-2 focus:ring-offset-2 focus:outline-none'>
                    跳到主内容
                </a>
                {isUmamiAnalyticsEnabled ? (
                    <Script
                        id='umami-analytics'
                        src={umamiScriptUrl}
                        strategy='afterInteractive'
                        data-website-id={umamiWebsiteId}
                    />
                ) : null}
                <DisableDevtoolBootstrap />
                <div className='pointer-events-none fixed inset-0' aria-hidden='true'>
                    <div className='app-grid-pattern absolute inset-0' />
                </div>
                <ThemeProvider {...appThemeProviderConfig}>
                    <AppLanguageProvider>
                        <NoticeProvider>
                            <PublicRuntimeConfigProvider>
                                <DocumentLanguageMetaSync />
                                <I18nTextBridge />
                                <PreventPageZoom />
                                <KeyboardInsetWatcher />
                                <NetworkBanner />
                                <div className='relative z-10 touch-manipulation'>{children}</div>
                            </PublicRuntimeConfigProvider>
                        </NoticeProvider>
                    </AppLanguageProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
