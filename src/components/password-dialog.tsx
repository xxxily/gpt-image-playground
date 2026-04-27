'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import * as React from 'react';

interface PasswordDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (password: string) => void;
    title?: string;
    description?: string;
}

export function PasswordDialog({
    isOpen,
    onOpenChange,
    onSave,
    title = '设置密码',
    description
}: PasswordDialogProps) {
    const [currentPassword, setCurrentPassword] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleSave = () => {
        inputRef.current?.blur();
        onSave(currentPassword);
        setCurrentPassword('');
        onOpenChange(false);
    };

    const handleDialogClose = (open: boolean) => {
        if (!open) {
            setCurrentPassword('');
        }
        onOpenChange(open);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogContent className='border-white/[0.08] bg-[#0e0e16]/95 backdrop-blur-xl text-white sm:max-w-[425px] shadow-2xl shadow-black/50'>
                <DialogHeader>
                    <DialogTitle className='text-white'>{title}</DialogTitle>
                    {description && <DialogDescription className='text-white/60'>{description}</DialogDescription>}
                </DialogHeader>
                <div className='grid gap-4 py-4'>
                    <div className='grid grid-cols-1 items-center gap-4'>
                        <Input
                            ref={inputRef}
                            id='password-input'
                            type='password'
                            placeholder='输入密码'
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className='col-span-1 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/30 focus:bg-white/[0.06] transition-all duration-200'
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && currentPassword.trim()) {
                                    e.preventDefault();
                                    handleSave();
                                }
                            }}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        type='button'
                        onClick={handleSave}
                        disabled={!currentPassword.trim()}
                        className='bg-gradient-to-r from-violet-600 to-indigo-600 px-6 text-white shadow-lg shadow-violet-600/20 hover:brightness-110 transition-all duration-200 disabled:from-white/10 disabled:to-white/10 disabled:shadow-none disabled:text-white/40'>
                        保存
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
