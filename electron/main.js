
const { initializeApp } = require('./core/app');
const { getMainWindow } = require('./state/globals');
const { ipcMain, shell } = require('electron');
const { dispatchPacDriveOutput } = require('./devices/pacDriveDispatcher');
const { logToDevTools } = require('./logger');
const { isPacDriveInitialized, setPacDriveInitialized } = require('./state/globals');
const { pacDriveController } = require('./devices/pacDriveController');
const { registerGitHubHandlers } = require('./ipc/githubHandlers');

// Register GitHub OAuth handlers
registerGitHubHandlers(ipcMain);

// Add handler for opening external URLs
ipcMain.handle('openExternal', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    logToDevTools(`Error opening external URL: ${error}`);
    return { success: false, error: error.message };
  }
});

// Fix the PacDrive output dispatch IPC handler to return the actual result
ipcMain.handle('pac-drive:dispatch-output', async (event, deviceId, channels, value) => {
  try {
    // Check if PacDrive is initialized before dispatching
    if (!isPacDriveInitialized()) {
      logToDevTools(`Warning: PacDrive not initialized. Attempting to initialize now.`);
      const initialized = pacDriveController.initialize();
      setPacDriveInitialized(initialized);
      
      if (!initialized) {
        return { success: false, error: 'Failed to initialize PacDrive. The device may not be connected.' };
      }
    }
    
    // Return the result from the dispatcher instead of ignoring it
    return dispatchPacDriveOutput(deviceId, channels, value);
  } catch (error) {
    logToDevTools(`Error in pac-drive:dispatch-output: ${error}`);
    return { success: false, error: error.message || 'Failed to dispatch output to PacDrive' };
  }
});

// Add handler for getting PacDrive status
ipcMain.handle('pac-drive:get-status', async () => {
  try {
    if (!isPacDriveInitialized()) {
      logToDevTools('PacDrive not initialized, attempting to initialize before getting status');
      const initialized = pacDriveController.initialize();
      setPacDriveInitialized(initialized);
    }
    
    const status = pacDriveController.getStatus();
    return status;
  } catch (error) {
    logToDevTools(`Error getting PacDrive status: ${error}`);
    return {
      initialized: false,
      dllLoaded: false,
      dllLoadError: error instanceof Error ? error.message : String(error),
      deviceCount: 0,
      connectedDevices: [],
      deviceDetails: []
    };
  }
});

// Add handler for getting PacDrive diagnostics
ipcMain.handle('pac-drive:get-diagnostics', async () => {
  try {
    const diagnostics = pacDriveController.getDllDiagnostics();
    return diagnostics;
  } catch (error) {
    logToDevTools(`Error getting PacDrive diagnostics: ${error}`);
    return {
      dllPath: null,
      dllExists: false,
      dllLoaded: false,
      dllLoadError: error instanceof Error ? error.message : String(error)
    };
  }
});

// Add handler for testing a specific PacDrive device
ipcMain.handle('pac-drive:test-device', async (_, deviceId) => {
  try {
    if (!isPacDriveInitialized() && pacDriveController.isDllLoaded()) {
      logToDevTools(`PacDrive not initialized, attempting to initialize before testing device ${deviceId}`);
      const initialized = pacDriveController.initialize();
      setPacDriveInitialized(initialized);
    }
    
    if (!pacDriveController.isDllLoaded()) {
      logToDevTools(`Cannot test device ${deviceId}: PacDrive DLL not loaded: ${pacDriveController.getDllError()}`);
      return false;
    }
    
    if (!isPacDriveInitialized()) {
      logToDevTools(`Failed to initialize PacDrive for device test ${deviceId}`);
      return false;
    }
    
    const isAvailable = pacDriveController.testDeviceConnection(deviceId);
    logToDevTools(`PacDrive device ${deviceId} test result: ${isAvailable ? 'available' : 'not available'}`);
    return isAvailable;
  } catch (error) {
    logToDevTools(`Error testing PacDrive device ${deviceId}: ${error}`);
    return false;
  }
});

// Add handler for scanning PacDrive devices
ipcMain.handle('pac-drive:scan-devices', async () => {
  try {
    if (!pacDriveController.isDllLoaded()) {
      logToDevTools(`Cannot scan for devices: PacDrive DLL not loaded: ${pacDriveController.getDllError()}`);
      return [];
    }
    
    if (!isPacDriveInitialized()) {
      logToDevTools('PacDrive not initialized, attempting to initialize before scanning');
      const initialized = pacDriveController.initialize();
      setPacDriveInitialized(initialized);
    }
    
    if (!isPacDriveInitialized()) {
      logToDevTools('Failed to initialize PacDrive for scanning');
      return [];
    }
    
    const devices = pacDriveController.scanForDevices();
    logToDevTools(`PacDrive scan found ${devices.length} devices: ${devices.join(', ')}`);
    return devices;
  } catch (error) {
    logToDevTools(`Error scanning PacDrive devices: ${error}`);
    return [];
  }
});

// Add new HID device handlers
const hidDeviceManager = require('./devices/hidDeviceManager');

// HID device list handler
ipcMain.handle('hid:list-devices', async () => {
  try {
    const devices = hidDeviceManager.listDevices();
    logToDevTools(`HID device scan completed: found ${devices.length} devices`);
    return devices;
  } catch (error) {
    logToDevTools(`Error listing HID devices: ${error}`);
    return [];
  }
});

// HID device info handler
ipcMain.handle('hid:get-device-info', async (_, path) => {
  try {
    const deviceInfo = hidDeviceManager.getDeviceInfo(path);
    return deviceInfo;
  } catch (error) {
    logToDevTools(`Error getting HID device info: ${error}`);
    return null;
  }
});

// HID device test handler
ipcMain.handle('hid:test-device', async (_, path) => {
  try {
    const isAccessible = hidDeviceManager.testDevice(path);
    return isAccessible;
  } catch (error) {
    logToDevTools(`Error testing HID device: ${error}`);
    return false;
  }
});

// HID to PacDrive mapping handler
ipcMain.handle('hid:map-to-pac-drive', async (_, hidPath, pacDriveIndex) => {
  try {
    const result = hidDeviceManager.mapToPacDriveIndex(hidPath, pacDriveIndex);
    return result;
  } catch (error) {
    logToDevTools(`Error mapping HID to PacDrive: ${error}`);
    return false;
  }
});

// Initialize the app
initializeApp();

// Export mainWindow for logger bridge
module.exports = { getMainWindow };
