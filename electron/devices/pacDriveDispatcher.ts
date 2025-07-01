
import { logger } from '../logger';
import { pacDriveController } from './pacDriveController';

/**
 * Dispatch output signals to a PacDrive device
 * 
 * @param deviceId - The PacDrive device ID (0-based)
 * @param outputChannels - Array of channel numbers to control (0-15)
 * @param value - The value to set (0=off, >=1=on)
 * @returns Response object with success status and optional error message
 */
export function dispatchPacDriveOutput(
  deviceId: number,
  outputChannels: number[],
  value: number
): { success: boolean; error?: string } {
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
    
    // Validate the numeric value
    if (isNaN(value)) {
      return {
        success: false,
        error: `Invalid value for PacDrive: ${value} - must be numeric (0 or 1)`
      };
    }
    
    // Convert the value to a binary state (0 or 1)
    const state = value >= 1 ? 1 : 0;
    
    // Set each output channel individually
    let allSuccessful = true;
    const errors: string[] = [];

    for (const channel of outputChannels) {
      // Validate channel number is in valid range (0-15)
      if (channel < 0 || channel > 15) {
        errors.push(`Invalid channel number: ${channel}`);
        allSuccessful = false;
        continue; // Skip this channel
      }
      
      // Set the output state using the controller
      const success = pacDriveController.setOutput(deviceId, channel, state);
      
      if (!success) {
        const errorMsg = `Failed to set PacDrive output - Device: ${deviceId}, Channel: ${channel}, State: ${state}`;
        errors.push(errorMsg);
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
      error: `Error dispatching to PacDrive: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Convert an array of channel numbers to a bitmask
 * For potential future optimization
 * 
 * @param channels - Array of channel numbers (0-15)
 * @returns The bitmask where each bit represents a channel
 */
export function channelsToBitmask(channels: number[]): number {
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
 * @param deviceId - The PacDrive device ID
 * @param outputChannels - Array of channel numbers (0-15)
 * @param value - The value to set (0=off, >=1=on)
 * @returns Response object with success status and optional error message
 */
export function dispatchPacDriveBitmask(
  deviceId: number,
  outputChannels: number[],
  value: number
): { success: boolean; error?: string } {
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
    
    // Validate the numeric value
    if (isNaN(value)) {
      return {
        success: false,
        error: `Invalid value for PacDrive: ${value} - must be numeric (0 or 1)`
      };
    }

    // Force exact 0 or 1 value
    const state = value >= 1 ? 1 : 0;
    
    // Create bitmask from the channels
    const channelBitmask = channelsToBitmask(outputChannels);

    // Use global state tracking
    if (!global.pacDriveStates) {
      global.pacDriveStates = {};
    }

    // Get or initialize device state
    if (global.pacDriveStates[deviceId] === undefined) {
      global.pacDriveStates[deviceId] = 0;
    }

    // Update state based on operation
    let newState: number;
    if (state === 1) {
      // Turn ON specified channels (OR operation)
      newState = global.pacDriveStates[deviceId] | channelBitmask;
    } else {
      // Turn OFF specified channels (AND with inverted mask)
      newState = global.pacDriveStates[deviceId] & (~channelBitmask);
    }

    // Update the global state
    global.pacDriveStates[deviceId] = newState;
      
    // Set all outputs at once using the bitmask
    const success = pacDriveController.setOutputs(deviceId, newState);

    return {
      success,
      error: success ? undefined : `Failed to set PacDrive outputs using bitmask for device ${deviceId}`
    };
  } catch (error) {
    return {
      success: false,
      error: `Error dispatching bitmask to PacDrive: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Declare global state tracking
declare global {
  namespace NodeJS {
    interface Global {
      pacDriveInitialized?: boolean;
      pacDriveStates?: Record<number, number>;
    }
  }
}

// Export the primary function as default
export default dispatchPacDriveOutput;
