import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../LanguageContext';
import type { ToastItem, ToastType } from '../hooks/useToast';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const TYPE_STYLES: Record<
  ToastType,
  { container: string; icon: typeof AlertCircle }
> = {
  error: {
    container:
      'border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/90 text-red-900 dark:text-red-100',
    icon: AlertCircle,
  },
  success: {
    container:
      'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-100',
    icon: CheckCircle2,
  },
  info: {
    container:
      'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100',
    icon: Info,
  },
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const { t } = useLanguage();

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed top-[calc(var(--titlebar-height)+12px)] right-4 z-[10000] flex flex-col gap-2 w-full max-w-sm pointer-events-none"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => {
        const style = TYPE_STYLES[toast.type];
        const Icon = style.icon;

        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg animate-slide-up ${style.container}`}
          >
            <Icon
              size={18}
              className="flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p className="flex-1 min-w-0 text-sm leading-snug">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label={t('Dismiss')}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md opacity-70 hover:opacity-100 transition-opacity"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
