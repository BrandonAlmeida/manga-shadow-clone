import type { ElectronBridge } from "./types/electron";

declare global {
  interface Window {
    electronAPI?: ElectronBridge;
  }
}

export {};
