/**
 * 模板管理 Hook
 * 管理命令模板的选择、创建、编辑和删除
 */

import { useCallback, useState } from 'react';
import { CommandTemplate } from '../constants/commandTemplates';
import { useLanguage } from '../LanguageContext';
import { templateService } from '../services/templateService';
import { Template } from '../types/template';
import { useLatest } from './useLatest';

// ========== 类型 ==========

/** 对话框状态：关闭或打开（可含编辑模板） */
type DialogState =
  | { isOpen: false }
  | { isOpen: true; editingTemplate?: Template };

/** 已转换的模板（name / description 已本地化为 string） */
export interface TransformedTemplate
  extends Omit<Template, 'name' | 'description'> {
  name: string;
  description: string;
}

interface UseTemplateManagerProps {
  onError?: (message: string) => void;
}

// ========== 模块级工具函数 ==========

function getInitialCustomTemplates(): Template[] {
  try {
    return templateService.getCustomTemplates();
  } catch (error) {
    console.error('Failed to load custom templates:', error);
    return [];
  }
}

/** `isCustom` 字段存在且为真即视为自定义模板 */
function isCustomTemplate(template: Template | CommandTemplate): boolean {
  return !!('isCustom' in template && template.isCustom);
}

// ========== Hook ==========

export function useTemplateManager({
  onError,
}: UseTemplateManagerProps = {}) {
  const { language } = useLanguage();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [customTemplates, setCustomTemplates] = useState<Template[]>(
    getInitialCustomTemplates,
  );
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
  });

  // useLatest 消除各 handler 对 state / prop 的依赖，避免不必要的函数重建
  const onErrorRef        = useLatest(onError);
  const languageRef       = useLatest(language);
  const dialogStateRef    = useLatest(dialogState);
  const customTemplatesRef = useLatest(customTemplates);

  // ── 内部工具 ──────────────────────────────────────────

  const refreshTemplates = useCallback(() => {
    try {
      setCustomTemplates(templateService.getCustomTemplates());
    } catch (error) {
      console.error('Failed to load custom templates:', error);
      onErrorRef.current?.('Failed to load templates.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 공개 API ──────────────────────────────────────────

  /**
   * 将模板的多语言 name / description 转换为当前语言的字符串。
   */
  const transformTemplate = useCallback(
    (template: Template | CommandTemplate): TransformedTemplate => ({
      id:          template.id,
      command:     template.command,
      name:        template.name[languageRef.current],
      description: template.description[languageRef.current],
      isCustom:    isCustomTemplate(template),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** 选中模板（调用方通过 selectedTemplateId 派生当前模板） */
  const handleTemplateSelect = useCallback((template: { id: string }) => {
    setSelectedTemplateId(template.id);
  }, []);

  /** 保存模板（新建或更新） */
  const handleSaveTemplate = useCallback(
    (template: Omit<Template, 'id' | 'isCustom'>) => {
      try {
        const { editingTemplate } = dialogStateRef.current.isOpen
          ? dialogStateRef.current
          : { editingTemplate: undefined };

        if (editingTemplate) {
          templateService.updateCustomTemplate({
            ...template,
            id: editingTemplate.id,
            isCustom: true,
          });
        } else {
          templateService.saveCustomTemplate(template);
        }

        refreshTemplates();
        setDialogState({ isOpen: false });
      } catch (error) {
        console.error('Failed to save template:', error);
        onErrorRef.current?.('Failed to save template. Please check your data.');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshTemplates],
  );

  /** 删除模板，若删除的是当前选中项则清除选中状态 */
  const handleDeleteTemplate = useCallback(
    (templateId: string) => {
      try {
        templateService.deleteCustomTemplate(templateId);
        refreshTemplates();
        setSelectedTemplateId((prev) => (prev === templateId ? null : prev));
      } catch (error) {
        console.error('Failed to delete template:', error);
        onErrorRef.current?.('Failed to delete template.');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshTemplates],
  );

  /**
   * 打开编辑对话框。
   * 通过 ref 查找原始模板，不依赖 customTemplates state。
   */
  const handleEditTemplate = useCallback((template: { id: string }) => {
    const original = customTemplatesRef.current.find(
      (t) => t.id === template.id,
    );
    if (original) {
      setDialogState({ isOpen: true, editingTemplate: original });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    selectedTemplateId,
    customTemplates,
    // 对话框相关属性（从合并状态派生）
    isTemplateDialogOpen: dialogState.isOpen,
    editingTemplate: dialogState.isOpen
      ? dialogState.editingTemplate
      : undefined,
    // 方法
    transformTemplate,
    handleTemplateSelect,
    handleSaveTemplate,
    handleDeleteTemplate,
    handleEditTemplate,
    // setState 引用稳定，直接内联无需 useCallback
    openNewTemplateDialog: () => setDialogState({ isOpen: true }),
    closeTemplateDialog:   () => setDialogState({ isOpen: false }),
    refreshTemplates,
  };
}
