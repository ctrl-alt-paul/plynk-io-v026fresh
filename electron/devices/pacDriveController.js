
const koffi = require('koffi');
const path = require('path');
const { logger } = require('../logger');
const fs = require('fs');

// Define the path to the PacDrive DLL
const dllPath = path.join(__dirname, '..', 'PacDrive.dll');

// Track connected devices
let connectedDevices = [];
let initialized = false;
let dllLoaded = false;
let dllLoadError = null;

// Maximum number of devices to check
const MAX_DEVICE_CHECK = 16;

// DLL function references
let PacInitialize;
let PacShutdown;
let PacSetLEDState;
let PacSetLEDStates;
let PacGetVendorId;
let PacGetProductId;
let PacGetDeviceType;
let dll;

// Check if DLL exists before trying to load it
if (!fs.existsSync(dllPath)) {
  logger.error(`PacDrive DLL not found at path: ${dllPath}`);
  dllLoadError = `DLL not found at path: ${dllPath}`;
} else {
  try {
    // Load the PacDrive DLL using koffi
    dll = koffi.load(dllPath);
    logger.info('PacDrive DLL loaded successfully');
    
    // Define the function signatures from the PacDrive DLL based on the actual exports
    PacInitialize = dll.func('int PacInitialize()');
    PacShutdown = dll.func('int PacShutdown()');
    PacSetLEDState = dll.func('int PacSetLEDState(int, int, int)');
    PacSetLEDStates = dll.func('int PacSetLEDStates(int, int)');
    // Use functions confirmed to exist in the DLL
    PacGetVendorId = dll.func('int PacGetVendorId(int)');
    PacGetProductId = dll.func('int PacGetProductId(int)');
    PacGetDeviceType = dll.func('int PacGetDeviceType(int)');
    
    dllLoaded = true;
  } catch (error) {
    dllLoadError = `Failed to load PacDrive DLL: ${error.message || error}`;
    logger.error(dllLoadError);
  }
}

/**
 * Gets the number of connected PacDrive devices by checking each possible index
 * This method doesn't rely on PacGetDeviceCount which is missing from the DLL
 * @returns {number} Number of responsive devices found
 */
function getDeviceCount() {
  if (!initialized || !dllLoaded) {
    logger.warn('Cannot get device count: PacDrive not initialized or DLL not loaded');
    return 0;
  }
  
  try {
    // Instead of using PacGetDeviceCount, we'll check each possible device index
    // by attempting to get its vendor ID
    let count = 0;
    
    for (let i = 0; i < MAX_DEVICE_CHECK; i++) {
      try {
        // Try to get vendor ID as a way to check if device exists
        const vendorId = PacGetVendorId(i);
        if (vendorId > 0) {
          count++;
        }
      } catch (error) {
        // Ignore errors for specific device indices - it's expected
      }
    }
    
    logger.info(`PacDrive detected ${count} devices via vendor ID check`);
    return count;
  } catch (error) {
    logger.error(`Error getting PacDrive device count: ${error}`);
    return 0;
  }
}

/**
 * Gets information about a PacDrive device
 * @param {number} deviceId - Device index to query (0-based)
 * @returns {Object} Object with device information or null on error
 */
function getDeviceInfo(deviceId) {
  if (!initialized || !dllLoaded) {
    logger.warn(`Cannot get device info: PacDrive not initialized or DLL not loaded`);
    return null;
  }
  
  try {
    const vendorId = PacGetVendorId(deviceId);
    const productId = PacGetProductId(deviceId);
    
    if (vendorId > 0 && productId > 0) {
      return {
        vendorId: `0x${vendorId.toString(16).toUpperCase()}`,
        productId: `0x${productId.toString(16).toUpperCase()}`
      };
    }
    
    return null;
  } catch (error) {
    logger.error(`Error getting device info for device ${deviceId}: ${error}`);
    return null;
  }
}

/**
 * Scans for connected PacDrive devices and returns their IDs
 * @returns {Array<number>} Array of connected device IDs
 */
function scanForDevices() {
  if (!dllLoaded) {
    logger.error(`Cannot scan for devices: PacDrive DLL not loaded: ${dllLoadError}`);
    return [];
  }
  
  if (!initialized) {
    initialize();
  }
  
  if (!initialized) {
    logger.error('Cannot scan for devices: PacDrive failed to initialize');
    return [];
  }
  
  const devices = [];
  
  // Check all possible device indices
  for (let i = 0; i < MAX_DEVICE_CHECK; i++) {
    // Check if device is responsive by testing a quick LED toggle
    if (testDeviceConnection(i)) {
      devices.push(i);
    }
  }
  
  if (devices.length > 0) {
    logger.info(`Found ${devices.length} responsive PacDrive devices`);
  } else {
    logger.warn('No responsive PacDrive devices found');
  }
  
  return devices;
}

/**
 * Test if a device is connected and responding
 * @param {number} deviceId - The device ID to test
 * @returns {boolean} True if the device responds, false otherwise
 */
function testDeviceConnection(deviceId) {
  if (!dllLoaded) {
    logger.debug(`Cannot test device connection: PacDrive DLL not loaded`);
    return false;
  }
  
  try {
    // Try to set an LED state as a simple test (LED 0 to state 0)
    // This shouldn't have any visible effect but tests communication
    const result = PacSetLEDState(deviceId, 0, 0);
    // FIXED: According to PacDrive SDK, non-zero means success
    return result !== 0;
  } catch (error) {
    // Do not log errors for device tests - expected to fail for non-existent devices
    return false;
  }
}

/**
 * Initialize the PacDrive system and scan for devices
 * @returns {boolean} true if successful, false otherwise
 */
function initialize() {
  try {
    if (initialized) {
      logger.info('PacDrive already initialized');
      return true;
    }
    
    if (!dllLoaded) {
      logger.error(`Cannot initialize PacDrive: DLL not loaded: ${dllLoadError}`);
      return false;
    }
    
    const result = PacInitialize();
    // FIXED: According to PacDrive SDK, non-zero means success
    if (result !== 0) {
      initialized = true;
      logger.info('PacDrive initialized successfully');
      
      // Scan for connected devices
      connectedDevices = scanForDevices();
      
      return true;
    } else {
      logger.error(`PacDrive initialization failed with code: ${result}`);
      return false;
    }
  } catch (error) {
    logger.error(`Error initializing PacDrive: ${error}`);
    return false;
  }
}

/**
 * Shutdown the PacDrive system
 * @returns {boolean} true if successful, false otherwise
 */
function shutdown() {
  try {
    if (!initialized) {
      logger.info('PacDrive not initialized, nothing to shutdown');
      return true;
    }
    
    if (!dllLoaded) {
      logger.warn('Cannot shutdown PacDrive: DLL not loaded');
      initialized = false;
      connectedDevices = [];
      return false;
    }
    
    const result = PacShutdown();
    // FIXED: According to PacDrive SDK, non-zero means success
    if (result !== 0) {
      initialized = false;
      connectedDevices = [];
      logger.info('PacDrive shutdown successfully');
      return true;
    } else {
      logger.error(`PacDrive shutdown failed with code: ${result}`);
      return false;
    }
  } catch (error) {
    logger.error(`Error shutting down PacDrive: ${error}`);
    return false;
  }
}

/**
 * Set a single LED output state
 * @param {number} deviceId - The ID of the PacDrive device (0-based)
 * @param {number} outputIndex - The output index (0-15 for PacDrive)
 * @param {number} state - The state to set (0=off, 1=on)
 * @returns {boolean} true if successful, false otherwise
 */
function setOutput(deviceId, outputIndex, state) {
  try {
    // Check if DLL is loaded first
    if (!dllLoaded) {
      logger.error(`Cannot set output: PacDrive DLL not loaded`);
      return false;
    }
    
    // Make sure we're initialized
    if (!initialized && !initialize()) {
      return false;
    }
    
    // Validate parameters
    if (outputIndex < 0 || outputIndex > 15) {
      logger.error(`Invalid output index: ${outputIndex}. Must be between 0-15.`);
      return false;
    }
    
    if (state !== 0 && state !== 1) {
      logger.error(`Invalid state: ${state}. Must be 0 or 1.`);
      return false;
    }

    const result = PacSetLEDState(deviceId, outputIndex, state);
    // FIXED: According to PacDrive SDK, non-zero means success
    if (result !== 0) {
      logger.debug(`PacDrive LED state set successfully - Device: ${deviceId}, Output: ${outputIndex}, State: ${state}`);
      return true;
    } else {
      logger.error(`Failed to set PacDrive LED state - Device: ${deviceId}, Output: ${outputIndex}, State: ${state}, Error Code: ${result}`);
      return false;
    }
  } catch (error) {
    logger.error(`Error setting PacDrive LED state: ${error}`);
    return false;
  }
}

/**
 * Set multiple LED output states using a bitmask
 * @param {number} deviceId - The ID of the PacDrive device (0-based)
 * @param {number} bitmask - A bitmask where each bit represents one LED (bit 0 = LED 0, etc.)
 * @returns {boolean} true if successful, false otherwise
 */
function setOutputs(deviceId, bitmask) {
  try {
    // Check if DLL is loaded first
    if (!dllLoaded) {
      logger.error(`Cannot set outputs: PacDrive DLL not loaded`);
      return false;
    }
    
    // Make sure we're initialized
    if (!initialized && !initialize()) {
      return false;
    }
    
    const result = PacSetLEDStates(deviceId, bitmask);
    // FIXED: According to PacDrive SDK, non-zero means success
    if (result !== 0) {
      logger.debug(`PacDrive LED states set successfully - Device: ${deviceId}, Bitmask: 0x${bitmask.toString(16)}`);
      return true;
    } else {
      logger.error(`Failed to set PacDrive LED states - Device: ${deviceId}, Bitmask: 0x${bitmask.toString(16)}, Error Code: ${result}`);
      return false;
    }
  } catch (error) {
    logger.error(`Error setting PacDrive LED states: ${error}`);
    return false;
  }
}

/**
 * Get a list of connected device IDs
 * @returns {Array<number>} Array of device IDs
 */
function getConnectedDevices() {
  return [...connectedDevices];
}

/**
 * Diagnostic function to report PacDrive status
 * @returns {Object} Status information object
 */
function getStatus() {
  const status = {
    initialized,
    dllLoaded,
    dllLoadError: dllLoadError || null,
    deviceCount: initialized && dllLoaded ? connectedDevices.length : 0,
    connectedDevices: [...connectedDevices],
    deviceDetails: []
  };
  
  // If initialized, get details for each device
  if (initialized && dllLoaded) {
    for (const deviceId of connectedDevices) {
      const deviceInfo = getDeviceInfo(deviceId);
      const responsive = testDeviceConnection(deviceId);
      
      status.deviceDetails.push({
        deviceId,
        vendorId: deviceInfo?.vendorId,
        productId: deviceInfo?.productId,
        responsive
      });
    }
  }
  
  return status;
}

/**
 * Returns diagnostic information about the DLL, separated from full status
 * @returns {Object} DLL diagnostic information
 */
function getDllDiagnostics() {
  return {
    dllPath,
    dllExists: fs.existsSync(dllPath),
    dllLoaded,
    dllLoadError: dllLoadError || null
  };
}

// Basic testing function
function test() {
  logger.info('Starting PacDrive test sequence');
  
  // Check if DLL is loaded first
  if (!dllLoaded) {
    logger.error(`Cannot run test: PacDrive DLL not loaded: ${dllLoadError}`);
    return;
  }
  
  // Initialize PacDrive
  if (!initialize()) {
    logger.error('Failed to initialize PacDrive. Test aborted.');
    return;
  }
  
  // Turn on LED 1 (index 0) on device 0
  logger.info('Turning on LED 1...');
  if (setOutput(0, 0, 1)) {
    logger.info('LED 1 turned on successfully');
  } else {
    logger.error('Failed to turn on LED 1');
  }
  
  // Wait 1 second
  logger.info('Waiting 1 second...');
  setTimeout(() => {
    // Turn off LED 1
    logger.info('Turning off LED 1...');
    if (setOutput(0, 0, 0)) {
      logger.info('LED 1 turned off successfully');
    } else {
      logger.error('Failed to turn off LED 1');
    }
    
    // Set multiple LEDs with bitmask (LEDs 2, 4, and 6)
    logger.info('Setting multiple LEDs with bitmask...');
    const bitmask = (1 << 1) | (1 << 3) | (1 << 5); // Setting LEDs 2, 4, and 6 (indices 1, 3, 5)
    if (setOutputs(0, bitmask)) {
      logger.info('Multiple LEDs set successfully');
    } else {
      logger.error('Failed to set multiple LEDs');
    }
    
    // Wait 1 second
    logger.info('Waiting 1 second...');
    setTimeout(() => {
      // Turn off all LEDs
      logger.info('Turning off all LEDs...');
      if (setOutputs(0, 0)) {
        logger.info('All LEDs turned off successfully');
      } else {
        logger.error('Failed to turn off all LEDs');
      }
      
      // Shutdown PacDrive
      logger.info('Shutting down PacDrive...');
      if (shutdown()) {
        logger.info('PacDrive shutdown successfully. Test completed.');
      } else {
        logger.error('Failed to shutdown PacDrive');
      }
    }, 1000);
  }, 1000);
}

// Export the main functions
const pacDriveController = {
  initialize,
  shutdown,
  setOutput,
  setOutputs,
  test,
  getDeviceCount,
  getDeviceInfo,
  scanForDevices,
  testDeviceConnection,
  getConnectedDevices,
  getStatus,
  getDllDiagnostics,
  isDllLoaded: () => dllLoaded,
  getDllError: () => dllLoadError
};

module.exports = {
  pacDriveController,
  initialize,
  shutdown,
  setOutput,
  setOutputs,
  test,
  getDeviceCount,
  getDeviceInfo,
  scanForDevices,
  testDeviceConnection,
  getConnectedDevices,
  getStatus,
  getDllDiagnostics,
  isDllLoaded: () => dllLoaded,
  getDllError: () => dllLoadError
};
