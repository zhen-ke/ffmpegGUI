interface IElectronAPI {
  // ... existing types ...
  platform: string;
  arch: string;
  fetchOsxExpertsHtml: () => Promise<string>;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}

export {};
