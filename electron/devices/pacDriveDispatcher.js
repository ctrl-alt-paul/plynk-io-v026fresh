
const { logger } = require('../logger');
const { pacDriveController } = require('./pacDriveController');

/**
 * Dispatch output signals to a PacDrive device
 * 
 * @param {number} deviceId - The PacDrive device ID (0-based)
 * @param {Array<number>} outputChannels - Array of channel numbers to control (0-15)
 * @param {number|string} value - The value to set (0=off, >=1=on)
 * @returns {Object} Response with success status and optional error message
 */
function dispatchPacDriveOutput(
  deviceId,
  outputChannels,
  value
) {
  try {
    // Ensure PacDrive is initialized
    if (!global.pacDriveInitialized) {
      const initialized = pacDriveController.initialize();
      global.pacDriveInitialized = initialized;
      
      if (!initialized) {
        return { 
          success: false, 
          error: "Failed to initialize PacDrive. The device may not be connected or properly configured."
        };
      }
    }
    
    // Check if the device is responsive
    const isDeviceResponsive = pacDriveController.testDeviceConnection(deviceId);
    
    if (!isDeviceResponsive) {
      return {
        success: false,
        error: `PacDrive device ${deviceId} is not responding or not connected`
      };
    }
    
    // Force the value to be exactly 0 or 1 (numeric)
    let state;
    if (value === 1 || value === "1") {
      state = 1;  // Force exact numeric 1
    } else {
      state = 0;  // Force exact numeric 0 for everything else
    }
    
    // Set output state for each specified channel
    let allSuccessful = true;
    const errors = [];

    for (const channel of outputChannels) {
      // Validate channel number is in valid range (0-15)
      if (channel < 0 || channel > 15) {
        errors.push(`Invalid channel number: ${channel}`);
        allSuccessful = false;
        continue; // Skip this channel
      }
      
      try {
        // Set the output state using the controller with EXACT numeric 0 or 1
        const success = pacDriveController.setOutput(deviceId, channel, state);
        
        if (!success) {
          const errorMsg = `Failed to set PacDrive LED state - Device: ${deviceId}, Channel: ${channel}, State: ${state}`;
          errors.push(errorMsg);
          allSuccessful = false;
        }
      } catch (setOutputError) {
        errors.push(`Exception: ${setOutputError.message || String(setOutputError)}`);
        allSuccessful = false;
      }
    }
    
    return {
      success: allSuccessful,
      error: errors.length > 0 ? errors.join('; ') : undefined
    };
  } catch (error) {
    return {
      success: false,
      error: `Error dispatching to PacDrive: ${error.message || String(error)}`
    };
  }
}

/**
 * Convert an array of channel numbers to a bitmask
 * For potential future optimization
 * 
 * @param {Array<number>} channels - Array of channel numbers (0-15)
 * @returns {number} The bitmask where each bit represents a channel
 */
function channelsToBitmask(channels) {
  let bitmask = 0;
  
  for (const channel of channels) {
    // Ensure channel is in valid range
    if (channel >= 0 && channel <= 15) {
      // Set the bit corresponding to this channel
      bitmask |= (1 << channel);
    }
  }
  
  return bitmask;
}

/**
 * Enhanced dispatcher implementation that uses bitmasks for preserving state
 * This is now the preferred implementation to fix the channel 1 issue
 * 
 * @param {number} deviceId - The PacDrive device ID
 * @param {Array<number>} outputChannels - Array of channel numbers (0-15)
 * @param {number|string} value - The value to set (0=off, >=1=on)
 * @returns {Object} Response with success status and optional error message
 */
function dispatchPacDriveBitmask(
  deviceId,
  outputChannels,
  value
) {
  try {
    // Ensure PacDrive is initialized
    if (!global.pacDriveInitialized) {
      const initialized = pacDriveController.initialize();
      global.pacDriveInitialized = initialized;
      
      if (!initialized) {
        return { 
          success: false, 
          error: "Failed to initialize PacDrive. The device may not be connected or properly configured."
        };
      }
    }
    
    // Check if the device is responsive
    const isDeviceResponsive = pacDriveController.testDeviceConnection(deviceId);
    
    if (!isDeviceResponsive) {
      return {
        success: false,
        error: `PacDrive device ${deviceId} is not responding or not connected`
      };
    }

    // Force exact 0 or 1 value for PacDrive
    let state;
    if (value === 1 || value === "1") {
      state = 1;  // Exact numeric 1
    } else {
      state = 0;  // Exact numeric 0
    }

    // Get current bitmask from channels - used only for logging
    const channelBitmask = channelsToBitmask(outputChannels);
    
    let success;
    try {
      // For tests, get the full LED state from the controller
      if (global.pacDriveStates && global.pacDriveStates[deviceId] !== undefined) {
        // Use the state tracking from the global object
        const fullState = global.pacDriveStates[deviceId];
        
        // If setting channels ON, add to current state
        if (state === 1) {
          const newState = fullState | channelBitmask;
          success = pacDriveController.setOutputs(deviceId, newState);
          // Update global state
          global.pacDriveStates[deviceId] = newState;
        } 
        // If setting channels OFF, remove from current state
        else {
          const newState = fullState & ~channelBitmask;
          success = pacDriveController.setOutputs(deviceId, newState);
          // Update global state
          global.pacDriveStates[deviceId] = newState;
        }
      } else {
        // Initialize global state tracking if not exists
        if (!global.pacDriveStates) {
          global.pacDriveStates = {};
        }
        
        // Set initial state based on current operation
        if (state === 1) {
          success = pacDriveController.setOutputs(deviceId, channelBitmask);
          global.pacDriveStates[deviceId] = channelBitmask;
        } else {
          success = pacDriveController.setOutputs(deviceId, 0);
          global.pacDriveStates[deviceId] = 0;
        }
      }
    } catch (error) {
      success = false;
    }

    return {
      success,
      error: success ? undefined : `Failed to set PacDrive outputs using bitmask for device ${deviceId}`
    };
  } catch (error) {
    return {
      success: false,
      error: `Error dispatching bitmask to PacDrive: ${error.message || String(error)}`
    };
  }
}

// Export the functions
module.exports = {
  dispatchPacDriveOutput,
  channelsToBitmask,
  dispatchPacDriveBitmask
};
