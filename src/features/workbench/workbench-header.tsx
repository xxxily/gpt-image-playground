import { AboutDialog } from '@/components/about-dialog';
import { PromoSlot } from '@/components/promo-slot';
import { SettingsDialog } from '@/components/settings-dialog';
import { ThemeToggle } from '@/components/theme-toggle';
import { Heading } from '@/components/ui/heading';
import type { AppConfig } from '@/lib/config';
import Image from 'next/image';
import * as React from 'react';

type WorkbenchHeaderProps = {
    onConfigChange: (newConfig: Partial<AppConfig>) => void;
    settingsOpenTarget: React.ComponentProps<typeof SettingsDialog>['openTarget'];
    promoProfileId?: string | null;
};

export function WorkbenchHeader({ onConfigChange, settingsOpenTarget, promoProfileId }: WorkbenchHeaderProps) {
    return (
        <div className='mb-2 w-full max-w-screen-2xl pt-[max(0.5rem,env(safe-area-inset-top))] [padding-right:max(1rem,env(safe-area-inset-right))] [padding-left:max(1rem,env(safe-area-inset-left))] sm:mb-4 md:px-0 md:pt-0'>
            <div className='flex w-full items-center justify-between gap-2 py-0 sm:gap-3 sm:py-1.5'>
                <div className='flex min-w-0 items-center gap-2 sm:gap-3'>
                    <span className='ring-border flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-white to-violet-50 shadow-inner ring-1 sm:h-10 sm:w-10 sm:rounded-xl dark:from-white/95 dark:to-sky-100/90'>
                        <Image
                            src='/favicon.svg'
                            alt=''
                            aria-hidden='true'
                            width={28}
                            height={28}
                            className='h-5 w-5 sm:h-7 sm:w-7'
                        />
                    </span>
                    <div className='hidden min-w-0 sm:block'>
                        <Heading
                            level={1}
                            size='page'
                            className='from-foreground truncate bg-gradient-to-r via-violet-700 to-sky-700 bg-clip-text font-black text-transparent dark:via-violet-200 dark:to-sky-200'>
                            GPT Image Playground
                        </Heading>
                        <p className='text-muted-foreground -mt-0.5 truncate text-xs font-medium tracking-widest uppercase sm:mt-0.5'>
                            AI image generation studio
                        </p>
                    </div>
                </div>
                <div className='flex shrink-0 items-center gap-1 sm:gap-2 [&_[data-slot=button]]:size-9'>
                    <ThemeToggle />
                    <AboutDialog />
                    <SettingsDialog onConfigChange={onConfigChange} openTarget={settingsOpenTarget} />
                </div>
            </div>
            <div className='hidden sm:mt-3 sm:block'>
                <PromoSlot
                    slotKey='app_top_banner'
                    surface='home'
                    promoProfileId={promoProfileId}
                    className='w-full'
                />
            </div>
        </div>
    );
}
