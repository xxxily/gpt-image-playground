'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ModeToggleProps = {
    currentMode: 'generate' | 'edit';
    onModeChange: (mode: 'generate' | 'edit') => void;
};

export function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
    return (
        <Tabs
            value={currentMode}
            onValueChange={(value) => onModeChange(value as 'generate' | 'edit')}
            className='w-auto'>
            <TabsList className='grid h-auto gap-1 rounded-xl border border-border bg-card/70 p-1 backdrop-blur-sm dark:border-white/10 dark:bg-white/5'>
                <TabsTrigger
                    value='generate'
                    className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                        currentMode === 'generate'
                            ? 'border-white/20 bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25'
                            : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:text-white/50 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white/80'
                    } `}>
                    生成
                </TabsTrigger>
                <TabsTrigger
                    value='edit'
                    className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                        currentMode === 'edit'
                            ? 'border-white/20 bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25'
                            : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:text-white/50 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white/80'
                    } `}>
                    编辑
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
