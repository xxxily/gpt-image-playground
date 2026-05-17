'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '@/lib/utils';

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
    return <PopoverPrimitive.Root data-slot='popover' {...props} />;
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
    return <PopoverPrimitive.Trigger data-slot='popover-trigger' {...props} />;
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
    return <PopoverPrimitive.Anchor data-slot='popover-anchor' {...props} />;
}

function PopoverContent({
    className,
    align = 'center',
    sideOffset = 6,
    children,
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
    return (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
                data-slot='popover-content'
                align={align}
                sideOffset={sideOffset}
                className={cn(
                    'z-50 min-w-[10rem] origin-(--radix-popover-content-transform-origin) rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-panel-lg outline-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
                    className
                )}
                {...props}>
                {children}
            </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
    );
}

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent };
