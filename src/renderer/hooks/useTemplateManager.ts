/**
 * 模板管理 Hook
 * 管理命令模板的选择、创建、编辑和删除
 */

import { useCallback, useState } from 'react';
import { CommandTemplate } from '../constants/commandTemplates';
import { useLanguage } from '../LanguageContext';
import { templateService } from '../services/templateService';
import { Template } from '../types/template';

// ========== 类型定义 ==========

/** 对话框状态：关闭或打开（可含编辑模板） */
type DialogState =
  | { isOpen: false }
  | { isOpen: true; editingTemplate?: Template };

/** 已转换的模板（name/description 已本地化为 string） */
export interface TransformedTemplate extends Omit<Template, 'name' | 'description'> {
  name: string;
  description: string;
}

interface UseTemplateManagerProps {
  onError?: (message: string) => void;
}

/** 初始化自定义模板（懒加载） */
function getInitialCustomTemplates(): Template[] {
  try {
    return templateService.getCustomTemplates();
  } catch (error) {
    console.error('Failed to load custom templates:', error);
    return [];
  }
}

/** 提取是否为自定义模板 */
function isCustomTemplate(template: Template | CommandTemplate): boolean {
  return 'isCustom' in template && !!template.isCustom;
}

export function useTemplateManager({ onError }: UseTemplateManagerProps = {}) {
  const { language } = useLanguage();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<Template[]>(
    getInitialCustomTemplates,
  );
  const [dialogState, setDialogState] = useState<DialogState>({ isOpen: false });

  /**
   * 刷新自定义模板列表
   */
  const refreshTemplates = useCallback(() => {
    try {
      setCustomTemplates(templateService.getCustomTemplates());
    } catch (error) {
      console.error('Failed to load custom templates:', error);
      onError?.('Failed to load templates.');
    }
  }, [onError]);

  /**
   * 转换模板以支持多语言
   */
  const transformTemplate = useCallback(
    (template: Template | CommandTemplate): TransformedTemplate => {
      return {
        id: template.id,
        command: template.command,
        name: template.name[language],
        description: template.description[language],
        isCustom: isCustomTemplate(template),
      };
    },
    [language],
  );

  /**
   * 选择模板（调用方通过 selectedTemplateId 派生当前模板）
   */
  const handleTemplateSelect = useCallback(
    (template: { id: string }) => {
      setSelectedTemplateId(template.id);
    },
    [],
  );

  /**
   * 保存模板（新建或更新）
   */
  const handleSaveTemplate = useCallback(
    (template: Omit<Template, 'id' | 'isCustom'>) => {
      try {
        const editingTemplate = dialogState.isOpen
          ? dialogState.editingTemplate
          : undefined;

        if (editingTemplate) {
          // 更新现有模板
          templateService.updateCustomTemplate({
            ...template,
            id: editingTemplate.id,
            isCustom: true,
          });
        } else {
          // 添加新模板
          templateService.saveCustomTemplate(template);
        }

        refreshTemplates();
        setDialogState({ isOpen: false });
      } catch (error) {
        console.error('Failed to save template:', error);
        onError?.('Failed to save template. Please check your data.');
      }
    },
    [dialogState, onError, refreshTemplates],
  );

  /**
   * 删除模板
   */
  const handleDeleteTemplate = useCallback(
    (templateId: string) => {
      try {
        templateService.deleteCustomTemplate(templateId);
        refreshTemplates();

        // 如果删除的是当前选中的模板，清除选中状态
        setSelectedTemplateId((prevSelectedTemplateId) =>
          prevSelectedTemplateId === templateId ? null : prevSelectedTemplateId,
        );
      } catch (error) {
        console.error('Failed to delete template:', error);
        onError?.('Failed to delete template.');
      }
    },
    [onError, refreshTemplates],
  );

  /**
   * 编辑模板
   * @param template 只需要 id 属性来查找原始模板
   */
  const handleEditTemplate = useCallback(
    (template: { id: string }) => {
      const originalTemplate = customTemplates.find(
        (t) => t.id === template.id,
      );
      if (originalTemplate) {
        setDialogState({ isOpen: true, editingTemplate: originalTemplate });
      }
    },
    [customTemplates],
  );

  /**
   * 打开新建模板对话框
   */
  const openNewTemplateDialog = useCallback(() => {
    setDialogState({ isOpen: true });
  }, []);

  /**
   * 关闭模板对话框
   */
  const closeTemplateDialog = useCallback(() => {
    setDialogState({ isOpen: false });
  }, []);

  return {
    selectedTemplateId,
    customTemplates,
    // 对话框相关属性（从合并后的状态派生）
    isTemplateDialogOpen: dialogState.isOpen,
    editingTemplate: dialogState.isOpen ? dialogState.editingTemplate : undefined,
    // 方法
    transformTemplate,
    handleTemplateSelect,
    handleSaveTemplate,
    handleDeleteTemplate,
    handleEditTemplate,
    openNewTemplateDialog,
    closeTemplateDialog,
  };
}
