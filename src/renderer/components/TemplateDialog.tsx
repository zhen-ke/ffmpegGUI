import { X, FileCode, Sparkles } from 'lucide-react';
import React, { useState, useEffect, useId, useRef } from 'react';
import { useLanguage } from '../LanguageContext';
import { Template } from '../types/template';

interface TemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: Omit<Template, 'id' | 'isCustom'>) => void;
  initialTemplate?: Template;
}

const EMPTY_TEMPLATE: Partial<Template> = {
  name: { en: '', zh: '' },
  command: '',
  description: { en: '', zh: '' },
};

export function TemplateDialog({
  isOpen,
  onClose,
  onSave,
  initialTemplate,
}: TemplateDialogProps) {
  const { t } = useLanguage();
  const [template, setTemplate] = useState<Partial<Template>>(
    initialTemplate || EMPTY_TEMPLATE,
  );
  const [validationError, setValidationError] = useState('');
  const titleId = useId();
  const errorId = useId();
  const nameEnId = useId();
  const nameZhId = useId();
  const commandId = useId();
  const descEnId = useId();
  const descZhId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTemplate(initialTemplate || EMPTY_TEMPLATE);
    setValidationError('');
  }, [initialTemplate, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    firstFieldRef.current?.focus();
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nameEn = template.name?.en?.trim() ?? '';
    const nameZh = template.name?.zh?.trim() ?? '';
    const descEn = template.description?.en?.trim() ?? '';
    const descZh = template.description?.zh?.trim() ?? '';
    const command = template.command?.trim() ?? '';

    const normalizedName = {
      en: nameEn || nameZh,
      zh: nameZh || nameEn,
    };
    const normalizedDescription = {
      en: descEn || descZh,
      zh: descZh || descEn,
    };

    if (
      !normalizedName.en ||
      !normalizedName.zh ||
      !normalizedDescription.en ||
      !normalizedDescription.zh ||
      !command
    ) {
      setValidationError(
        t('Please provide at least one name and description, and a command.'),
      );
      return;
    }

    onSave({
      name: normalizedName,
      command,
      description: normalizedDescription,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t('Cancel')}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={validationError ? errorId : undefined}
        className="relative w-full max-w-2xl mx-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl dark:shadow-slate-900/50 border border-slate-200 dark:border-slate-700 animate-scale-in overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg shadow-primary-500/25">
              {initialTemplate ? (
                <FileCode size={20} className="text-white" />
              ) : (
                <Sparkles size={20} className="text-white" />
              )}
            </div>
            <div>
              <h2
                id={titleId}
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                {initialTemplate ? t('Edit Template') : t('Add New Template')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {initialTemplate
                  ? t('Modify existing template')
                  : t('Create a new custom template')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Cancel')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition-colors duration-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor={nameEnId}
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {t('Name (English)')}
              </label>
              <input
                ref={firstFieldRef}
                id={nameEnId}
                type="text"
                value={template.name?.en || ''}
                onChange={(e) =>
                  setTemplate((prev) => ({
                    ...prev,
                    name: { ...prev.name!, en: e.target.value },
                  }))
                }
                onInput={() => setValidationError('')}
                placeholder="e.g., Convert to MP4…"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-[border-color,box-shadow,background-color] duration-200"
              />
            </div>

            <div>
              <label
                htmlFor={nameZhId}
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {t('Name (Chinese)')}
              </label>
              <input
                id={nameZhId}
                type="text"
                value={template.name?.zh || ''}
                onChange={(e) =>
                  setTemplate((prev) => ({
                    ...prev,
                    name: { ...prev.name!, zh: e.target.value },
                  }))
                }
                onInput={() => setValidationError('')}
                placeholder="例如：转换为 MP4…"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-[border-color,box-shadow,background-color] duration-200"
              />
            </div>
          </div>

          {/* Command Field */}
          <div>
            <label
              htmlFor={commandId}
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              {t('Command')}
            </label>
            <textarea
              id={commandId}
              value={template.command || ''}
              onChange={(e) =>
                setTemplate((prev) => ({
                  ...prev,
                  command: e.target.value,
                }))
              }
              onInput={() => setValidationError('')}
              spellCheck="false"
              placeholder="ffmpeg -i input.mp4 -c:v libx264 -c:a aac output.mp4…"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-[border-color,box-shadow,background-color] duration-200 resize-none"
              rows={3}
            />
          </div>

          {/* Description Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor={descEnId}
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {t('Description (English)')}
              </label>
              <textarea
                id={descEnId}
                value={template.description?.en || ''}
                onChange={(e) =>
                  setTemplate((prev) => ({
                    ...prev,
                    description: { ...prev.description!, en: e.target.value },
                  }))
                }
                onInput={() => setValidationError('')}
                spellCheck="false"
                placeholder="Convert video to MP4 format using H.264…"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-[border-color,box-shadow,background-color] duration-200 resize-none"
                rows={3}
              />
            </div>
            <div>
              <label
                htmlFor={descZhId}
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {t('Description (Chinese)')}
              </label>
              <textarea
                id={descZhId}
                value={template.description?.zh || ''}
                onChange={(e) =>
                  setTemplate((prev) => ({
                    ...prev,
                    description: { ...prev.description!, zh: e.target.value },
                  }))
                }
                onInput={() => setValidationError('')}
                spellCheck="false"
                placeholder="使用 H.264 将视频转换为 MP4 格式…"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-[border-color,box-shadow,background-color] duration-200 resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* Validation Error */}
          {validationError && (
            <div
              id={errorId}
              aria-live="polite"
              className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl"
            >
              <span className="text-sm text-red-600 dark:text-red-400">
                {validationError}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-[background-color,border-color,box-shadow,color] duration-200"
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl shadow-lg shadow-primary-500/25 hover:from-primary-600 hover:to-primary-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-[transform,box-shadow,background-image] duration-200"
            >
              {t('Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TemplateDialog;
