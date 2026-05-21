'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const iconButtonVariants = cva(
    "inline-flex shrink-0 items-center justify-center rounded-lg transition-all outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                subtle: 'bg-panel-subtle text-foreground hover:bg-accent border border-panel-divider',
                solid: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs',
                overlay:
                    'bg-black/40 text-white backdrop-blur hover:bg-black/60'
            },
            tone: {
                neutral: '',
                primary: '',
                destructive: ''
            },
            size: {
                sm: 'h-8 w-8 [&_svg:not([class*=size-])]:size-3.5',
                md: 'h-10 w-10 [&_svg:not([class*=size-])]:size-4',
                lg: 'h-11 w-11 [&_svg:not([class*=size-])]:size-5'
            }
        },
        compoundVariants: [
            { variant: 'ghost', tone: 'primary', class: 'text-primary hover:bg-primary/10 hover:text-primary' },
            {
                variant: 'ghost',
                tone: 'destructive',
                class: 'text-destructive hover:bg-destructive/10 hover:text-destructive'
            },
            { variant: 'solid', tone: 'destructive', class: 'bg-destructive text-white hover:bg-destructive/90' }
        ],
        defaultVariants: {
            variant: 'ghost',
            tone: 'neutral',
            size: 'md'
        }
    }
);

export type IconButtonProps = React.ComponentProps<'button'> &
    VariantProps<typeof iconButtonVariants> & {
        asChild?: boolean;
        tooltip?: React.ReactNode;
        tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
        'aria-label': string;
    };

function IconButton({
    className,
    variant,
    tone,
    size,
    asChild = false,
    tooltip,
    tooltipSide = 'top',
    children,
    ...props
}: IconButtonProps) {
    const Comp = asChild ? Slot : 'button';
    const ariaLabel = props['aria-label'];
    const button = (
        <Comp
            data-slot='icon-button'
            type={asChild ? undefined : (props.type ?? 'button')}
            className={cn(iconButtonVariants({ variant, tone, size }), className)}
            {...props}>
            {children}
        </Comp>
    );

    if (!tooltip) return button;

    return (
        <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side={tooltipSide}>{tooltip ?? ariaLabel}</TooltipContent>
        </Tooltip>
    );
}

export { IconButton, iconButtonVariants };
