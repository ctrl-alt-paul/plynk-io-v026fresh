
export interface Process {
  name: string;
  pid: number;
  cmd: string;
}

declare global {
  interface Window {
    electron?: {
      // Window management
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
      
      // Memory operations
      readMemory?: (processName: string, address: string, type: string, useModuleOffset: boolean, moduleName: string, offset: string, customSize?: number) => Promise<number | null>;
      
      // Profile operations
      openProfileFile?: () => Promise<any>;
      saveProfileFile?: (profileData: any) => Promise<void>;
      openMessageProfileFile?: () => Promise<any>;
      saveMessageProfileFile?: (profileData: any) => Promise<void>;
      getGameProfile?: (profileName: string) => Promise<any>;
      getMemoryProfile?: (profileName: string) => Promise<any>;
      
      // Device operations
      startDeviceListener?: (profileName: string) => Promise<any>;
      stopDeviceListener?: () => Promise<any>;
      listSerialPorts?: () => Promise<any>;
      sendMessageToPort?: (portName: string, message: string) => Promise<any>;
      listHidDevices?: () => Promise<any>;
      getPacDriveStatus?: () => Promise<any>;
      testOutputDispatch?: (data: any) => Promise<any>;
      
      // WLED operations
      getWLEDDeviceInfo?: (ip: string) => Promise<any>;
      getWLEDDeviceState?: (ip: string) => Promise<any>;
      
      // Process operations
      getProcesses?: () => Promise<Process[]>;
      
      // System info
      platform?: string;
      
      // IPC Renderer
      ipcRenderer?: {
        on: (channel: string, listener: (...args: any[]) => void) => void;
        off: (channel: string, listener: (...args: any[]) => void) => void;
        send: (channel: string, ...args: any[]) => void;
        invoke: (channel: string, ...args: any[]) => Promise<any>;
      };
      
      // Logging
      getMasterLoggingConfig?: () => Promise<any>;
      
      // GitHub operations
      githubStartDeviceFlow?: () => Promise<{ success: boolean; data?: any; error?: string }>;
      githubPollForToken?: (deviceCode: string) => Promise<{ success: boolean; token?: string; error?: string; pending?: boolean }>;
      githubValidateToken?: (token: string) => Promise<{ success: boolean; user?: any; error?: string }>;
      githubCreateIssue?: (owner: string, repo: string, issueData: any, token: string) => Promise<{ success: boolean; issueUrl?: string; issueNumber?: number; error?: string }>;
      githubValidateLabels?: (owner: string, repo: string, labels: string[], token: string) => Promise<{ success: boolean; error?: string; missingLabels?: string[] }>;
    };
  }
}

export {};
