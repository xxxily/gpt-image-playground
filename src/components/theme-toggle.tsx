'use client';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';
import { Moon, Sun } from 'lucide-react';
import * as React from 'react';

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    const applyTheme = React.useCallback((theme: 'light' | 'dark') => {
        setTheme(theme);
    }, [setTheme]);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const isDark = mounted && resolvedTheme === 'dark';

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
