import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { type DropdownOption } from '../components/Dropdown';
import { commandTemplates, type CommandTemplate } from '../constants/commandTemplates';
import { updateCommandPaths } from '../utils/commandUtils';
import { type Template } from '../types/template';

/**
 * useTemplateSync bridges the template manager and command manager, syncing the selected template to the command state.
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
  updateCommand: (cmd: string) => void;
  updateCommandWithPaths: (cmd?: string, inputs?: string[], output?: string) => void;
  setCommand: Dispatch<SetStateAction<string>>;
  clearCommand: () => void;
  inputFiles: string[];
  outputFolder: string;
  openConfirm: (title: string, onConfirm: () => void, opts?: { description?: string; danger?: boolean }) => void;
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
    updateCommand,
    updateCommandWithPaths,
    clearCommand,
    inputFiles,
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

  const inputFilesRef = useRef(inputFiles);
  const outputFolderRef = useRef(outputFolder);
  const commandRef = useRef(command);
  const selectedTemplateIdRef = useRef<string | null>(selectedTemplateId);

  const [lastAppliedCommand, setLastAppliedCommand] = useState<string | null>(
    null,
  );
  
  inputFilesRef.current = inputFiles;
  outputFolderRef.current = outputFolder;
  commandRef.current = command;
  selectedTemplateIdRef.current = selectedTemplateId;

  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (outputFolder) updateCommandWithPaths();
  }, [outputFolder, updateCommandWithPaths]);

  const selectedTemplateCommand = selectedTemplate?.command;
  
  const applyTemplateCommand = useCallback(
    (tplCmd: string) => {
      const currentInputs = inputFilesRef.current;
      const o = outputFolderRef.current;
      if (currentInputs.length > 0 || o) {
        const expected = updateCommandPaths(tplCmd, currentInputs, o);
        setLastAppliedCommand(expected);
        updateCommandWithPaths(tplCmd, currentInputs, o);
      } else {
        setLastAppliedCommand(tplCmd);
        updateCommand(tplCmd);
      }
    },
    [updateCommand, updateCommandWithPaths, setLastAppliedCommand],
  );

  useEffect(() => {
    if (!selectedTemplateId || !selectedTemplateCommand) return;
    applyTemplateCommand(selectedTemplateCommand);
  }, [applyTemplateCommand, selectedTemplateCommand, selectedTemplateId]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setLastAppliedCommand(null);
    }
  }, [selectedTemplateId]);

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
