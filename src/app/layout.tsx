import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { PreventPageZoom } from '@/components/prevent-page-zoom';

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
};

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin']
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin']
});

export const metadata: Metadata = {
    title: 'GPT Image Playground',
    description: "Generate and edit images using OpenAI's GPT Image models.",
    icons: {
        icon: '/favicon.svg'
    }
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang='en' suppressHydrationWarning>
            <body className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}>
                <div className='fixed inset-0 pointer-events-none'>
                    <div className='app-grid-pattern absolute inset-0' />
                    <div className='absolute top-[-10%] right-[-5%] h-[800px] w-[800px] rounded-full bg-violet-500/10 blur-[160px]' />
                    <div className='absolute bottom-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-blue-600/8 blur-[140px]' />
                    <div className='absolute top-[40%] left-[50%] h-[400px] w-[400px] rounded-full bg-purple-500/5 blur-[120px]' />
                </div>
                <ThemeProvider attribute='class' defaultTheme='dark' enableSystem disableTransitionOnChange enableColorScheme>
                    <PreventPageZoom />
                    <div className='relative z-10 touch-manipulation'>
                        {children}
                    </div>
                </ThemeProvider>
            </body>
        </html>
    );
}
