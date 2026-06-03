'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<React.ComponentProps<'input'>, 'type'> & {
    wrapperClassName?: string;
    showPasswordLabel?: string;
    hidePasswordLabel?: string;
};

function PasswordInput({
    className,
    wrapperClassName,
    disabled,
    showPasswordLabel,
    hidePasswordLabel,
    ...props
}: PasswordInputProps) {
    const { t } = useAppLanguage();
    const [isVisible, setIsVisible] = React.useState(false);
    const toggleLabel = isVisible
        ? (hidePasswordLabel ?? t('phase4b.hidePassword'))
        : (showPasswordLabel ?? t('phase4b.showPassword'));

    return (
        <div className={cn('relative', wrapperClassName)}>
            <Input {...props} type={isVisible ? 'text' : 'password'} disabled={disabled} className={cn('pr-10', className)} />
            <Button
                type='button'
                variant='ghost'
                size='icon'
                className='absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                aria-label={toggleLabel}
                aria-pressed={isVisible}
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setIsVisible((current) => !current)}>
                {isVisible ? <EyeOff className='size-4' aria-hidden='true' /> : <Eye className='size-4' aria-hidden='true' />}
            </Button>
        </div>
    );
}

export { PasswordInput };
