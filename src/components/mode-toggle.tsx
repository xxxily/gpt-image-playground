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
            <TabsList className='grid h-auto gap-1 rounded-xl border border-border bg-card/70 p-1 backdrop-blur-sm dark:border-panel-divider dark:bg-panel-soft'>
                <TabsTrigger
                    value='generate'
                    className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                        currentMode === 'generate'
                            ? 'border-panel-divider bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25'
                            : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground dark:border-panel-divider dark:bg-panel-soft dark:text-on-panel-muted dark:hover:border-panel-divider dark:hover:bg-accent dark:hover:text-on-panel-muted'
                    } `}>
                    生成
                </TabsTrigger>
                <TabsTrigger
                    value='edit'
                    className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                        currentMode === 'edit'
                            ? 'border-panel-divider bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25'
                            : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground dark:border-panel-divider dark:bg-panel-soft dark:text-on-panel-muted dark:hover:border-panel-divider dark:hover:bg-accent dark:hover:text-on-panel-muted'
                    } `}>
                    编辑
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
