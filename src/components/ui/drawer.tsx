'use client';

import { LocalizedMessage } from '@/components/localized-message';
import { useDialogHistoryEntry } from '@/components/ui/dialog-history';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

export type AppDrawerSide = 'right' | 'left' | 'bottom';

type DrawerContextValue = {
    side: AppDrawerSide;
    fullScreenOnMobile: boolean;
    preferredWidth?: string;
};

const DrawerContext = React.createContext<DrawerContextValue>({
    side: 'right',
    fullScreenOnMobile: true
});

function Drawer({
    open: openProp,
    defaultOpen,
    onOpenChange,
    side = 'right',
    fullScreenOnMobile = true,
    preferredWidth,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Root> & {
    side?: AppDrawerSide;
    fullScreenOnMobile?: boolean;
    preferredWidth?: string;
}) {
    const isControlled = openProp !== undefined;
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(Boolean(defaultOpen));
    const open = isControlled ? openProp : uncontrolledOpen;

    const handleOpenChange = React.useCallback(
        (nextOpen: boolean) => {
            if (!isControlled) setUncontrolledOpen(nextOpen);
            onOpenChange?.(nextOpen);
        },
        [isControlled, onOpenChange]
    );

    useDialogHistoryEntry(Boolean(open), () => handleOpenChange(false));

    const contextValue = React.useMemo(
        () => ({ side, fullScreenOnMobile, preferredWidth }),
        [fullScreenOnMobile, preferredWidth, side]
    );

    return (
        <DrawerContext.Provider value={contextValue}>
            <DialogPrimitive.Root data-slot='drawer' open={open} onOpenChange={handleOpenChange} {...props} />
        </DrawerContext.Provider>
    );
}

function DrawerTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
    return <DialogPrimitive.Trigger data-slot='drawer-trigger' {...props} />;
}

function DrawerPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
    return <DialogPrimitive.Portal data-slot='drawer-portal' {...props} />;
}

function DrawerClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
    return <DialogPrimitive.Close data-slot='drawer-close' {...props} />;
}

function DrawerOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
    return (
        <DialogPrimitive.Overlay
            data-slot='drawer-overlay'
            className={cn(
                'fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
                className
            )}
            {...props}
        />
    );
}

function DrawerContent({
    className,
    children,
    style,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
    const { side, fullScreenOnMobile, preferredWidth } = React.useContext(DrawerContext);

    const sideClass =
        side === 'left'
            ? 'left-0 top-0 h-dvh border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left'
            : side === 'bottom'
              ? 'bottom-0 left-0 right-0 h-[min(88dvh,42rem)] border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom'
              : 'right-0 top-0 h-dvh border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right';
    const widthClass = side === 'bottom' ? 'w-screen max-w-none' : 'w-screen sm:w-[var(--drawer-width)] sm:max-w-[calc(100vw-2rem)]';

    return (
        <DrawerPortal>
            <DrawerOverlay />
            <DialogPrimitive.Content
                data-slot='drawer-content'
                data-side={side}
                style={{
                    '--drawer-width': preferredWidth ?? 'min(720px,45vw)',
                    ...style
                } as React.CSSProperties}
                className={cn(
                    'bg-background text-foreground fixed z-50 flex flex-col overflow-hidden border-border shadow-2xl outline-none duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in',
                    widthClass,
                    sideClass,
                    fullScreenOnMobile &&
                        'max-sm:inset-0 max-sm:h-dvh max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0',
                    className
                )}
                {...props}>
                {children}
                <DialogPrimitive.Close className='ring-offset-background focus:ring-ring absolute top-[max(0.5rem,env(safe-area-inset-top))] right-[max(0.5rem,env(safe-area-inset-right))] z-10 flex h-10 w-10 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none'>
                    <X className='h-4 w-4' />
                    <span className='sr-only'>
                        <LocalizedMessage id='phase4b.close' />
                    </span>
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DrawerPortal>
    );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot='drawer-header'
            className={cn(
                'border-border bg-background/95 shrink-0 border-b px-4 py-3 pr-14 backdrop-blur sm:px-5',
                className
            )}
            {...props}
        />
    );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            data-slot='drawer-title'
            className={cn('text-base leading-6 font-semibold', className)}
            {...props}
        />
    );
}

function DrawerDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            data-slot='drawer-description'
            className={cn('text-muted-foreground text-sm', className)}
            {...props}
        />
    );
}

function DrawerBody({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot='drawer-body'
            className={cn(
                'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5',
                className
            )}
            {...props}
        />
    );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot='drawer-footer'
            className={cn(
                'border-border bg-background/95 shrink-0 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-5',
                className
            )}
            {...props}
        />
    );
}

export {
    Drawer,
    DrawerBody,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerOverlay,
    DrawerPortal,
    DrawerTitle,
    DrawerTrigger
};
