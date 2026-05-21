import * as React from 'react';
import { cn } from '@/lib/utils';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type HeadingSize = 'page' | 'section' | 'card' | 'sub';

const SIZE_CLASSNAMES: Record<HeadingSize, string> = {
    page: 'text-foreground text-lg font-semibold tracking-tight sm:text-2xl md:text-3xl',
    section: 'text-foreground text-2xl font-semibold',
    card: 'text-foreground text-lg font-semibold sm:text-xl',
    sub: 'text-foreground text-sm font-semibold',
};

export interface HeadingProps extends Omit<React.ComponentPropsWithoutRef<'h2'>, 'size'> {
    /** HTML 语义层级（影响 dom 标签），默认 2 */
    level?: HeadingLevel;
    /** 视觉尺寸；与 level 解耦，默认按 level 推导（1=page, 2=section, 3=card, 其他=sub） */
    size?: HeadingSize;
    asChild?: never;
}

function deriveSizeFromLevel(level: HeadingLevel): HeadingSize {
    if (level === 1) return 'page';
    if (level === 2) return 'section';
    if (level === 3) return 'card';
    return 'sub';
}

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
    { level = 2, size, className, children, ...props },
    ref,
) {
    const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    const resolvedSize = size ?? deriveSizeFromLevel(level);
    return (
        <Tag ref={ref} data-slot='heading' className={cn(SIZE_CLASSNAMES[resolvedSize], className)} {...props}>
            {children}
        </Tag>
    );
});
