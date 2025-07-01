
/**
 * Message Output Handler
 * Handles IPC events for message-based output detection and dispatching
 */

const { ipcMain } = require('electron');
const gameProfileDispatcher = require('../gameProfileDispatcher');
const { logEvent } = require('../loggerBridge');
const { handleMessageUpdate } = require('../outputDispatcher');

// Store active profile for message dispatch
let activeGameProfile = null;

/**
 * Initialize message output IPC handlers
 */
function initializeMessageOutputHandlers() {
  // Handle incoming message outputs from external sources
  ipcMain.on('message:outputDetected', async (event, data) => {
    try {
      const { key, value } = data;

      logEvent(
        'message-scan',
        `Received message output via IPC: key='${key}', value=${value}`
      );

      if (typeof key !== 'string' || key.trim() === '') {
        logEvent(
          'warning',
          `Invalid message output key received: ${typeof key} ${key}`
        );
        return;
      }

      // Only enforce value checks if this is a value‐packet
      if ('value' in data && (value === undefined || value === null)) {
        logEvent(
          'warning',
          `Invalid message output value received for key '${key}': ${value}`
        );
        return;
      }

      // Dispatch numeric updates into your profile logic as before
      if ('value' in data) {
        gameProfileDispatcher.handleMessageOutput(key, value);
        
        // NEW: Also dispatch through output dispatcher for device control using SIMPLIFIED approach
        if (activeGameProfile) {
          try {
            await handleMessageUpdate(key, value, activeGameProfile);
          } catch (error) {
            logEvent(
              'warning',
              `Error dispatching message to devices: ${error.message || String(error)}`
            );
          }
        }
      }

      // **** FORWARD TO RENDERERS ****
      // Forward the entire data object, preserving {key,label}, {key,text} or {key,value}
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('message:outputDetected', data);
      });
    } catch (error) {
      logEvent(
        'warning',
        `Error handling message output IPC: ${error.message || String(error)}`
      );
    }
  });

  // Handle setting active profile for message dispatch (SIMPLIFIED - only game profile needed)
  ipcMain.handle('message:setActiveProfile', async (event, { gameProfile }) => {
    try {
      activeGameProfile = gameProfile;
      
      logEvent(
        'message-scan',
        `Active game profile set for message dispatch: ${gameProfile?.profileName}`
      );
      
      return { success: true };
    } catch (error) {
      logEvent(
        'warning',
        `Error setting active profile for message dispatch: ${error.message || String(error)}`
      );
      return { success: false, error: error.message || String(error) };
    }
  });

  // Handle clearing active profiles
  ipcMain.handle('message:clearActiveProfile', async (event) => {
    try {
      activeGameProfile = null;
      
      logEvent('message-scan', 'Active profile cleared for message dispatch');
      
      return { success: true };
    } catch (error) {
      logEvent(
        'warning',
        `Error clearing active profile for message dispatch: ${error.message || String(error)}`
      );
      return { success: false, error: error.message || String(error) };
    }
  });

  logEvent('startup', 'Message output IPC handlers initialized');
}

module.exports = {
  initializeMessageOutputHandlers
};
