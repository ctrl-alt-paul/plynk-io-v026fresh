
/**
 * Test Dispatch Handler for Game Manager
 * Handles IPC requests for testing output dispatching without memory polling
 */

const { ipcMain } = require('electron');
const { dispatchTestValue } = require('../gameProfileDispatcher');
const { logger } = require('../logger');
const deviceStore = require('../devices/deviceStoreController');

/**
 * Register IPC handlers for test output dispatch
 */
function registerTestDispatchHandlers() {
  // Handle test output dispatch requests
  ipcMain.handle('game-profile:test-output-dispatch', async (event, output) => {
    try {
      if (!output || !output.label) {
        return { 
          success: false, 
          error: 'Invalid output configuration: missing label' 
        };
      }
      
      if (output.value === undefined || output.value === null) {
        return { 
          success: false, 
          error: 'No test value provided' 
        };
      }
      
      // If the output is not active, return early
      if (output.isActive === false) {
        return {
          success: false,
          error: 'Output is not active'
        };
      }
      
      // Skip dispatch if no device type is configured
      if (!output.device || output.device === 'none' || output.device === 'None') {
        return {
          success: false,
          error: 'No device type selected'
        };
      }
      
      // CRITICAL: Pass-through validation for targetDevice
      if (!output.targetDevice && output.targetDevice !== 0) {
        return {
          success: false,
          error: 'No target device selected'
        };
      }

      // Special PacDrive normalization
      if (output.device?.toLowerCase() === 'pacdrive') {
        // Normalize PacDrive values to exactly string "0" or "1"
        if (output.value === "1" || output.value === 1) {
          output.value = "1";  // Force exact string "1"
        } else {
          output.value = "0";  // Force exact string "0" for all other values
        }
      }
      
      // PacDrive-specific validation
      if (output.device?.toLowerCase() === 'pacdrive') {
        // Validate channel format
        if (output.channel === undefined || output.channel === null) {
          return {
            success: false,
            error: 'No channel selected for PacDrive device'
          };
        }
        
        // Ensure channel is a number or can be converted to one
        let channelNum = Number(output.channel);
        if (isNaN(channelNum)) {
          return {
            success: false,
            error: `Invalid channel format for PacDrive: ${output.channel}`
          };
        }
        
        // Validate channel is in range (1-16 for UI)
        if (channelNum < 1 || channelNum > 16) {
          return {
            success: false,
            error: `Invalid PacDrive channel: ${channelNum}. Must be between 1-16.`
          };
        }
      }
      
      // Dispatch the test value and ensure we return the result
      try {
        const result = await dispatchTestValue(output, output.value);
        return result;
      } catch (dispatchError) {
        return {
          success: false,
          error: `Dispatch error: ${dispatchError.message || String(dispatchError)}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Error in test dispatch: ${error.message || String(error)}`
      };
    }
  });
}

module.exports = {
  registerTestDispatchHandlers
};
