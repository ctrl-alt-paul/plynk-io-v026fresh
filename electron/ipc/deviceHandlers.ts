
import { ipcMain } from 'electron';
import { pacDriveController } from '../devices/pacDriveController';
import { logger } from '../logger';
import os from 'os';
import { readDeviceStore, writeDeviceStore } from '../devices/deviceStoreController';
import { arduinoController } from '../devices/arduinoController';
const { logDeviceDiscovery, logDeviceConfiguration, logDeviceTest } = require('../services/deviceStatusService');

export const registerDeviceHandlers = () => {
  // Get PacDrive status
  ipcMain.handle('getPacDriveStatus', async (event) => {
    try {
      const status = pacDriveController.getStatus();
      return {
        ...status,
        dllPath: status.dllPath || undefined  // Add DLL path info for diagnostics
      };
    } catch (error) {
      throw new Error(`Failed to get PacDrive status: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Scan for PacDrive devices
  ipcMain.handle('scanPacDriveDevices', async (event) => {
    try {
      // Initialize if not already done
      if (!pacDriveController.isDllLoaded()) {
        throw new Error(`Cannot scan for devices: ${pacDriveController.getDllError()}`);
      }
      
      // If not initialized, try to initialize
      if (!pacDriveController.getStatus().initialized) {
        pacDriveController.initialize();
      }
      
      // Return found devices regardless of initialization success
      const devices = pacDriveController.scanForDevices();
      
      // Log the discovery event
      logDeviceDiscovery('PacDrive', devices);
      
      return devices;
    } catch (error) {
      throw new Error(`Failed to scan for devices: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  
  // Test PacDrive device connection with timeout
  ipcMain.handle('testPacDriveDevice', async (event, deviceId) => {
    try {
      // Add a promise with timeout to prevent hanging
      const testWithTimeout = () => {
        return new Promise<boolean>((resolve) => {
          // Set a timeout to resolve after 3 seconds if no response
          const timeoutId = setTimeout(() => {
            resolve(false);
          }, 3000);
          
          try {
            // Try to test the connection
            const result = pacDriveController.testDeviceConnection(deviceId);
            
            // Clear the timeout if we got a result
            clearTimeout(timeoutId);
            resolve(result);
          } catch (error) {
            // Clear the timeout and resolve with false if there was an error
            clearTimeout(timeoutId);
            resolve(false);
          }
        });
      };
      
      // Execute the test with timeout
      const result = await testWithTimeout();
      
      // Log the test result
      logDeviceTest(
        { name: `PacDrive ${deviceId}`, type: 'PacDrive', id: deviceId },
        result,
        result ? 'Connection successful' : 'Connection failed or timeout'
      );
      
      return result;
    } catch (error) {
      logDeviceTest(
        { name: `PacDrive ${deviceId}`, type: 'PacDrive', id: deviceId },
        false,
        `Test error: ${error instanceof Error ? error.message : String(error)}`
      );
      return false; // Return false instead of throwing to prevent UI issues
    }
  });
  
  // Dispatch output to PacDrive device
  ipcMain.handle('dispatchPacDriveOutput', async (event, deviceId, channels, value) => {
    try {
      // If no channels provided or empty array, return error
      if (!channels || channels.length === 0) {
        return { success: false, error: "No channels specified" };
      }
      
      // Try to initialize if not already
      if (!pacDriveController.getStatus().initialized) {
        const initSuccess = pacDriveController.initialize();
        if (!initSuccess) {
          return { 
            success: false, 
            error: `PacDrive not initialized: ${pacDriveController.getStatus().initializationError || 'Unknown error'}` 
          };
        }
      }
      
      // Set output state for each specified channel
      let allSuccess = true;
      for (const channel of channels) {
        const success = pacDriveController.setOutput(deviceId, channel, value);
        if (!success) {
          allSuccess = false;
        }
      }
      
      return { 
        success: allSuccess,
        error: allSuccess ? null : "Failed to set output state for one or more channels"
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to dispatch output: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  });

  // Get system info for diagnostics
  ipcMain.handle('getSystemInfo', async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      osRelease: os.release(),
      osType: os.type(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().map(cpu => cpu.model),
      userInfo: os.userInfo().username,
      hostname: os.hostname()
    };
  });
  
  // Device store persistence handlers
  ipcMain.handle('readDeviceStore', async () => {
    try {
      const devices = await readDeviceStore();
      return devices;
    } catch (error) {
      return [];
    }
  });
  
  ipcMain.handle('writeDeviceStore', async (event, devices) => {
    try {
      await writeDeviceStore(devices);
      return true;
    } catch (error) {
      throw new Error(`Failed to write device store: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  
  // Arduino serial port handlers with improved logging and timeouts
  ipcMain.handle('arduino:list-ports', async () => {
    try {
      const startTime = Date.now();
      
      const ports = await arduinoController.listSerialPorts();
      
      const endTime = Date.now();
      
      // Log port discovery
      logDeviceDiscovery('Arduino Serial Port', ports.map(port => port.path || port.comName));
      
      return ports;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logDeviceDiscovery('Arduino Serial Port', []);
      return [];
    }
  });
  
  // Arduino connection status handler with timeout
  ipcMain.handle('arduino:getConnectionStates', async (event, knownDevices) => {
    try {
      const startTime = Date.now();
      
      // Add a Promise.race with a timeout to prevent long-running checks
      const connectionCheckWithTimeout = async () => {
        const timeoutPromise = new Promise<any[]>((resolve) => {
          setTimeout(() => {
            // Return a safe fallback where all devices are marked as disconnected
            resolve(knownDevices.map(d => ({ comPort: d.comPort, connected: false })));
          }, 5000);
        });
        
        // Race between the actual check and the timeout
        return Promise.race([
          arduinoController.getArduinoConnectionStates(knownDevices),
          timeoutPromise
        ]);
      };
      
      const connectionStates = await connectionCheckWithTimeout();
      
      const endTime = Date.now();
      const connectedCount = connectionStates.filter(state => state.connected).length;
      
      return connectionStates;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return knownDevices.map(d => ({ comPort: d.comPort, connected: false }));
    }
  });
  
  ipcMain.handle('arduino:test-connection', async (event, comPort, baudRate) => {
    try {
      // Add timeout to prevent the test from hanging
      const testWithTimeout = async () => {
        const timeoutPromise = new Promise<boolean>((resolve) => {
          setTimeout(() => {
            resolve(false);
          }, 3000);
        });
        
        return Promise.race([
          arduinoController.testConnection(comPort, baudRate),
          timeoutPromise
        ]);
      };
      
      const result = await testWithTimeout();
      
      // Log the test result
      logDeviceTest(
        { name: `Arduino ${comPort}`, type: 'Arduino', comPort },
        result,
        result ? `Connection successful at ${baudRate} baud` : 'Connection failed or timeout'
      );
      
      return result;
    } catch (error) {
      logDeviceTest(
        { name: `Arduino ${comPort}`, type: 'Arduino', comPort },
        false,
        `Test error: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  });
  
  ipcMain.handle('arduino:send-message', async (event, comPort, baudRate, message) => {
    try {
      const result = await arduinoController.sendSerialMessage(comPort, baudRate, message);
      return result;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
};
