'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Key, Globe, Database, Eye, EyeOff, Settings, Plus, ExternalLink, Radio, ShieldAlert, Wifi, AlertTriangle } from 'lucide-react';
import * as React from 'react';
import { loadConfig, saveConfig, type AppConfig } from '@/lib/config';

type SettingsDialogProps = {
    onConfigChange: (config: Partial<AppConfig>) => void;
};

export function SettingsDialog({ onConfigChange }: SettingsDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [apiKey, setApiKey] = React.useState('');
    const [showApiKey, setShowApiKey] = React.useState(false);
    const [apiBaseUrl, setApiBaseUrl] = React.useState('');
    const [storageMode, setStorageMode] = React.useState<'fs' | 'indexeddb' | 'auto'>('auto');
    const [connectionMode, setConnectionMode] = React.useState<'proxy' | 'direct'>('proxy');
    const [saved, setSaved] = React.useState(false);
    const [hasEnvApiKey, setHasEnvApiKey] = React.useState(false);
    const [hasEnvApiBaseUrl, setHasEnvApiBaseUrl] = React.useState(false);
    const [hasEnvStorageMode, setHasEnvStorageMode] = React.useState(false);
    const [serverHasAppPassword, setServerHasAppPassword] = React.useState(false);
    const [initialConfig, setInitialConfig] = React.useState<{ apiKey: string; apiBaseUrl: string; storageMode: string; connectionMode: string }>({ apiKey: '', apiBaseUrl: '', storageMode: 'auto', connectionMode: 'proxy' });

    React.useEffect(() => {
        if (open) {
            const config = loadConfig();
            setApiKey(config.openaiApiKey || '');
            setApiBaseUrl(config.openaiApiBaseUrl || '');
            setStorageMode(config.imageStorageMode || 'auto');
            setConnectionMode(config.connectionMode || 'proxy');
            setInitialConfig({
                apiKey: config.openaiApiKey || '',
                apiBaseUrl: config.openaiApiBaseUrl || '',
                storageMode: config.imageStorageMode || 'auto',
                connectionMode: config.connectionMode || 'proxy'
            });
            setSaved(false);
            fetch('/api/config')
                .then((r) => r.json())
                .then((data) => {
                    setHasEnvApiKey(data.hasEnvApiKey || false);
                    setHasEnvApiBaseUrl(!!data.envApiBaseUrl);
                    setHasEnvStorageMode(!!data.envStorageMode);
                    setServerHasAppPassword(data.hasAppPassword || false);
                })
                .catch(() => {});
        }
    }, [open]);

    const handleSave = () => {
        const newConfig: Partial<AppConfig> = {};
        if (apiKey !== initialConfig.apiKey) newConfig.openaiApiKey = apiKey;
        if (apiBaseUrl !== initialConfig.apiBaseUrl) newConfig.openaiApiBaseUrl = apiBaseUrl;
        if (storageMode !== initialConfig.storageMode) newConfig.imageStorageMode = storageMode;
        if (connectionMode !== initialConfig.connectionMode) newConfig.connectionMode = connectionMode;

        // Validate: direct mode requires apiKey AND baseUrl
        if (connectionMode === 'direct') {
            const effectiveApiKey = apiKey || (hasEnvApiKey ? '(env)' : '');
            const effectiveBaseUrl = apiBaseUrl || (hasEnvApiBaseUrl ? '(env)' : '');
            if (!effectiveApiKey || effectiveApiKey === '(env)') {
                alert('直连模式需要配置 API Key，请在上方填写。');
                return;
            }
            if (!effectiveBaseUrl || effectiveBaseUrl === '(env)') {
                alert('直连模式需要配置 API Base URL（第三方中转地址），请在上方填写。');
                return;
            }
        }

        saveConfig(newConfig);
        onConfigChange(newConfig);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleReset = () => {
        localStorage.removeItem('gpt-image-playground-config');
        setApiKey('');
        setApiBaseUrl('');
        setStorageMode('auto');
        setConnectionMode('proxy');
        onConfigChange({ openaiApiKey: '', openaiApiBaseUrl: '', imageStorageMode: 'auto', connectionMode: 'proxy' });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const storageOptions = [
        { value: 'auto', label: '自动检测' },
        { value: 'fs', label: '文件系统' },
        { value: 'indexeddb', label: 'IndexedDB' }
    ];

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant='ghost'
                    size='icon'
                    className='text-white/60 hover:text-white hover:bg-white/10'
                    aria-label='Settings'>
                    <Settings className='h-4 w-4' />
                </Button>
            </DialogTrigger>
            <DialogContent className='border-white/[0.08] bg-[#12121a] text-white shadow-xl shadow-black/40 max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                    <DialogTitle className='text-lg font-medium'>系统配置</DialogTitle>
                    <DialogDescription className='text-white/60'>
                        配置 OpenAI API 和存储设置。UI 配置优先于 .env 文件。
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-5 py-4'>
                    <div className='space-y-3'>
                        <div className='flex items-center gap-2'>
                            <Label className='flex items-center gap-2 text-white'>
                                <Key className='h-4 w-4 text-white/60' />
                                OpenAI API Key
                            </Label>
                            {(hasEnvApiKey || apiKey) && (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${apiKey ? 'bg-green-500/15 text-green-400' : hasEnvApiKey ? 'bg-blue-500/15 text-blue-400' : 'bg-red-500/15 text-red-400'}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${apiKey ? 'bg-green-400' : 'bg-blue-400'}`} />
                                    {apiKey ? 'UI' : 'ENV'}
                                </span>
                            )}
                        </div>
                        <div className='relative'>
                            <Input
                                type={showApiKey ? 'text' : 'password'}
                                placeholder='sk-...'
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className='rounded-xl border-white/[0.08] bg-white/[0.04] pr-10 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/30 focus:bg-white/[0.06] transition-all duration-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
                            />
                            <button
                                type='button'
                                onClick={() => setShowApiKey(!showApiKey)}
                                className='absolute top-1/2 right-3 -translate-y-1/2 text-white/40 hover:text-white/70'
                            >
                                {showApiKey ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                            </button>
                        </div>
                        {hasEnvApiKey && (
                            <p className='text-xs text-white/40'>.env 中已配置，当前为空时使用 ENV 值。</p>
                        )}
                    </div>

                    <div className='space-y-3'>
                        <div className='flex items-center gap-2'>
                            <Label className='flex items-center gap-2 text-white'>
                                <Globe className='h-4 w-4 text-white/60' />
                                API Base URL
                                <span className='text-xs text-white/40 font-normal'>(可选)</span>
                            </Label>
                            {(hasEnvApiBaseUrl || apiBaseUrl) && (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${apiBaseUrl ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400'}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${apiBaseUrl ? 'bg-green-400' : 'bg-blue-400'}`} />
                                    {apiBaseUrl ? 'UI' : 'ENV'}
                                </span>
                            )}
                        </div>
                        <Input
                            type='url'
                            placeholder='https://api.openai.com/v1'
                            value={apiBaseUrl}
                            onChange={(e) => setApiBaseUrl(e.target.value)}
                            className='rounded-xl border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/30 focus:bg-white/[0.06] transition-all duration-200'
                        />
                        {hasEnvApiBaseUrl && (
                            <p className='text-xs text-white/40'>.env 中已配置，当前为空时使用 ENV 值。</p>
                        )}
                    </div>

                    <div className='space-y-3'>
                        <div className='flex items-center gap-2'>
                            <Label className='flex items-center gap-2 text-white'>
                                <Radio className='h-4 w-4 text-white/60' />
                                API 连接模式
                            </Label>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${connectionMode !== 'proxy' ? 'bg-amber-500/15 text-amber-400' : 'bg-green-500/15 text-green-400'}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${connectionMode === 'proxy' ? 'bg-green-400' : 'bg-amber-400'}`} />
                                {connectionMode === 'proxy' ? '服务器中转' : '客户端直连'}
                            </span>
                        </div>
                        <div className='flex gap-2'>
                            <button
                                type='button'
                                onClick={() => setConnectionMode('proxy')}
                                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${connectionMode === 'proxy' ? 'border-green-500/40 bg-green-500/10 text-green-400 shadow-inner' : 'border-white/[0.08] bg-white/[0.04] text-white/60 hover:bg-white/[0.06] hover:text-white/80'}`}
                            >
                                <Wifi className='h-4 w-4' />
                                服务器中转
                            </button>
                            <button
                                type='button'
                                onClick={() => setConnectionMode('direct')}
                                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${connectionMode === 'direct' ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-inner' : 'border-white/[0.08] bg-white/[0.04] text-white/60 hover:bg-white/[0.06] hover:text-white/80'}`}
                            >
                                <Wifi className='h-4 w-4 rotate-45' />
                                客户端直连
                            </button>
                        </div>
                        {connectionMode === 'direct' && (
                            <div className='space-y-2'>
                                <div className='rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3'>
                                    <div className='flex gap-2'>
                                        <AlertTriangle className='h-4 w-4 text-amber-400 shrink-0 mt-0.5' />
                                        <div className='space-y-1 text-xs text-amber-300/90'>
                                            <p className='font-medium text-amber-300'>直连模式注意事项</p>
                                            <ul className='list-disc list-inside space-y-0.5 text-amber-300/70'>
                                                <li>必须填写 API Base URL（需支持 CORS 的中转地址）</li>
                                                <li>必须填写 API Key，Key 会在浏览器 Network 面板明文显示</li>
                                                <li>如未设置中转地址，将回退到 <code className='text-amber-400'>https://api.openai.com/v1</code>（可能因 CORS 失败）</li>
                                                <li>{serverHasAppPassword ? '⚠️ 服务器配置了 APP_PASSWORD，直连模式将绕过密码验证' : '直连模式不经过服务器，不会触发 APP_PASSWORD 验证'}</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {connectionMode === 'proxy' && (
                            <p className='text-xs text-white/40'>请求经服务器转发，API Key 不在浏览器暴露，更安全</p>
                        )}
                    </div>

                    <div className='space-y-3'>
                        <div className='flex items-center gap-2'>
                            <Label className='flex items-center gap-2 text-white'>
                                <Database className='h-4 w-4 text-white/60' />
                                图片存储模式
                            </Label>
                            {(hasEnvStorageMode || storageMode) && (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${storageMode !== 'auto' ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400'}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${storageMode !== 'auto' ? 'bg-green-400' : 'bg-blue-400'}`} />
                                    {storageMode !== 'auto' ? 'UI' : 'ENV'}
                                </span>
                            )}
                        </div>
                        <Select onValueChange={(v) => setStorageMode(v as typeof storageMode)} value={storageMode}>
                            <SelectTrigger className='w-full rounded-xl border-white/[0.08] bg-white/[0.04] text-white focus:border-violet-500/50 focus:ring-violet-500/30 focus:bg-white/[0.06] transition-all duration-200'>
                                <SelectValue placeholder='选择存储模式' />
                            </SelectTrigger>
                            <SelectContent className='border-white/[0.08] bg-[#12121a] text-white shadow-xl shadow-black/40'>
                                {storageOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value} className='focus:bg-white/10'>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className='space-y-1'>
                            <p className='text-xs text-white/40'>
                                <strong>自动检测:</strong> Vercel → IndexedDB，本地运行 → 文件系统
                            </p>
                            <p className='text-xs text-white/40'>
                                <strong>文件系统:</strong> 图片保存到 <code className='text-white/60'>./generated-images</code> 目录
                            </p>
                            <p className='text-xs text-white/40'>
                                <strong>IndexedDB:</strong> 图片保存在浏览器本地存储，适合无服务器部署
                            </p>
                        </div>
                        {hasEnvStorageMode && (
                            <p className='text-xs text-white/40'>.env 中已配置，当前为"自动检测"时使用 ENV 值。</p>
                        )}
                    </div>

                    <div className='pt-2 border-t border-white/[0.06]'>
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={handleReset}
                            className='text-white/60 hover:text-red-400 hover:bg-red-500/10 h-auto p-0'>
                            <Plus className='h-3 w-3 rotate-45 mr-1' />
                            重置所有配置
                        </Button>
                    </div>
                </div>

                <DialogFooter className='gap-2'>
                    {saved && (
                        <p className='text-xs text-green-400 mr-auto'>已保存，配置立即生效 ✓</p>
                    )}
                    <Button
                        variant='ghost'
                        onClick={() => setOpen(false)}
                        className='border-white/[0.08] text-white/60 hover:text-white hover:bg-white/10'>
                        取消
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={connectionMode === 'direct' ? !apiKey : (!apiKey && !hasEnvApiKey)}
                        className='bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20 hover:shadow-violet-600/40 hover:brightness-110 disabled:from-white/10 disabled:to-white/10 disabled:shadow-none disabled:text-white/40'>
                        保存配置
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
