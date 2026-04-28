import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { PreventPageZoom } from '@/components/prevent-page-zoom';

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
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
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0a0a0f] text-white`}>
                <div className='fixed inset-0 pointer-events-none'>
                    <div className='absolute inset-0' style={{
                        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
                        backgroundSize: '40px 40px'
                    }} />
                    <div className='absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-[#6d28d9]/10 rounded-full blur-[160px]' />
                    <div className='absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#1d4ed8]/8 rounded-full blur-[140px]' />
                    <div className='absolute top-[40%] left-[50%] w-[400px] h-[400px] bg-[#7c3aed]/5 rounded-full blur-[120px]' />
                </div>
                <ThemeProvider attribute='class' defaultTheme='dark' enableSystem={false} disableTransitionOnChange>
                    <PreventPageZoom />
                    <div className='relative z-10'>
                        {children}
                    </div>
                </ThemeProvider>
            </body>
        </html>
    );
}
