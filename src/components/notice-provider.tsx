'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { readDismissedNoticeKeys, writeDismissedNoticeKeys } from '@/lib/notice-persistence';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import * as React from 'react';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

export type NoticeAction = {
    label: string;
    onClick: () => void;
};

export type NoticeOptions = {
    tone?: NoticeTone;
    durationMs?: number;
    action?: NoticeAction;
    persistKey?: string;
};

export type NoticeItem = {
    id: string;
    message: string;
    tone: NoticeTone;
    createdAt: number;
    action?: NoticeAction;
    persistKey?: string;
};

type NoticeContextValue = {
    notices: NoticeItem[];
    addNotice: (message: string, toneOrOptions?: NoticeTone | NoticeOptions) => void;
    dismissNotice: (id: string) => void;
};

const NoticeContext = React.createContext<NoticeContextValue>({
    notices: [],
    addNotice: () => {},
    dismissNotice: () => {}
});

export function useNotice() {
    return React.useContext(NoticeContext);
}

export function useMessage() {
    return useNotice();
}

const DEFAULT_DISMISS_DURATION_MS = 5000;
const MAX_VISIBLE_NOTICES = 4;
let noticeIdCounter = 0;

function getLocalStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function nextNoticeId(): string {
    noticeIdCounter += 1;
    return `notice-${Date.now()}-${noticeIdCounter}`;
}

const toneIcon = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle
};

const toneClasses: Record<NoticeTone, string> = {
    info: 'border-sky-400/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    warning: 'border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    error: 'border-red-400/30 bg-red-500/10 text-red-700 dark:text-red-300'
};

export function NoticeProvider({ children }: { children: React.ReactNode }) {
    const { t } = useAppLanguage();
    const [notices, setNotices] = React.useState<NoticeItem[]>([]);
    const timersRef = React.useRef<Map<string, number>>(new Map());
    const dismissedSetRef = React.useRef<Set<string> | null>(null);

    const getDismissedSet = React.useCallback((): Set<string> => {
        if (dismissedSetRef.current === null) {
            dismissedSetRef.current = readDismissedNoticeKeys(getLocalStorage());
        }
        return dismissedSetRef.current;
    }, []);

    const recordPersistedDismissal = React.useCallback(
        (persistKey: string | undefined) => {
            if (!persistKey) return;
            const set = getDismissedSet();
            if (set.has(persistKey)) return;
            set.add(persistKey);
            writeDismissedNoticeKeys(getLocalStorage(), set);
        },
        [getDismissedSet]
    );

    const dismissNotice = React.useCallback(
        (id: string) => {
            const timer = timersRef.current.get(id);
            if (timer) {
                clearTimeout(timer);
                timersRef.current.delete(id);
            }
            setNotices((prev) => {
                const target = prev.find((n) => n.id === id);
                if (target?.persistKey) recordPersistedDismissal(target.persistKey);
                return prev.filter((n) => n.id !== id);
            });
        },
        [recordPersistedDismissal]
    );

    const addNotice = React.useCallback(
        (message: string, toneOrOptions?: NoticeTone | NoticeOptions) => {
            const isOptionsObject = toneOrOptions !== null && typeof toneOrOptions === 'object';
            const tone: NoticeTone = isOptionsObject
                ? ((toneOrOptions as NoticeOptions).tone ?? 'info')
                : ((toneOrOptions as NoticeTone | undefined) ?? 'info');
            const action = isOptionsObject ? (toneOrOptions as NoticeOptions).action : undefined;
            const durationMs = isOptionsObject
                ? ((toneOrOptions as NoticeOptions).durationMs ?? DEFAULT_DISMISS_DURATION_MS)
                : DEFAULT_DISMISS_DURATION_MS;
            const persistKey = isOptionsObject ? (toneOrOptions as NoticeOptions).persistKey : undefined;

            if (persistKey && getDismissedSet().has(persistKey)) return;

            const id = nextNoticeId();
            setNotices((prev) => {
                const updated = [...prev, { id, message, tone, createdAt: Date.now(), action, persistKey }];
                if (updated.length > MAX_VISIBLE_NOTICES) {
                    const oldest = updated[0]?.id;
                    if (oldest) {
                        const timer = timersRef.current.get(oldest);
                        if (timer) {
                            clearTimeout(timer);
                            timersRef.current.delete(oldest);
                        }
                    }
                    return updated.slice(-MAX_VISIBLE_NOTICES);
                }
                return updated;
            });
            const timer = window.setTimeout(() => dismissNotice(id), durationMs);
            timersRef.current.set(id, timer);
        },
        [dismissNotice, getDismissedSet]
    );

    React.useEffect(() => {
        const timers = timersRef.current;
        return () => {
            timers.forEach((timer) => clearTimeout(timer));
        };
    }, []);

    const contextValue = React.useMemo(
        () => ({ notices, addNotice, dismissNotice }),
        [notices, addNotice, dismissNotice]
    );

    return (
        <NoticeContext.Provider value={contextValue}>
            {children}
            {notices.length > 0 && (
                <div
                    className='fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-[10000] flex w-[calc(100vw-2rem)] flex-col items-end gap-2 sm:max-w-sm'
                    role='region'
                    aria-live='polite'
                    aria-label={t('notice.regionAria')}>
                    {notices.map((notice) => {
                        const Icon = toneIcon[notice.tone];
                        return (
                            <div
                                key={notice.id}
                                className={`animate-in fade-in slide-in-from-bottom-2 flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur-sm ${toneClasses[notice.tone]}`}
                                role='alert'>
                                <Icon className='mt-px h-4 w-4 shrink-0' aria-hidden='true' />
                                <span className='flex-1 leading-snug'>{notice.message}</span>
                                {notice.action && (
                                    <button
                                        type='button'
                                        onClick={() => {
                                            notice.action?.onClick();
                                            dismissNotice(notice.id);
                                        }}
                                        className='shrink-0 rounded px-1.5 py-0.5 text-xs font-medium underline-offset-2 hover:underline focus:ring-1 focus:ring-current focus:outline-none'>
                                        {notice.action.label}
                                    </button>
                                )}
                                <button
                                    type='button'
                                    onClick={() => dismissNotice(notice.id)}
                                    className='ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-60 hover:opacity-100 focus:ring-1 focus:ring-current focus:outline-none'
                                    aria-label={t('notice.closeAria')}>
                                    <X className='h-3 w-3' aria-hidden='true' />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </NoticeContext.Provider>
    );
}
