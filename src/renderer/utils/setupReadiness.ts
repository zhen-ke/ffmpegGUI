/**
 * Setup readiness — validates whether the user can safely start FFmpeg.
 */

export type SetupBlocker =
  | 'command'
  | 'input'
  | 'outputFolder'
  | 'outputName'
  | null;

export interface SetupReadinessInput {
  command: string;
  inputFiles: string[];
  outputFolder: string;
  outputFileName: string;
}

export interface SetupReadiness {
  hasCommand: boolean;
  hasInput: boolean;
  hasOutputFolder: boolean;
  hasOutputName: boolean;
  isSetupComplete: boolean;
  blocker: SetupBlocker;
}

export function deriveSetupReadiness({
  command,
  inputFiles,
  outputFolder,
  outputFileName,
}: SetupReadinessInput): SetupReadiness {
  const hasCommand = command.trim().length > 0;
  const hasInput = inputFiles.some((file) => file.trim().length > 0);
  const hasOutputFolder = outputFolder.trim().length > 0;
  const hasOutputName = outputFileName.trim().length > 0;

  let blocker: SetupBlocker = null;
  if (!hasCommand) blocker = 'command';
  else if (!hasInput) blocker = 'input';
  else if (!hasOutputFolder) blocker = 'outputFolder';
  else if (!hasOutputName) blocker = 'outputName';

  return {
    hasCommand,
    hasInput,
    hasOutputFolder,
    hasOutputName,
    isSetupComplete: blocker === null,
    blocker,
  };
}

const BLOCKER_MESSAGE_KEYS: Record<Exclude<SetupBlocker, null>, string> = {
  command: 'Enter a command or select a template.',
  input: 'Select an input file to continue.',
  outputFolder: 'Select an output folder to continue.',
  outputName: 'Enter an output file name to continue.',
};

export function getSetupBlockerMessageKey(
  blocker: SetupBlocker,
): string | null {
  if (!blocker) return null;
  return BLOCKER_MESSAGE_KEYS[blocker];
}
