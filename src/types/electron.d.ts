export interface Process {
  name: string;
  pid: number;
  cmd: string;
}

declare global {
  interface Window {
    electron?: {
      openExternal?: (url: string) => void;
      closeAllWindows?: () => void;
      minimizeAllWindows?: () => void;
      unmaximizeAllWindows?: () => void;
      maximizeAllWindows?: () => void;
      restoreAllWindows?: () => void;
      isAnyWindowMaximized?: () => boolean;
      getAppVersion?: () => string;
      selectFolder?: () => Promise<string | undefined>;
      showContextMenu?: (menuItems: any[]) => void;
      getScreenDimensions?: () => { width: number; height: number };
      readMemory?: (processName: string, address: string, type: string, useModuleOffset: boolean, moduleName: string, offset: string, customSize?: number) => Promise<number | null>;
      openProfileFile?: () => Promise<any>;
      saveProfileFile?: (profileData: any) => Promise<void>;
      openMessageProfileFile?: () => Promise<any>;
      saveMessageProfileFile?: (profileData: any) => Promise<void>;
      startDeviceListener?: (profileName: string) => Promise<any>;
      stopDeviceListener?: () => Promise<any>;
      listSerialPorts?: () => Promise<any>;
      sendMessageToPort?: (portName: string, message: string) => Promise<any>;
      getProcesses?: () => Promise<Process[]>;
      githubStartDeviceFlow?: () => Promise<{ success: boolean; data?: any; error?: string }>;
      githubPollForToken?: (deviceCode: string) => Promise<{ success: boolean; token?: string; error?: string; pending?: boolean }>;
      githubValidateToken?: (token: string) => Promise<{ success: boolean; user?: any; error?: string }>;
      githubCreateIssue?: (owner: string, repo: string, issueData: any, token: string) => Promise<{ success: boolean; issueUrl?: string; issueNumber?: number; error?: string }>;
      githubValidateLabels?: (owner: string, repo: string, labels: string[], token: string) => Promise<{ success: boolean; error?: string; missingLabels?: string[] }>;
    };
  }
}

export {};
