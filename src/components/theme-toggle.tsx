'use client';

import { Button } from '@/components/ui/button';
import { useAppLanguage } from '@/components/app-language-provider';
import { useTheme } from '@/components/theme-provider';
import { Monitor, Moon, Sun } from 'lucide-react';
import * as React from 'react';

type CycleTheme = 'light' | 'dark' | 'system';

const NEXT_THEME: Record<CycleTheme, CycleTheme> = {
    light: 'dark',
    dark: 'system',
    system: 'light'
};

export function ThemeToggle() {
    const { theme, resolvedTheme, setTheme } = useTheme();
    const { t } = useAppLanguage();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const currentCycle: CycleTheme = mounted
        ? theme === 'system'
            ? 'system'
            : resolvedTheme === 'dark'
              ? 'dark'
              : 'light'
        : 'light';

    const Icon = currentCycle === 'system' ? Monitor : currentCycle === 'dark' ? Sun : Moon;

    const ariaLabelKey =
        currentCycle === 'light'
            ? 'theme.switchToDark'
            : currentCycle === 'dark'
              ? 'theme.switchToSystem'
              : 'theme.switchToLight';

    const titleKey =
        currentCycle === 'system'
            ? 'theme.system'
            : currentCycle === 'dark'
              ? 'theme.dark'
              : 'theme.light';

    return (
        <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={() => setTheme(NEXT_THEME[currentCycle])}
            className='text-foreground/60 hover:bg-accent hover:text-foreground'
            aria-label={t(ariaLabelKey)}
            title={t(titleKey)}>
            <Icon className='h-4 w-4' />
        </Button>
    );
}
