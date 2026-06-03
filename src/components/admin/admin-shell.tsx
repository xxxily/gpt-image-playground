'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { LocalizedMessage } from '@/components/localized-message';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { KeyRound, LayoutDashboard, Link2, LogOut, Settings2, Sparkles, ScrollText, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

type AdminShellProps = {
    children: React.ReactNode;
};

const navItems = [
    { href: '/admin', labelKey: 'admin.nav.overview', icon: LayoutDashboard },
    { href: '/admin/promo', labelKey: 'admin.nav.promo', icon: Sparkles },
    { href: '/admin/public-actions', labelKey: 'admin.nav.publicActions', icon: KeyRound },
    { href: '/admin/short-links', labelKey: 'admin.nav.shortLinks', icon: Link2 },
    { href: '/admin/users', labelKey: 'admin.nav.users', icon: Users },
    { href: '/admin/audit', labelKey: 'admin.nav.audit', icon: ScrollText },
    { href: '/admin/settings', labelKey: 'admin.nav.settings', icon: Settings2 }
] as const;

export function AdminShell({ children }: AdminShellProps) {
    const { t } = useAppLanguage();
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
        <div className='bg-background min-h-screen'>
            <header className='border-border/60 bg-background/90 border-b backdrop-blur'>
                <div className='mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4'>
                    <div className='flex min-w-0 items-center gap-3'>
                        <div className='bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl'>
                            <Sparkles className='size-5' />
                        </div>
                        <div className='min-w-0'>
                            <p className='truncate text-sm font-semibold'>
                                <LocalizedMessage id='phase4b.admin' />
                            </p>
                            <p className='text-muted-foreground truncate text-xs'>
                                <LocalizedMessage id='phase4b.promosUsersAndAudit' />
                            </p>
                        </div>
                    </div>
                    <Button variant='outline' size='sm' onClick={handleLogout} disabled={isLoggingOut}>
                        <LogOut className='mr-2 size-4' />
                        <LocalizedMessage id='phase4b.signOut' />
                    </Button>
                </div>
            </header>
            <div className='mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)]'>
                <aside
                    aria-label={t('phase4b.adminNavigation')}
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
                                    'border-border bg-card focus-visible:ring-ring/50 flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none lg:gap-3',
                                    active ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted/60'
                                )}>
                                <Icon className='size-4 shrink-0' />
                                <span className='truncate'>{t(item.labelKey)}</span>
                            </Link>
                        );
                    })}
                </aside>
                <main className='min-w-0'>{children}</main>
            </div>
        </div>
    );
}
