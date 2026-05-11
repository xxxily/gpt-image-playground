'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

export type NoticeItem = {
  id: string;
  message: string;
  tone: NoticeTone;
  createdAt: number;
};

type NoticeContextValue = {
  notices: NoticeItem[];
  addNotice: (message: string, tone: NoticeTone) => void;
  dismissNotice: (id: string) => void;
};

const NoticeContext = React.createContext<NoticeContextValue>({
  notices: [],
  addNotice: () => {},
  dismissNotice: () => {},
});

export function useNotice() {
  return React.useContext(NoticeContext);
}

const AUTO_DISMISS_DURATION_MS = 5000;
const MAX_VISIBLE_NOTICES = 4;
let noticeIdCounter = 0;

function nextNoticeId(): string {
  noticeIdCounter += 1;
  return `notice-${Date.now()}-${noticeIdCounter}`;
}

const toneIcon = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const toneClasses: Record<NoticeTone, string> = {
  info: 'border-sky-400/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  error: 'border-red-400/30 bg-red-500/10 text-red-700 dark:text-red-300',
};

export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = React.useState<NoticeItem[]>([]);
  const timersRef = React.useRef<Map<string, number>>(new Map());

  const dismissNotice = React.useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotice = React.useCallback(
    (message: string, tone: NoticeTone) => {
      const id = nextNoticeId();
      setNotices((prev) => {
        const updated = [...prev, { id, message, tone, createdAt: Date.now() }];
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
      const timer = window.setTimeout(() => dismissNotice(id), AUTO_DISMISS_DURATION_MS);
      timersRef.current.set(id, timer);
    },
    [dismissNotice]
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
          className="fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-[10000] flex flex-col gap-2 sm:max-w-sm"
          role="region"
          aria-live="polite"
          aria-label="操作通知"
        >
          {notices.map((notice) => {
            const Icon = toneIcon[notice.tone];
            return (
              <div
                key={notice.id}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 ${toneClasses[notice.tone]}`}
                role="alert"
              >
                <Icon className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 leading-snug">{notice.message}</span>
                <button
                  type="button"
                  onClick={() => dismissNotice(notice.id)}
                  className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-60 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-current"
                  aria-label="关闭通知"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </NoticeContext.Provider>
  );
}
