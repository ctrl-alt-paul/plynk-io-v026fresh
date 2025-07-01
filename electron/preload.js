
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

// Dynamically load the native Win32 message listener module
let messageListener = null;
try {
  if (process.platform === 'win32') {
    messageListener = require(path.join(__dirname, 'win32-message-listener', 'build', 'Release', 'message_listener.node'));
  }
} catch (error) {
  console.log('Win32 message listener not available:', error.message);
}

// Win32 message listener function
function startWin32MessageListener() {
  if (!messageListener) {
    ipcRenderer.send('log:event', {
      timestamp: new Date().toISOString(),
      category: 'warning',
      message: 'Win32 message listener not available on this platform or not built'
    });
    return;
  }

  try {
    messageListener.startListener((messageData) => {
      try {
        let parsedMessage;

        // 1) ANY object with a `key` field (value, label or text) is accepted
        if (
          typeof messageData === 'object' &&
          messageData !== null &&
          'key' in messageData
        ) {
          parsedMessage = messageData;
        }
        // 2) String payload: JSON or legacy "key=value"
        else if (typeof messageData === 'string') {
          try {
            parsedMessage = JSON.parse(messageData);
          } catch (jsonError) {
            const parts = messageData.split('=');
            if (parts.length === 2) {
              parsedMessage = {
                key: parts[0].trim(),
                value: isNaN(Number(parts[1])) ? parts[1].trim() : Number(parts[1])
              };
            } else {
              ipcRenderer.send('log:event', {
                timestamp: new Date().toISOString(),
                category: 'warning',
                message: `Received malformed Win32 message: ${messageData}`
              });
              return;
            }
          }
        }
        // 3) Anything else is unsupported
        else {
          ipcRenderer.send('log:event', {
            timestamp: new Date().toISOString(),
            category: 'warning',
            message: `Received unsupported Win32 message type: ${JSON.stringify(messageData)}`
          });
          return;
        }

        // Log what we're about to forward
        ipcRenderer.send('log:event', {
          timestamp: new Date().toISOString(),
          category: 'message-scan',
          message: `Received Win32 message: ${JSON.stringify(parsedMessage)}`
        });

        // Forward to renderer
        ipcRenderer.send('message:outputDetected', parsedMessage);
      }
      catch (err) {
        ipcRenderer.send('log:event', {
          timestamp: new Date().toISOString(),
          category: 'warning',
          message: `Error processing Win32 message: ${err && err.message ? err.message : err}`
        });
      }
    });

    // listener started
    ipcRenderer.send('log:event', {
      timestamp: new Date().toISOString(),
      category: 'message-listen',
      message: 'Win32 message listener started successfully'
    });
  }
  catch (err) {
    ipcRenderer.send('log:event', {
      timestamp: new Date().toISOString(),
      category: 'warning',
      message: `Failed to start Win32 message listener: ${err && err.message ? err.message : err}`
    });
  }
}


contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  // Add new methods to interact with the main process
  test: () => ipcRenderer.invoke('test'),
  
  // External link handling
  openExternal: (url) => ipcRenderer.invoke('openExternal', url),
  
  // Methods to interact with device store
  getDevices: () => ipcRenderer.invoke('device-store:get-devices'),
  addDevice: (device) => ipcRenderer.invoke('device-store:add-device', device),
  updateDevice: (id, device) => ipcRenderer.invoke('device-store:update-device', id, device),
  removeDevice: (id) => ipcRenderer.invoke('device-store:remove-device', id),
  
  // Device store persistence methods
  readDeviceStore: () => ipcRenderer.invoke('readDeviceStore'),
  writeDeviceStore: (devices) => ipcRenderer.invoke('writeDeviceStore', devices),
  
  // Methods to interact with game profiles
  getGameProfiles: () => ipcRenderer.invoke('game-profile-store:get-profiles'),
  addGameProfile: (profile) => ipcRenderer.invoke('game-profile-store:add-profile', profile),
  updateGameProfile: (id, profile) => ipcRenderer.invoke('game-profile-store:update-profile', id, profile),
  removeGameProfile: (id) => ipcRenderer.invoke('game-profile-store:remove-profile', id),
  loadGameProfile: (profile) => ipcRenderer.invoke('game-profile-store:load-profile', profile),
  stopGameProfile: () => ipcRenderer.invoke('game-profile-store:stop-profile'),
  getGameProfile: (profileName) => ipcRenderer.invoke('game-profile:get', profileName),
  
  // Game Profile dispatch status methods
  getDispatchStatus: () => ipcRenderer.invoke('game-profile:get-dispatch-status'),
  getDispatchHistory: () => ipcRenderer.invoke('game-profile:get-dispatch-history'),
  testOutputDispatch: (output) => ipcRenderer.invoke('game-profile:test-output-dispatch', output),
  
  // Updated PacDrive output dispatcher method to return a success/error object
  dispatchPacDriveOutput: (deviceId, channels, value) => {
    return ipcRenderer.invoke('pac-drive:dispatch-output', deviceId, channels, value);
  },
  
  // PacDrive device methods
  scanPacDriveDevices: () => {
    return ipcRenderer.invoke('pac-drive:scan-devices')
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  getPacDriveStatus: () => {
    return ipcRenderer.invoke('pac-drive:get-status')
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  testPacDriveDevice: (deviceId) => ipcRenderer.invoke('pac-drive:test-device', deviceId),
  getPacDriveDiagnostics: () => ipcRenderer.invoke('pac-drive:get-diagnostics'),
  
  // HID device methods - ensuring consistent naming and behavior with enhanced logging
  listHidDevices: () => {
    return ipcRenderer.invoke('hid:list-devices')
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  getHidDeviceInfo: (path) => ipcRenderer.invoke('hid:get-device-info', path),
  testHidDevice: (path) => ipcRenderer.invoke('hid:test-device', path),
  mapHidDeviceToPacDrive: (hidPath, pacDriveIndex) => ipcRenderer.invoke('hid:map-to-pac-drive', hidPath, pacDriveIndex),
  
  // Arduino serial communication methods
  testArduinoConnection: (comPort, baudRate) => {
    return ipcRenderer.invoke('arduino:test-connection', comPort, baudRate)
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  
  sendSerialMessage: (comPort, baudRate, message) => {
    return ipcRenderer.invoke('arduino:send-message', comPort, baudRate, message)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },
  
  // Add Arduino connection status checking method
  getArduinoConnectionStates: (devices) => {
    return ipcRenderer.invoke('arduino:getConnectionStates', devices)
      .then(result => {
        return result;
      })
      .catch(err => {
        return devices.map(d => ({ comPort: d.comPort, connected: false }));
      });
  },
  
  // Arduino port listing method with improved logging
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
  importWLEDProfile: (ipAddress) => {
    return ipcRenderer.invoke('wled:import-profile', ipAddress)
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  
  saveWLEDProfile: (profile) => {
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
  
  loadWLEDProfile: (fileName) => {
    return ipcRenderer.invoke('wled:load-profile', fileName)
      .then(result => {
        return result;
      })
      .catch(err => {
        return null;
      });
  },
  
  // New delete WLED profile function
  deleteWLEDProfile: (fileName) => {
    return ipcRenderer.invoke('wled:delete-profile', fileName)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },
  
  // New WLED device info functions
  getWLEDDeviceInfo: (ipAddress) => {
    return ipcRenderer.invoke('wled:getDeviceInfo', ipAddress)
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  
  getWLEDDeviceState: (ipAddress) => {
    return ipcRenderer.invoke('wled:getDeviceState', ipAddress)
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  
  // New WLED effects function
  getWLEDEffects: (ipAddress) => {
    return ipcRenderer.invoke('wled:getEffects', ipAddress)
      .then(result => {
        return result;
      })
      .catch(err => {
        throw err;
      });
  },
  
  // New WLED profile test function
  sendWLEDProfileToDevice: (profile) => {
    return ipcRenderer.invoke('wled:sendProfileToDevice', profile)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },
  
  // Process monitor control methods
  getProcessMonitorConfig: () => {
    return ipcRenderer.invoke('process-monitor:get-config')
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err), isRunning: false, scanInterval: 3000 };
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
  
  setProcessMonitorInterval: (interval) => {
    return ipcRenderer.invoke('process-monitor:set-interval', interval)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },
  
  // Log page settings methods
  getLogPageConfig: () => {
    return ipcRenderer.invoke('log-page:get-config')
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err), autoScroll: true, categories: {} };
      });
  },

  updateLogPageConfig: (config) => {
    return ipcRenderer.invoke('log-page:update-config', config)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },

  // Master logging settings methods
  getMasterLoggingConfig: () => {
    return ipcRenderer.invoke('master-logging:get-config')
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err), enabled: false };
      });
  },

  updateMasterLoggingConfig: (config) => {
    return ipcRenderer.invoke('master-logging:update-config', config)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  },

  // IPC renderer methods
  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, callback) => ipcRenderer.on(channel, callback),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  },
  onForwardedLog: (callback) => ipcRenderer.on('log', callback),
  log: (level, ...args) => ipcRenderer.send('log', level, ...args),
  logError: (message) => ipcRenderer.send('log', 'error', message),
  getProcesses: () => ipcRenderer.invoke('get-processes'),
  saveMemoryProfile: (filename, profileJson) => ipcRenderer.invoke('memory-profile:save', filename, profileJson),
  saveGameProfile: (filename, profileJson) => ipcRenderer.invoke('game-profile:save', filename, profileJson),
  getMemoryProfile: (filename) => ipcRenderer.invoke('memory-profile:get', filename),
  listMemoryProfiles: () => ipcRenderer.invoke('memory-profile:list'),
  deleteMemoryProfile: (fileName) => ipcRenderer.invoke('memory-profile:delete', fileName),
  
  // Default memory profile functions
  listDefaultMemoryProfiles: () => ipcRenderer.invoke('memory-profile:list-default'),
  getDefaultMemoryProfile: (fileName) => ipcRenderer.invoke('memory-profile:get-default', fileName),
  
  // Message profile functions
  saveMessageProfile: (fileName, profileJson) => ipcRenderer.invoke('message-profile:save', fileName, profileJson),
  getMessageProfile: (fileName) => ipcRenderer.invoke('message-profile:get', fileName),
  listMessageProfiles: () => ipcRenderer.invoke('message-profile:list'),
  deleteMessageProfile: (fileName) => ipcRenderer.invoke('message-profile:delete', fileName),

  // New message output handling methods
  sendMessageOutput: (key, value) => ipcRenderer.send('message:outputDetected', { key, value }),
  onMessageOutputDetected: (callback) => ipcRenderer.on('message:outputDetected', callback),
  removeMessageOutputListener: (callback) => ipcRenderer.removeListener('message:outputDetected', callback),

  // --- DEBUG / TESTING
  onMessageOutputDetected: (callback) => {
    ipcRenderer.on('message:outputDetected', (event, data) => callback(data));
  },
  
  // Add tray icon switching method
  setTrayIcon: (iconPath) => {
    return ipcRenderer.invoke('tray:set-icon', iconPath)
      .then(result => {
        return result;
      })
      .catch(err => {
        return { success: false, error: String(err) };
      });
  }

});

// Expose Win32 message API separately
contextBridge.exposeInMainWorld('messageAPI', {
  startListener: () => startWin32MessageListener(),

  // stops the native pump loop so you can start it again later
  stopListener: () => {
    if (!messageListener || typeof messageListener.stopListener !== 'function') {
      ipcRenderer.send('log:event', {
        timestamp: new Date().toISOString(),
        category: 'warning',
        message: 'Win32 listener stopListener() not available'
      });
      return;
    }
    try {
      messageListener.stopListener();
      ipcRenderer.send('log:event', {
        timestamp: new Date().toISOString(),
        category: 'message-listen',
        message: 'Win32 message listener stopped successfully'
      });
    } catch (err) {
      ipcRenderer.send('log:event', {
        timestamp: new Date().toISOString(),
        category: 'warning',
        message: `Failed to stop Win32 listener: ${err}`
      });
    }
  }
});
