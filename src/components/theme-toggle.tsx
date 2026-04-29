'use client';

import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import * as React from 'react';

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);
    const [activeTheme, setActiveTheme] = React.useState<'light' | 'dark'>('dark');

    const applyTheme = React.useCallback((theme: 'light' | 'dark') => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        document.documentElement.style.colorScheme = theme;
        window.localStorage.setItem('theme', theme);
        setActiveTheme(theme);
        setTheme(theme);
    }, [setTheme]);

    React.useEffect(() => {
        setMounted(true);

        const storedTheme = window.localStorage.getItem('theme');
        const nextTheme = storedTheme === 'light' || storedTheme === 'dark'
            ? storedTheme
            : resolvedTheme === 'light'
                ? 'light'
                : 'dark';
        document.documentElement.classList.toggle('dark', nextTheme === 'dark');
        document.documentElement.style.colorScheme = nextTheme;
        setActiveTheme(nextTheme);
    }, [resolvedTheme]);

    const isDark = activeTheme === 'dark';

    return (
        <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={() => applyTheme(isDark ? 'light' : 'dark')}
            className='text-foreground/60 hover:bg-accent hover:text-foreground'
            aria-label={isDark ? '切换到浅色主题' : '切换到深色主题'}
            title={isDark ? '浅色主题' : '深色主题'}>
            {mounted && isDark ? <Sun className='h-4 w-4' /> : <Moon className='h-4 w-4' />}
        </Button>
    );
}
