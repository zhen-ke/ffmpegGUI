import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { Template } from '../types/template';

interface TemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: Omit<Template, 'id' | 'isCustom'>) => void;
  initialTemplate?: Template;
}

export const TemplateDialog: React.FC<TemplateDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTemplate,
}) => {
  const { t } = useLanguage();
  const [template, setTemplate] = useState<Partial<Template>>(
    initialTemplate || {
      name: { en: '', zh: '' },
      command: '',
      description: { en: '', zh: '' },
    },
  );
  const [validationError, setValidationError] = useState('');

  // 重置表单当初始模板改变时
  useEffect(() => {
    setTemplate(
      initialTemplate || {
        name: { en: '', zh: '' },
        command: '',
        description: { en: '', zh: '' },
      },
    );
    setValidationError('');
  }, [initialTemplate, isOpen]);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 dark:bg-background-dialog backdrop-blur-sm">
      <div className="bg-white rounded-lg p-5 w-full max-w-2xl dark:bg-background-textarea">
        <h2 className="text-lg font-bold mb-3 dark:text-text-dark">
          {initialTemplate ? t('Edit Template') : t('Add New Template')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-text-dark">
                {t('Name (English)')}
              </label>
              <input
                type="text"
                value={template.name?.en || ''}
                onChange={(e) =>
                  setTemplate((prev) => ({
                    ...prev,
                    name: { ...prev.name!, en: e.target.value },
                  }))
                }
                onInput={() => setValidationError('')}
                className="dark:bg-background-textarea dark:border-border-dark mt-1 block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-text-lightDark"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-text-dark">
                {t('Name (Chinese)')}
              </label>
              <input
                type="text"
                value={template.name?.zh || ''}
                onChange={(e) =>
                  setTemplate((prev) => ({
                    ...prev,
                    name: { ...prev.name!, zh: e.target.value },
                  }))
                }
                onInput={() => setValidationError('')}
                className="dark:bg-background-textarea dark:border-border-dark mt-1 block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-text-lightDark"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-text-dark">
              {t('Command')}
            </label>
            <textarea
              value={template.command || ''}
              onChange={(e) =>
                setTemplate((prev) => ({
                  ...prev,
                  command: e.target.value,
                }))
              }
              onInput={() => setValidationError('')}
              spellCheck="false"
              className="dark:bg-background-textarea dark:border-border-dark mt-1 block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono resize-none text-sm dark:text-text-lightDark"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-text-dark">
                {t('Description (English)')}
              </label>
              <textarea
                value={template.description?.en || ''}
                onChange={(e) =>
                  setTemplate((prev) => ({
                    ...prev,
                    description: { ...prev.description!, en: e.target.value },
                  }))
                }
                onInput={() => setValidationError('')}
                spellCheck="false"
                className="dark:bg-background-textarea dark:border-border-dark mt-1 block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm dark:text-text-lightDark"
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-text-dark">
                {t('Description (Chinese)')}
              </label>
              <textarea
                value={template.description?.zh || ''}
                onChange={(e) =>
                  setTemplate((prev) => ({
                    ...prev,
                    description: { ...prev.description!, zh: e.target.value },
                  }))
                }
                onInput={() => setValidationError('')}
                spellCheck="false"
                className="dark:bg-background-textarea dark:border-border-dark mt-1 block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm dark:text-text-lightDark"
                rows={4}
              />
            </div>
          </div>

          {validationError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {validationError}
            </p>
          )}

          <div className="mt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {t('Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
