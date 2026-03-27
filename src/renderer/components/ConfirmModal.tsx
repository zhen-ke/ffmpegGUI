/**
 * ConfirmModal — 轻量内联确认弹窗
 *
 * 替代 window.confirm，在 Electron 中保持一致的视觉风格。
 * 使用 React Portal 渲染到 document.body，避免层叠上下文问题。
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../LanguageContext';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useLanguage();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Escape 键取消
  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  useEffect(() => {
    if (!isOpen) return;
    confirmButtonRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* 遮罩 */}
      <button
        type="button"
        aria-label={t('Cancel')}
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px]"
        onClick={onCancel}
      />

      {/* 弹窗主体 */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/60 w-full max-w-sm p-6 flex flex-col gap-4">
        {/* 标题 */}
        <h2 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
          {title}
        </h2>

        {/* 描述 */}
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed -mt-1">
            {description}
          </p>
        )}

        {/* 按钮组 */}
        <div className="flex items-center justify-end gap-2 mt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
          >
            {cancelLabel ?? t('Cancel')}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-[background-color,box-shadow,color] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
              danger
                ? 'bg-red-500 hover:bg-red-600 text-white focus-visible:ring-red-500'
                : 'bg-primary-500 hover:bg-primary-600 text-white focus-visible:ring-primary-500'
            }`}
          >
            {confirmLabel ?? t('Confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

ConfirmModal.defaultProps = {
  description: undefined,
  confirmLabel: undefined,
  cancelLabel: undefined,
  danger: false,
};
