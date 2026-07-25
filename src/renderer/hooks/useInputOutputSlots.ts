import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { type ToastType } from './useToast';
import {
  buildOutputPreview,
  countInputArguments,
  parseInputArguments,
  parseOutputFileName,
  updateInputArgument,
  updateOutputFileName,
} from '../utils/commandUtils';
import {
  deriveSetupReadiness,
  getSetupBlockerMessageKey,
} from '../utils/setupReadiness';

export interface InputSlot {
  id: string;
  index: number;
  label: string;
  fieldLabel: string;
  selectedValue: string;
}

function getIndexedInputLabel(language: string, index: number): string {
  return language === 'zh' ? `输入 ${index + 1}` : `Input ${index + 1}`;
}

function getIndexedSelectLabel(language: string, index: number): string {
  return language === 'zh'
    ? `选择输入 ${index + 1}`
    : `Select Input ${index + 1}`;
}

/**
 * useInputOutputSlots manages input and output states for the ffmpeg command.
 */
export function useInputOutputSlots(options: {
  command: string;
  setCommand: Dispatch<SetStateAction<string>>;
  inputFiles: string[];
  outputFolder: string;
  handleSelectInputFile: (index: number) => Promise<string | undefined>;
  clearInputFile: (index: number) => void;
  handleInputFileDrop: (filePath: string, index: number) => void;
  canStart: boolean;
  language: string;
  t: (key: string) => string;
  pushToast: (type: ToastType, msg: string) => void;
  inputControlBaseId: string;
  outputControlId: string;
  commandControlId: string;
}): {
  inputSlots: InputSlot[];
  primaryInputPath: string;
  outputFileName: string;
  finalOutputPath: string;
  setupReadiness: any;
  isReadyToRun: boolean;
  setupBlockerMessage: string | null;
  hasMultipleInputs: boolean;
  handleSelectInputAtIndex: (index: number) => Promise<void>;
  handleClearInputAtIndex: (index: number) => void;
  handleDropInputAtIndex: (filePath: string, index: number) => void;
  handleOutputFileNameChange: (value: string) => void;
  handleCopyOutputPath: () => void;
  handleSelectPipelineStep: (step: 'input' | 'command' | 'output') => void;
} {
  const {
    command,
    setCommand,
    inputFiles,
    outputFolder,
    handleSelectInputFile,
    clearInputFile,
    handleInputFileDrop,
    canStart,
    language,
    t,
    pushToast,
    inputControlBaseId,
    outputControlId,
    commandControlId,
  } = options;

  const inputSlotCount = useMemo(
    () => Math.max(1, countInputArguments(command), inputFiles.length),
    [command, inputFiles.length],
  );

  const inputArguments = useMemo(() => parseInputArguments(command), [command]);
  const outputFileName = useMemo(() => parseOutputFileName(command), [command]);
  const finalOutputPath = useMemo(
    () => buildOutputPreview(outputFolder, outputFileName),
    [outputFolder, outputFileName],
  );

  const setupReadiness = useMemo(
    () =>
      deriveSetupReadiness({
        command,
        inputFiles,
        outputFolder,
        outputFileName,
      }),
    [command, inputFiles, outputFolder, outputFileName],
  );

  const isReadyToRun = setupReadiness.isSetupComplete && canStart;
  
  const setupBlockerMessage = useMemo(() => {
    const key = getSetupBlockerMessageKey(setupReadiness.blocker);
    return key ? t(key) : null;
  }, [setupReadiness.blocker, t]);

  const inputSlots = useMemo(
    () =>
      Array.from({ length: inputSlotCount }, (_, index) => {
        const token = inputArguments[index] ?? '';
        const selectedValue =
          inputFiles[index] ||
          (/^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(token) ? token : '');
        const actionLabel =
          inputSlotCount === 1
            ? t('Select Input File')
            : getIndexedSelectLabel(language, index);
        const fieldLabel =
          inputSlotCount === 1
            ? t('Input File')
            : getIndexedInputLabel(language, index);
        const label =
          token && !selectedValue ? `${actionLabel} (${token})` : actionLabel;

        return {
          id: `${inputControlBaseId}-${index}`,
          index,
          label,
          fieldLabel,
          selectedValue,
        };
      }),
    [
      inputArguments,
      inputFiles,
      inputSlotCount,
      inputControlBaseId,
      language,
      t,
    ],
  );
  
  const primaryInputPath = inputSlots[0]?.selectedValue ?? '';

  const handleSelectInputAtIndex = useCallback(
    async (index: number) => {
      const filePath = await handleSelectInputFile(index);
      if (!filePath) return;

      setCommand((prev) => updateInputArgument(prev, index, filePath));
    },
    [handleSelectInputFile, setCommand],
  );

  const handleClearInputAtIndex = useCallback(
    (index: number) => {
      clearInputFile(index);
      setCommand((prev) => updateInputArgument(prev, index));
    },
    [clearInputFile, setCommand],
  );

  const handleDropInputAtIndex = useCallback(
    (filePath: string, index: number) => {
      handleInputFileDrop(filePath, index);
      setCommand((prev) => updateInputArgument(prev, index, filePath));
    },
    [handleInputFileDrop, setCommand],
  );

  const handleOutputFileNameChange = useCallback(
    (value: string) => {
      setCommand((prev) =>
        updateOutputFileName(prev, value, outputFolder),
      );
    },
    [setCommand, outputFolder],
  );

  const handleSelectPipelineStep = useCallback(
    (step: 'input' | 'command' | 'output') => {
      if (step === 'input') {
        const el =
          document.getElementById(inputControlBaseId) ||
          document.getElementById(`${inputControlBaseId}-0`);
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (step === 'command') {
        const el = document.getElementById(commandControlId);
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (step === 'output') {
        const el = document.getElementById(`${outputControlId}-name`);
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    [inputControlBaseId, commandControlId, outputControlId],
  );

  const handleCopyOutputPath = useCallback(() => {
    if (!finalOutputPath) return;
    navigator.clipboard.writeText(finalOutputPath);
    pushToast('info', t('Output path copied to clipboard'));
  }, [finalOutputPath, pushToast, t]);

  const hasMultipleInputs = useMemo(
    () => countInputArguments(command) > 1,
    [command],
  );

  return {
    inputSlots,
    primaryInputPath,
    outputFileName,
    finalOutputPath,
    setupReadiness,
    isReadyToRun,
    setupBlockerMessage,
    hasMultipleInputs,
    handleSelectInputAtIndex,
    handleClearInputAtIndex,
    handleDropInputAtIndex,
    handleOutputFileNameChange,
    handleCopyOutputPath,
    handleSelectPipelineStep,
  };
}
