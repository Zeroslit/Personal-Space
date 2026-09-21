import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Button } from './button';
import { cn, shortId } from '@/lib/utils';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ToastOptions {
  message: string;
  description?: string;
  tone?: ToastTone;
  /** 毫秒；0 表示不自动消失 */
  duration?: number;
  action?: ToastAction;
}

interface ToastItem extends ToastOptions {
  id: string;
  duration: number;
  tone: ToastTone;
}

type PushOptions = Omit<ToastOptions, 'message' | 'tone'>;

export interface ToastApi {
  push(options: ToastOptions): string;
  info(message: string, options?: PushOptions): string;
  success(message: string, options?: PushOptions): string;
  error(message: string, options?: PushOptions): string;
  dismiss(id: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast 必须用在 ToastProvider 内部');
  }
  return context;
}

const TONE_ICON: Record<ToastTone, ReactNode> = {
  info: <Info className="h-4 w-4 text-accent" />,
  success: <CheckCircle2 className="h-4 w-4 text-success" />,
  error: <AlertTriangle className="h-4 w-4 text-danger" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (options: ToastOptions) => {
      const id = shortId();
      const duration = options.duration ?? 4000;
      const item: ToastItem = { ...options, id, duration, tone: options.tone ?? 'info' };
      setItems((previous) => [...previous.slice(-3), item]);
      if (duration > 0) {
        timers.current.set(
          id,
          window.setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      info: (message, options) => push({ ...options, message, tone: 'info' }),
      success: (message, options) => push({ ...options, message, tone: 'success' }),
      error: (message, options) => push({ ...options, message, tone: 'error' }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
          role="status"
          aria-live="polite"
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="pointer-events-auto w-full max-w-sm animate-toast-in overflow-hidden rounded-control border border-line ps-surface shadow-pop"
            >
              <div className="flex items-start gap-3 p-3">
                <span className="mt-0.5">{TONE_ICON[item.tone]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{item.message}</p>
                  {item.description ? <p className="mt-0.5 text-xs text-muted">{item.description}</p> : null}
                </div>
                {item.action ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void item.action?.onClick();
                      dismiss(item.id);
                    }}
                  >
                    {item.action.label}
                  </Button>
                ) : null}
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="关闭提示"
                  className={cn(
                    'rounded p-1 text-muted transition hover:bg-line/40 hover:text-fg',
                    item.action ? 'hidden sm:block' : '',
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {item.duration > 0 ? (
                <div
                  className="ps-toast-bar h-0.5 w-full bg-accent/70"
                  style={{ animationDuration: `${item.duration}ms` }}
                />
              ) : null}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
