// This file defines the ElectronAPI interface for TypeScript typechecking
export interface ElectronAPI {
  platform: string;
  test: () => Promise<any>;
  
  // External link handling
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  
  // GitHub OAuth methods
  githubStartDeviceFlow: () => Promise<{ success: boolean; data?: any; error?: string }>;
  githubPollForToken: (deviceCode: string) => Promise<{ success: boolean; token?: string; error?: string }>;
  githubValidateToken: (token: string) => Promise<{ success: boolean; user?: any; error?: string }>;
  githubCreateIssue: (owner: string, repo: string, issueData: { title: string; body: string; labels: string[] }, token: string) => Promise<{ success: boolean; issueUrl?: string; issueNumber?: number; error?: string }>;
  
  // PacDrive methods
  testPacDriveDevice: (deviceId: number) => Promise<boolean>;
  getPacDriveStatus: () => Promise<any>;
  scanPacDriveDevices: () => Promise<number[]>;
  dispatchPacDriveOutput: (deviceId: number, channels: number[], value: boolean) => Promise<{success: boolean, error: string | null}>;
  
  // HID device methods
  listHidDevices: () => Promise<any[]>;
  getHidDeviceInfo: (path: string) => Promise<any>;
  testHidDevice: (path: string) => Promise<boolean>;
  mapHidDeviceToPacDrive: (hidPath: string, pacDriveIndex: number) => Promise<boolean>;
  
  // Device store methods
  getDevices: () => Promise<any[]>;
  addDevice: (device: any) => Promise<any>;
  updateDevice: (id: string, device: any) => Promise<any>;
  removeDevice: (id: string) => Promise<any>;
  
  // Device store persistence methods
  readDeviceStore: () => Promise<any[]>;
  writeDeviceStore: (devices: any[]) => Promise<boolean>;
  
  // Methods to interact with game profiles
  getGameProfiles: () => Promise<string[]>;
  getGameProfile: (profileName: string) => Promise<{success: boolean, profile?: any, error?: string}>;
  saveGameProfile: (fileName: string, profileJson: any) => Promise<{success: boolean, error?: string}>;
  addGameProfile: (profile: any) => Promise<any>;
  updateGameProfile: (id: string, profile: any) => Promise<any>;
  removeGameProfile: (id: string) => Promise<{success: boolean, error?: string} | boolean>;
  loadGameProfile: (profile: any) => Promise<any>;
  stopGameProfile: () => Promise<any>;
  
  // Memory profile methods
  listMemoryProfiles: () => Promise<{success: boolean, profiles?: string[], error?: string}>;
  getMemoryProfile: (fileName: string) => Promise<{success: boolean, profile?: any, error?: string}>;
  saveMemoryProfile: (filename: string, profileJson: any) => Promise<{success: boolean, error?: string}>;
  deleteMemoryProfile: (fileName: string) => Promise<{success: boolean, error?: string}>;

  // Default memory profile methods
  listDefaultMemoryProfiles: () => Promise<{success: boolean, profiles?: string[], error?: string}>;
  getDefaultMemoryProfile: (fileName: string) => Promise<{success: boolean, profile?: any, error?: string}>;

  // Message profile methods
  saveMessageProfile: (fileName: string, profileJson: any) => Promise<{success: boolean, error?: string}>;
  getMessageProfile: (fileName: string) => Promise<{success: boolean, profile?: any, error?: string}>;
  listMessageProfiles: () => Promise<{success: boolean, profiles?: string[], error?: string}>;
  deleteMessageProfile: (fileName: string) => Promise<{success: boolean, error?: string}>;

  // Arduino serial communication methods
  testArduinoConnection: (comPort: string, baudRate: number) => Promise<boolean>;
  sendSerialMessage: (comPort: string, baudRate: number, message: string) => Promise<{success: boolean, error?: string}>;
  listSerialPorts: () => Promise<Array<{
    path: string;
    manufacturer?: string;
    vendorId?: string;
    productId?: string;
    serialNumber?: string;
  }>>;
  getArduinoConnectionStates: (devices: { comPort: string; baudRate: number }[]) => Promise<{ comPort: string; connected: boolean }[]>;
  
  // Add Arduino namespace with methods
  arduino: {
    sendMessage: (comPort: string, baudRate: number, message: string) => Promise<{success: boolean, error?: string}>;
    testConnection?: (comPort: string, baudRate: number) => Promise<boolean>;
    listPorts?: () => Promise<any[]>;
    getConnectionStates?: (devices: { comPort: string; baudRate: number }[]) => Promise<{ comPort: string; connected: boolean }[]>;
  };
  
  // WLED profile functions
  importWLEDProfile: (ipAddress: string) => Promise<any>;
  saveWLEDProfile: (profile: any) => Promise<string>;
  listWLEDProfiles: () => Promise<string[]>;
  loadWLEDProfile: (fileName: string) => Promise<any>;
  deleteWLEDProfile: (fileName: string) => Promise<{success: boolean, error?: string}>;
  getWLEDDeviceInfo: (ipAddress: string) => Promise<any>;
  getWLEDDeviceState: (ipAddress: string) => Promise<any>;
  getWLEDEffects: (ipAddress: string) => Promise<string[]>;
  sendWLEDProfileToDevice: (profile: any) => Promise<{success: boolean, error?: string}>;
  
  // Process functions
  getProcesses: () => Promise<any[]>;

  // Test dispatch function for Game Profile outputs
  testOutputDispatch: (output: any) => Promise<{success: boolean, error?: string}>;

  // Process Monitor control methods
  getProcessMonitorConfig: () => Promise<{success: boolean, isRunning: boolean, scanInterval: number, error?: string}>;
  startProcessMonitor: () => Promise<{success: boolean, error?: string}>;
  stopProcessMonitor: () => Promise<{success: boolean, error?: string}>;
  setProcessMonitorInterval: (interval: number) => Promise<{success: boolean, error?: string}>;

  // Log page settings methods
  getLogPageConfig: () => Promise<{success: boolean, autoScroll: boolean, categories: Record<string, boolean>, error?: string}>;
  updateLogPageConfig: (config: {autoScroll?: boolean, categories?: Record<string, boolean>}) => Promise<{success: boolean, error?: string}>;

  // Master logging settings methods
  getMasterLoggingConfig: () => Promise<{success: boolean, enabled: boolean, error?: string}>;
  updateMasterLoggingConfig: (config: {enabled: boolean}) => Promise<{success: boolean, error?: string}>;

  // IPC methods
  ipcRenderer: {
    send: (channel: string, data?: any) => void;
    on: (channel: string, callback: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
    removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
  };
  
  // Logging methods
  onForwardedLog: (callback: (...args: any[]) => void) => void;
  log: (level: string, ...args: any[]) => void;
  logError: (message: string) => void;

  // Device status and logging methods
  logDeviceConfiguration?: (action: string, device: any) => Promise<void>;
  logDeviceTest?: (device: any, success: boolean, details?: string) => Promise<void>;
  logDeviceDiscovery?: (deviceType: string, foundDevices: any[]) => Promise<void>;

  // Message output handling methods
  sendMessageOutput: (key: string, value: any) => void;
  onMessageOutputDetected: (callback: (...args: any[]) => void) => void;
  removeMessageOutputListener: (callback: (...args: any[]) => void) => void;
}

// Win32 Message API interface
export interface MessageAPI {
  startListener: () => void;
}

// Extend global Window interface
declare global {
  interface Window {
    electron?: ElectronAPI;
    messageAPI?: MessageAPI;
  }
}
