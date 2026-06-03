'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';

type SecretInputProps = {
    id: string;
    value: string;
    onChange: (value: string) => void;
    visible: boolean;
    onVisibleChange: () => void;
    placeholder: string;
};

export function SecretInput({ id, value, onChange, visible, onVisibleChange, placeholder }: SecretInputProps) {
    const { t } = useAppLanguage();

    return (
        <div className='relative'>
            <Input
                id={id}
                name={`${id}-not-password`}
                type={visible ? 'text' : 'password'}
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                spellCheck={false}
                autoComplete='one-time-code'
                autoCorrect='off'
                autoCapitalize='none'
                data-1p-ignore='true'
                data-bwignore='true'
                data-lpignore='true'
                className='bg-background text-foreground h-10 rounded-xl pr-10'
            />
            <IconButton
                variant='ghost'
                size='sm'
                onClick={onVisibleChange}
                className='absolute top-1/2 right-2 -translate-y-1/2'
                aria-label={visible ? t('phase4b.hideApiKey') : t('phase4b.showApiKey')}>
                {visible ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
            </IconButton>
        </div>
    );
}
