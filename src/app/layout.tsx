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
                <Script id='app-theme-init' strategy='beforeInteractive' dangerouslySetInnerHTML={{ __html: buildThemeInitializerScript() }} />
                <Script id='app-language-init' strategy='beforeInteractive' dangerouslySetInnerHTML={{ __html: buildLanguageInitializerScript() }} />
                {isUmamiAnalyticsEnabled ? (
                    <Script id='umami-analytics' src={umamiScriptUrl} strategy='afterInteractive' data-website-id={umamiWebsiteId} />
                ) : null}
                <DisableDevtoolBootstrap />
                <div className='fixed inset-0 pointer-events-none'>
                    <div className='app-grid-pattern absolute inset-0' />
                    <div className='absolute top-[-10%] right-[-5%] h-[800px] w-[800px] rounded-full bg-violet-500/10 blur-[160px]' />
                    <div className='absolute bottom-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-blue-600/8 blur-[140px]' />
                    <div className='absolute top-[40%] left-[50%] h-[400px] w-[400px] rounded-full bg-purple-500/5 blur-[120px]' />
                </div>
                <ThemeProvider {...appThemeProviderConfig}>
                    <AppLanguageProvider>
                        <NoticeProvider>
                            <DocumentLanguageMetaSync />
                            <I18nTextBridge />
                            <PreventPageZoom />
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
