import { ElectronHandler } from '../main/preload';

interface TerminalAPI {
  start(cols: number, rows: number): Promise<{ success: boolean }>;
  sendInput(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): Promise<{ success: boolean }>;
  onOutput(cb: (data: string) => void): () => void;
  onExit(cb: (code: number) => void): () => void;
}

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    electron: ElectronHandler;
    terminalAPI: TerminalAPI;
  }
}

export {};
