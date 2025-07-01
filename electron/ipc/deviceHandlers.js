
const { ipcMain } = require('electron');
const { pacDriveController } = require('../devices/pacDriveController');
const { logger } = require('../logger');
const os = require('os');
const { readDeviceStore, writeDeviceStore } = require('../devices/deviceStoreController');
const { arduinoController } = require('../devices/arduinoController');
const { logDeviceDiscovery, logDeviceConfiguration, logDeviceTest, logDeviceOperation } = require('../services/deviceStatusService');

const registerDeviceHandlers = () => {
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
      const startTime = Date.now();
      
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
      const scanTime = Date.now() - startTime;
      
      // Log the discovery event with enhanced details
      logDeviceDiscovery('PacDrive', devices, { scanTime });
      
      return devices;
    } catch (error) {
      logDeviceDiscovery('PacDrive', [], { error: error.message });
      throw new Error(`Failed to scan for devices: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  
  // Test PacDrive device connection with timeout
  ipcMain.handle('testPacDriveDevice', async (event, deviceId) => {
    const startTime = Date.now();
    
    try {
      // Add a promise with timeout to prevent hanging
      const testWithTimeout = () => {
        return new Promise((resolve) => {
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
      const responseTime = Date.now() - startTime;
      
      // Log the test result with response time
      logDeviceTest(
        { name: `PacDrive ${deviceId}`, type: 'PacDrive', id: deviceId },
        result,
        result ? 'Connection successful' : 'Connection failed or timeout',
        responseTime
      );
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logDeviceTest(
        { name: `PacDrive ${deviceId}`, type: 'PacDrive', id: deviceId },
        false,
        `Test error: ${error.message}`,
        responseTime
      );
      return false; // Return false instead of throwing to prevent UI issues
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
  
  // Device store persistence handlers with logging
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
      const scanTime = Date.now() - startTime;
      
      // Log port discovery with enhanced details
      logDeviceDiscovery('Arduino Serial Port', ports, { scanTime });
      
      return ports;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logDeviceDiscovery('Arduino Serial Port', [], { error: errorMessage });
      return [];
    }
  });
  
  // Arduino connection status handler with timeout
  ipcMain.handle('arduino:getConnectionStates', async (event, knownDevices) => {
    try {
      const startTime = Date.now();
      
      // Add a Promise.race with a timeout to prevent long-running checks
      const connectionCheckWithTimeout = async () => {
        const timeoutPromise = new Promise((resolve) => {
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
      const checkTime = Date.now() - startTime;
      const connectedCount = connectionStates.filter(state => state.connected).length;
      
      // Log connection state check results
      logDeviceDiscovery('Arduino Connection Check', 
        connectionStates.filter(state => state.connected).map(state => state.comPort),
        { 
          scanTime: checkTime,
          totalChecked: knownDevices.length,
          connectedCount
        }
      );
      
      return connectionStates;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logDeviceDiscovery('Arduino Connection Check', [], { error: errorMessage });
      return knownDevices.map(d => ({ comPort: d.comPort, connected: false }));
    }
  });
  
  ipcMain.handle('arduino:test-connection', async (event, comPort, baudRate) => {
    const startTime = Date.now();
    
    try {
      // Add timeout to prevent the test from hanging
      const testWithTimeout = async () => {
        const timeoutPromise = new Promise((resolve) => {
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
      const responseTime = Date.now() - startTime;
      
      // Log the test result with response time
      logDeviceTest(
        { name: `Arduino ${comPort}`, type: 'Arduino', comPort },
        result,
        result ? `Connection successful at ${baudRate} baud` : 'Connection failed or timeout',
        responseTime
      );
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logDeviceTest(
        { name: `Arduino ${comPort}`, type: 'Arduino', comPort },
        false,
        `Test error: ${error.message}`,
        responseTime
      );
      return false;
    }
  });
  
  // Update the method name to match what is expected in the front-end
  ipcMain.handle('arduino:send-message', async (event, comPort, baudRate, message) => {
    try {
      const result = await arduinoController.sendSerialMessage(comPort, baudRate, message);
      
      // Log the operation
      logDeviceOperation(
        { name: `Arduino ${comPort}`, type: 'Arduino', comPort },
        'send-message',
        { baudRate, message: message.substring(0, 50) + (message.length > 50 ? '...' : '') },
        result.success
      );
      
      return result;
    } catch (error) {
      logDeviceOperation(
        { name: `Arduino ${comPort}`, type: 'Arduino', comPort },
        'send-message',
        { baudRate, message: message.substring(0, 50) + (message.length > 50 ? '...' : ''), error: error.message },
        false
      );
      return { success: false, error: String(error) };
    }
  });
};

module.exports = { registerDeviceHandlers };
