import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLatest } from './useLatest';
import { type DropdownOption } from '../components/Dropdown';
import {
  commandTemplates,
  type CommandTemplate,
} from '../constants/commandTemplates';
import { type Template } from '../types/template';

/**
 * useTemplateSync bridges the template manager and command manager, syncing the
 * selected template to the command state.
 *
 * 命令与基线（lastAppliedCommand）由 useCommandManager 的 reducer 原子持有，
 * 本 hook 只负责：选模板时调用 applyTemplateCommand、计算 dirty、联动路径替换。
 * 不再各自持有 lastAppliedCommand state，避免两条路径写同一 state 造成 isCommandDirty 闪烁。
 */
export function useTemplateSync(options: {
  templateManager: {
    selectedTemplateId: string | null;
    customTemplates: Template[];
    transformTemplate: (template: Template | CommandTemplate) => DropdownOption;
    handleTemplateSelect: (template: { id: string }) => void;
    handleDeleteTemplate: (templateId: string) => void;
    clearTemplateSelection: () => void;
  };
  command: string;
  /** 最近一次应用模板 / 路径替换得到的基线命令（由 useCommandManager 的 reducer 原子持有） */
  lastAppliedCommand: string | null;
  /** 应用模板命令（command + 基线原子写入，由 useCommandManager 提供） */
  applyTemplateCommand: (tplCmd: string) => void;
  updateCommandWithPaths: (
    cmd?: string,
    inputs?: string[],
    output?: string,
  ) => void;
  clearCommand: () => void;
  outputFolder: string;
  openConfirm: (
    title: string,
    onConfirm: () => void,
    opts?: { description?: string; danger?: boolean },
  ) => void;
  closeConfirm: () => void;
  t: (key: string) => string;
}): {
  templateOptions: DropdownOption[];
  selectedTemplate: DropdownOption | null;
  isCommandDirty: boolean;
  commandSource: { label: string; isDirty: boolean } | null;
  commandSourceLabel: string;
  handleTemplateSelectWithConfirm: (template: DropdownOption) => void;
  handleDeleteTemplateWithConfirm: (templateId: string) => void;
  handleTemplateClear: () => void;
  handleResetToTemplate: () => void;
} {
  const {
    templateManager,
    command,
    lastAppliedCommand,
    applyTemplateCommand,
    updateCommandWithPaths,
    clearCommand,
    outputFolder,
    openConfirm,
    closeConfirm,
    t,
  } = options;

  const {
    selectedTemplateId,
    customTemplates,
    transformTemplate,
    handleTemplateSelect,
    handleDeleteTemplate,
    clearTemplateSelection,
  } = templateManager;

  const templateOptions = useMemo(
    () => [
      ...customTemplates.map(transformTemplate),
      ...commandTemplates.map(transformTemplate),
    ],
    [customTemplates, transformTemplate],
  );

  const selectedTemplate = useMemo(
    () => templateOptions.find((tpl) => tpl.id === selectedTemplateId) ?? null,
    [templateOptions, selectedTemplateId],
  );

  // selectedTemplateId 在 handleTemplateSelectWithConfirm 中需读取最新值，
  // 用 useLatest 统一管理，避免手写渲染期 ref 同步。
  const selectedTemplateIdRef = useLatest(selectedTemplateId);

  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (outputFolder) updateCommandWithPaths();
  }, [outputFolder, updateCommandWithPaths]);

  const selectedTemplateCommand = selectedTemplate?.command;

  // 选模板时原子应用：command + 基线同时写入，该帧即干净，不会先脏后净地闪烁
  useEffect(() => {
    if (!selectedTemplateId || !selectedTemplateCommand) return;
    applyTemplateCommand(selectedTemplateCommand);
  }, [applyTemplateCommand, selectedTemplateCommand, selectedTemplateId]);

  const isCommandDirty = useMemo(() => {
    if (!selectedTemplateId) return false;
    if (lastAppliedCommand === null) return false;
    return command.trim() !== lastAppliedCommand.trim();
  }, [command, selectedTemplateId, lastAppliedCommand]);

  const handleResetToTemplate = useCallback(() => {
    if (!selectedTemplateCommand) return;
    applyTemplateCommand(selectedTemplateCommand);
  }, [applyTemplateCommand, selectedTemplateCommand]);

  const handleTemplateClear = useCallback(() => {
    clearTemplateSelection();
    clearCommand();
  }, [clearTemplateSelection, clearCommand]);

  const handleTemplateSelectWithConfirm = useCallback(
    (template: DropdownOption) => {
      if (template.id === selectedTemplateIdRef.current) return;
      handleTemplateSelect(template);
    },
    // selectedTemplateIdRef 由 useLatest 提供，稳定，无需列入 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleTemplateSelect],
  );

  const handleDeleteTemplateWithConfirm = useCallback(
    (templateId: string) => {
      openConfirm(
        t('Delete this custom template?'),
        () => {
          handleDeleteTemplate(templateId);
          closeConfirm();
        },
        { danger: true },
      );
    },
    [handleDeleteTemplate, openConfirm, closeConfirm, t],
  );

  const commandSource = useMemo(() => {
    if (!selectedTemplate) return null;
    return {
      label: selectedTemplate.name,
      isDirty: isCommandDirty,
    };
  }, [selectedTemplate, isCommandDirty]);

  let commandSourceLabel = t('No template selected');
  if (selectedTemplate) {
    commandSourceLabel = isCommandDirty
      ? t('Modified (from template)')
      : t('Working from template');
  } else if (command.trim().length > 0) {
    commandSourceLabel = t('Custom command');
  }

  return {
    templateOptions,
    selectedTemplate,
    isCommandDirty,
    commandSource,
    commandSourceLabel,
    handleTemplateSelectWithConfirm,
    handleDeleteTemplateWithConfirm,
    handleTemplateClear,
    handleResetToTemplate,
  };
}
