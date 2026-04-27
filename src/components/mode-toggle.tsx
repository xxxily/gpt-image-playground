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
            <TabsList className='grid rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-1 gap-1 h-auto'>
                <TabsTrigger
                    value='generate'
                    className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                        currentMode === 'generate'
                            ? 'border-white/20 bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25'
                            : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:bg-white/10 hover:text-white/80'
                    } `}>
                    生成
                </TabsTrigger>
                <TabsTrigger
                    value='edit'
                    className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                        currentMode === 'edit'
                            ? 'border-white/20 bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25'
                            : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:bg-white/10 hover:text-white/80'
                    } `}>
                    编辑
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
