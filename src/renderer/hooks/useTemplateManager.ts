/**
 * 模板管理 Hook
 * 管理命令模板的选择、创建、编辑和删除
 */

import { useCallback, useEffect, useState } from 'react';
import { CommandTemplate } from '../constants/commandTemplates';
import { useLanguage } from '../LanguageContext';
import { templateService } from '../services/templateService';
import { Template } from '../types/template';

interface TransformedTemplate extends Template {
  name: string;
  description: string;
}

export function useTemplateManager() {
  const { language } = useLanguage();
  const [selectedTemplate, setSelectedTemplate] =
    useState<TransformedTemplate | null>(null);
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<
    Template | undefined
  >();

  /**
   * 加载自定义模板
   */
  useEffect(() => {
    setCustomTemplates(templateService.getCustomTemplates());
  }, []);

  /**
   * 转换模板以支持多语言
   */
  const transformTemplate = useCallback(
    (template: Template | CommandTemplate): TransformedTemplate => {
      const isCommandTemplate =
        'name' in template &&
        typeof template.name === 'object' &&
        'en' in template.name;

      return {
        ...template,
        id: (template as Template).id || '',
        name: isCommandTemplate
          ? template.name[language]
          : (template as TransformedTemplate).name,
        description: isCommandTemplate
          ? template.description[language]
          : (template as TransformedTemplate).description,
        isCustom: !!(template as Template).isCustom,
      };
    },
    [language],
  );

  /**
   * 选择模板
   * @param template 选中的模板
   * @param onCommandUpdate 命令更新回调
   */
  const handleTemplateSelect = useCallback(
    (
      template: TransformedTemplate,
      onCommandUpdate: (command: string) => void,
    ) => {
      setSelectedTemplate(template);
      onCommandUpdate(template.command);
    },
    [],
  );

  /**
   * 保存模板（新建或更新）
   */
  const handleSaveTemplate = useCallback(
    (template: Omit<Template, 'id' | 'isCustom'>) => {
      if (editingTemplate) {
        // 更新现有模板
        templateService.updateCustomTemplate({
          ...template,
          id: editingTemplate.id,
          isCustom: true,
        });

        // 更新选中的模板（如果正在编辑当前选中的模板）
        if (selectedTemplate && selectedTemplate.id === editingTemplate.id) {
          const updatedTemplate = {
            ...template,
            id: editingTemplate.id,
            isCustom: true,
            name: template.name[language],
            description: template.description[language],
          };
          setSelectedTemplate(updatedTemplate);
        }
      } else {
        // 添加新模板
        templateService.saveCustomTemplate(template);
      }

      // 刷新模板列表
      setCustomTemplates(templateService.getCustomTemplates());
      setIsTemplateDialogOpen(false);
      setEditingTemplate(undefined);
    },
    [editingTemplate, selectedTemplate, language],
  );

  /**
   * 删除模板
   */
  const handleDeleteTemplate = useCallback(
    (templateId: string) => {
      templateService.deleteCustomTemplate(templateId);
      setCustomTemplates(templateService.getCustomTemplates());

      // 如果删除的是当前选中的模板，清除选中状态
      if (selectedTemplate && selectedTemplate.id === templateId) {
        setSelectedTemplate(null);
      }
    },
    [selectedTemplate],
  );

  /**
   * 编辑模板
   */
  const handleEditTemplate = useCallback(
    (template: Template) => {
      const originalTemplate = customTemplates.find(
        (t) => t.id === template.id,
      );
      if (originalTemplate) {
        setEditingTemplate(originalTemplate);
        setIsTemplateDialogOpen(true);
      }
    },
    [customTemplates],
  );

  /**
   * 打开新建模板对话框
   */
  const openNewTemplateDialog = useCallback(() => {
    setEditingTemplate(undefined);
    setIsTemplateDialogOpen(true);
  }, []);

  /**
   * 关闭模板对话框
   */
  const closeTemplateDialog = useCallback(() => {
    setIsTemplateDialogOpen(false);
    setEditingTemplate(undefined);
  }, []);

  return {
    selectedTemplate,
    customTemplates,
    isTemplateDialogOpen,
    editingTemplate,
    transformTemplate,
    handleTemplateSelect,
    handleSaveTemplate,
    handleDeleteTemplate,
    handleEditTemplate,
    openNewTemplateDialog,
    closeTemplateDialog,
  };
}
