'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Link2, LogOut, Settings2, Sparkles, ScrollText, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

type AdminShellProps = {
    children: React.ReactNode;
};

const navItems = [
    { href: '/admin', label: '总览', icon: LayoutDashboard },
    { href: '/admin/promo', label: '展示位', icon: Sparkles },
    { href: '/admin/short-links', label: '短链', icon: Link2 },
    { href: '/admin/users', label: '用户', icon: Users },
    { href: '/admin/audit', label: '审计', icon: ScrollText },
    { href: '/admin/settings', label: '设置', icon: Settings2 }
] as const;

export function AdminShell({ children }: AdminShellProps) {
    const [isLoggingOut, setIsLoggingOut] = React.useState(false);
    const pathname = usePathname();

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await fetch('/api/admin/logout', { method: 'POST' });
            window.location.assign('/admin/login');
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className='min-h-screen bg-background'>
            <header className='border-b border-border/60 bg-background/90 backdrop-blur'>
                <div className='mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4'>
                    <div className='flex min-w-0 items-center gap-3'>
                        <div className='bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl'>
                            <Sparkles className='size-5' />
                        </div>
                        <div className='min-w-0'>
                            <p className='truncate text-sm font-semibold'>后台管理</p>
                            <p className='text-muted-foreground truncate text-xs'>展示、用户与审计</p>
                        </div>
                    </div>
                    <Button variant='outline' size='sm' onClick={handleLogout} disabled={isLoggingOut}>
                        <LogOut className='mr-2 size-4' />
                        退出
                    </Button>
                </div>
            </header>
            <div className='mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)]'>
                <aside
                    aria-label='管理后台导航'
                    className='-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:gap-0 lg:space-y-2 lg:overflow-x-visible lg:px-0 lg:pb-0'>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active =
                            pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'border-border bg-card flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none lg:gap-3',
                                    active ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted/60'
                                )}>
                                <Icon className='size-4 shrink-0' />
                                <span className='truncate'>{item.label}</span>
                            </Link>
                        );
                    })}
                </aside>
                <main className='min-w-0'>{children}</main>
            </div>
        </div>
    );
}
