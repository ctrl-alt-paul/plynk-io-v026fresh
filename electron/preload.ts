import { contextBridge, ipcRenderer } from 'electron';
const path = require('path');

// Dynamically load the native Win32 message listener module
let messageListener: any = null;
try {
  if (process.platform === 'win32') {
    messageListener = require(path.join(__dirname, 'win32-message-listener', 'build', 'Release', 'message_listener.node'));
  }
} catch (error: any) {
  console.log('Win32 message listener not available:', error.message);
}

// Win32 message listener function
function startWin32MessageListener(): void {
  if (!messageListener) {
    console.log('Win32 message listener not available on this platform or not built');
    return;
  }

  try {
    messageListener.startListener((messageData: string) => {
      try {
        let parsedMessage: any;
        
        // Try to parse as JSON first
        try {
          parsedMessage = JSON.parse(messageData);
        } catch (jsonError) {
          // If JSON parsing fails, try to parse as key=value format
          const parts = messageData.split('=');
          if (parts.length === 2) {
            parsedMessage = {
              key: parts[0].trim(),
              value: isNaN(Number(parts[1])) ? parts[1].trim() : Number(parts[1])
            };
          } else {
            // Log raw string if parsing fails
            ipcRenderer.send('log', 'message', `Received malformed message: ${messageData}`);
            return;
          }
        }

        // Log the received message
        ipcRenderer.send('log', 'message', `Received Win32 message: ${JSON.stringify(parsedMessage)}`);
        
        // Forward to renderer
        ipcRenderer.send('message:outputDetected', parsedMessage);
        
      } catch (error: any) {
        ipcRenderer.send('log', 'message', `Error processing Win32 message: ${error.message}`);
      }
    });
    
    ipcRenderer.send('log', 'message', 'Win32 message listener started successfully');
  } catch (error: any) {
    ipcRenderer.send('log', 'message', `Failed to start Win32 message listener: ${error.message}`);
  }
}

interface ElectronAPI {
  getPacDriveStatus: () => Promise<{
    initialized: boolean;
    dllLoaded?: boolean;
    dllLoadError?: string | null;
    deviceCount: number;
    connectedDevices: number[];
    deviceDetails: Array<{ deviceId: number; vendorId?: string; productId?: string; responsive: boolean }>;
  }>;
  scanPacDriveDevices: () => Promise<number[]>;
  testPacDriveDevice: (deviceId: number) => Promise<boolean>;
  dispatchPacDriveOutput: (deviceId: number, channels: number[], value: number) => Promise<{ success: boolean; error?: string }>;
  listHidDevices: () => Promise<any[]>;
  getHidDeviceInfo: (path: string) => Promise<any>;
  testHidDevice: (path: string) => Promise<boolean>;
  mapHidDeviceToPacDrive: (hidPath: string, pacDriveIndex: number) => Promise<boolean>;
  platform: NodeJS.Platform;
  getSystemInfo: () => Promise<{
    platform: string;
    arch: string;
    nodeVersion: string;
    osRelease: string;
    osType: string;
    totalMemory: number;
    freeMemory: number;
    cpus: string[];
    userInfo: string;
    hostname: string;
  }>;
  
  // GitHub OAuth methods
  githubStartDeviceFlow: () => Promise<{ success: boolean; data?: any; error?: string }>;
  githubPollForToken: (deviceCode: string) => Promise<{ success: boolean; token?: string; error?: string }>;
  githubCheckAuthStatus: (deviceCode: string) => Promise<{ success: boolean; token?: string; error?: string; pending?: boolean }>;
  githubValidateToken: (token: string) => Promise<{ success: boolean; user?: any; error?: string }>;
  githubCreateIssue: (owner: string, repo: string, issueData: { title: string; body: string; labels: string[] }, token: string) => Promise<{ success: boolean; issueUrl?: string; issueNumber?: number; error?: string }>;
  
  // External link handling
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  
  // Device store persistence methods
  readDeviceStore: () => Promise<any[]>;
  writeDeviceStore: (devices: any[]) => Promise<void>;
  // Arduino serial communication methods
  testArduinoConnection: (comPort: string, baudRate: number) => Promise<boolean>;
  sendSerialMessage: (comPort: string, baudRate: number, message: string) => Promise<{ success: boolean; error?: string }>;
  // Arduino port listing method
  listSerialPorts: () => Promise<Array<{
    path: string;
    manufacturer?: string;
    vendorId?: string;
    productId?: string;
    serialNumber?: string;
  }>>;
  // Arduino connection status checking method
  getArduinoConnectionStates: (devices: { comPort: string; baudRate: number }[]) => Promise<{ comPort: string; connected: boolean }[]>;
  // WLED profile functions
  importWLEDProfile: (ipAddress: string) => Promise<any>;
  saveWLEDProfile: (profile: any) => Promise<string>;
  listWLEDProfiles: () => Promise<string[]>;
  loadWLEDProfile: (fileName: string) => Promise<any>;
  // WLED device info functions
  getWLEDDeviceInfo: (ipAddress: string) => Promise<any>;
  getWLEDDeviceState: (ipAddress: string) => Promise<any>;
  // New WLED effects function
  getWLEDEffects: (ipAddress: string) => Promise<string[]>;
  // New WLED profile test function
  sendWLEDProfileToDevice: (profile: any) => Promise<{ success: boolean; error?: string }>;
  // Memory profile functions
  saveMemoryProfile: (fileName: string, profileJson: any) => Promise<{success: boolean; error?: string}>;
  getMemoryProfile: (fileName: string) => Promise<{success: boolean; profile?: any; error?: string}>;
  listMemoryProfiles: () => Promise<{success: boolean; profiles?: string[]; error?: string}>;
  deleteMemoryProfile: (fileName: string) => Promise<{success: boolean; error?: string}>;
  // Default memory profile functions
  listDefaultMemoryProfiles: () => Promise<{success: boolean; profiles?: string[]; error?: string}>;
  getDefaultMemoryProfile: (fileName: string) => Promise<{success: boolean; profile?: any; error?: string}>;
  // Game profile functions
  saveGameProfile: (fileName: string, profileJson: any) => Promise<{success: boolean; error?: string}>;
  getGameProfile: (profileName: string) => Promise<{success: boolean; profile?: any; error?: string}>;
  getProcesses: () => Promise<any[]>;
  // Message profile functions
  saveMessageProfile: (fileName: string, profileJson: any) => Promise<{success: boolean; error?: string}>;
  getMessageProfile: (fileName: string) => Promise<{success: boolean; profile?: any; error?: string}>;
  listMessageProfiles: () => Promise<{success: boolean; profiles?: string[]; error?: string}>;
  deleteMessageProfile: (fileName: string) => Promise<{success: boolean; error?: string}>;
  // Message output handling methods
  sendMessageOutput: (key: string, value: any) => void;
  setActiveMessageProfiles: (gameProfile: any, messageProfile: any) => Promise<{ success: boolean; error?: string }>;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

interface MessageAPI {
  startListener: () => void;
}

contextBridge.exposeInMainWorld('electron', {
  getPacDriveStatus: () => ipcRenderer.invoke('getPacDriveStatus'),
  scanPacDriveDevices: () => ipcRenderer.invoke('scanPacDriveDevices'),
  testPacDriveDevice: (deviceId: number) => ipcRenderer.invoke('testPacDriveDevice', deviceId),
  dispatchPacDriveOutput: (deviceId: number, channels: number[], value: number) => ipcRenderer.invoke('dispatchPacDriveOutput', deviceId, channels, value),
  listHidDevices: () => ipcRenderer.invoke('listHidDevices'),
  getHidDeviceInfo: (path: string) => ipcRenderer.invoke('getHidDeviceInfo', path),
  testHidDevice: (path: string) => ipcRenderer.invoke('testHidDevice', path),
  mapHidDeviceToPacDrive: (hidPath: string, pacDriveIndex: number) => ipcRenderer.invoke('mapHidDeviceToPacDrive', hidPath, pacDriveIndex),
  platform: process.platform,
  getSystemInfo: () => ipcRenderer.invoke('getSystemInfo'),
  
  // GitHub OAuth methods
  githubStartDeviceFlow: () => ipcRenderer.invoke('github:start-device-flow'),
  githubPollForToken: (deviceCode: string) => ipcRenderer.invoke('github:poll-for-token', deviceCode),
  githubCheckAuthStatus: (deviceCode: string) => ipcRenderer.invoke('github:check-auth-status', deviceCode),
  githubValidateToken: (token: string) => ipcRenderer.invoke('github:validate-token', token),
  githubCreateIssue: (owner: string, repo: string, issueData: { title: string; body: string; labels: string[] }, token: string) => 
    ipcRenderer.invoke('github:create-issue', owner, repo, issueData, token),
  
  // External link handling
  openExternal: (url: string) => ipcRenderer.invoke('openExternal', url),
  
  // Device store persistence methods
  readDeviceStore: () => ipcRenderer.invoke('readDeviceStore'),
  writeDeviceStore: (devices: any[]) => ipcRenderer.invoke('writeDeviceStore', devices),
  // Arduino serial communication methods
  testArduinoConnection: (comPort: string, baudRate: number) => ipcRenderer.invoke('arduino:test-connection', comPort, baudRate),
  sendSerialMessage: (comPort: string, baudRate: number, message: string) => ipcRenderer.invoke('arduino:send-message', comPort, baudRate, message),
  // Arduino connection status checking
  getArduinoConnectionStates: (devices) => {
    return ipcRenderer.invoke('arduino:getConnectionStates', devices)
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  // Arduino port listing method
  listSerialPorts: () => {
    return ipcRenderer.invoke('arduino:list-ports')
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  // WLED profile functions
  importWLEDProfile: (ipAddress: string) => {
    return ipcRenderer.invoke('wled:import-profile', ipAddress)
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  saveWLEDProfile: (profile: any) => {
    return ipcRenderer.invoke('wled:save-profile', profile)
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  listWLEDProfiles: () => {
    return ipcRenderer.invoke('wled:list-profiles')
      .then(result => {
        return result;
      })
      .catch(err => {
        return [];
      });
  },
  loadWLEDProfile: (fileName: string) => {
    return ipcRenderer.invoke('wled:load-profile', fileName)
      .then(result => {
        return result;
      })
      .catch(err => {
        return null;
      });
  },
  
  // WLED device info functions
  getWLEDDeviceInfo: (ipAddress: string) => {
    return ipcRenderer.invoke('wled:getDeviceInfo', ipAddress)
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  getWLEDDeviceState: (ipAddress: string) => {
    return ipcRenderer.invoke('wled:getDeviceState', ipAddress)
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  
  // New WLED effects function
  getWLEDEffects: (ipAddress: string) => {
    return ipcRenderer.invoke('wled:getEffects', ipAddress)
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  
  // New WLED profile test function
  sendWLEDProfileToDevice: (profile: any) => {
    return ipcRenderer.invoke('wled:sendProfileToDevice', profile)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },
  
  // Memory profile functions
  saveMemoryProfile: (fileName: string, profileJson: any) => {
    return ipcRenderer.invoke('memory-profile:save', fileName, profileJson)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },
  getMemoryProfile: (fileName: string) => {
    return ipcRenderer.invoke('memory-profile:get', fileName)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err), profile: null };
      });
  },
  listMemoryProfiles: () => {
    return ipcRenderer.invoke('memory-profile:list')
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err), profiles: [] };
      });
  },
  deleteMemoryProfile: (fileName: string) => {
    return ipcRenderer.invoke('memory-profile:delete', fileName)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },

  // Default memory profile functions
  listDefaultMemoryProfiles: () => {
    return ipcRenderer.invoke('memory-profile:list-default')
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err), profiles: [] };
      });
  },
  getDefaultMemoryProfile: (fileName: string) => {
    return ipcRenderer.invoke('memory-profile:get-default', fileName)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err), profile: null };
      });
  },
  
  // Game profile functions
  saveGameProfile: (fileName: string, profileJson: any) => {
    return ipcRenderer.invoke('game-profile:save', fileName, profileJson)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },
  
  // Game profile functions
  getGameProfile: (profileName: string) => {
    return ipcRenderer.invoke('game-profile:get', profileName)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err), profile: null };
      });
  },
  
  // Process functions
  getProcesses: () => {
    return ipcRenderer.invoke('get-processes')
      .then(result => {
        return result;
      })
      .catch(err => {
        return [];
      });
  },
  
  // Process monitor control methods
  getProcessMonitorStatus: () => {
    return ipcRenderer.invoke('process-monitor:get-status')
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err), isRunning: false };
      });
  },
  
  startProcessMonitor: () => {
    return ipcRenderer.invoke('process-monitor:start')
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },
  
  stopProcessMonitor: () => {
    return ipcRenderer.invoke('process-monitor:stop')
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },
  
  setProcessMonitorInterval: (interval: number) => {
    return ipcRenderer.invoke('process-monitor:set-interval', interval)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },
  
  getProcessMonitorConfig: () => {
    return ipcRenderer.invoke('process-monitor:get-config')
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err), isRunning: false, scanInterval: 3000 };
      });
  },
  
  // Message profile functions
  saveMessageProfile: (fileName: string, profileJson: any) => {
    return ipcRenderer.invoke('message-profile:save', fileName, profileJson)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },
  
  getMessageProfile: (fileName: string) => {
    return ipcRenderer.invoke('message-profile:get', fileName)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err), profile: null };
      });
  },
  
  listMessageProfiles: () => {
    return ipcRenderer.invoke('message-profile:list')
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err), profiles: [] };
      });
  },
  
  deleteMessageProfile: (fileName: string) => {
    return ipcRenderer.invoke('message-profile:delete', fileName)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },

  // Message output handling methods
  sendMessageOutput: (key: string, value: any) => {
    ipcRenderer.send('message:outputDetected', { key, value });
  },

  setActiveMessageProfiles: (gameProfile: any, messageProfile: any) => {
    return ipcRenderer.invoke('message:setActiveProfiles', { gameProfile, messageProfile })
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },

  // Generic invoke method for compatibility
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
});

// Expose Win32 message API separately
contextBridge.exposeInMainWorld('messageAPI', {
  startListener: () => startWin32MessageListener()
});
