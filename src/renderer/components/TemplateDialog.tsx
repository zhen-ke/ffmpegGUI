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

  // 重置表单当初始模板改变时
  useEffect(() => {
    setTemplate(
      initialTemplate || {
        name: { en: '', zh: '' },
        command: '',
        description: { en: '', zh: '' },
      },
    );
  }, [initialTemplate, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      template.name?.en &&
      template.name?.zh &&
      template.command &&
      template.description?.en &&
      template.description?.zh
    ) {
      onSave(template as Omit<Template, 'id' | 'isCustom'>);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <h2 className="text-xl font-bold mb-4">
          {initialTemplate ? t('Edit Template') : t('Add New Template')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 resize-none font-mono"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 resize-none"
              rows={2}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 resize-none"
              rows={2}
              required
            />
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {t('Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
