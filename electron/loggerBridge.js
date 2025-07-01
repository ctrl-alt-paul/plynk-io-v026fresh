
/**
 * Logger Bridge - Centralized logging utility for sending categorized log events to the frontend
 * Sends real-time log messages to the Log page via IPC without file or console logging
 */

// Cache master logging state to avoid repeated file reads
let cachedMasterLoggingEnabled = null;
let lastCacheTime = 0;
const CACHE_DURATION = 5000; // Cache for 5 seconds

/**
 * Get master logging enabled state with caching
 */
function getMasterLoggingEnabled() {
  const now = Date.now();
  
  // Return cached value if still valid
  if (cachedMasterLoggingEnabled !== null && (now - lastCacheTime) < CACHE_DURATION) {
    return cachedMasterLoggingEnabled;
  }
  
  try {
    const { getMasterLoggingConfig } = require('./settingsManager');
    const { app } = require('electron');
    
    if (app && app.getAppPath) {
      const config = getMasterLoggingConfig(app.getAppPath());
      cachedMasterLoggingEnabled = config.enabled || false;
      lastCacheTime = now;
      return cachedMasterLoggingEnabled;
    }
  } catch (error) {
    // Default to false if there's any error
    cachedMasterLoggingEnabled = false;
  }
  
  return cachedMasterLoggingEnabled || false;
}

/**
 * Sends a categorized log event to the frontend Log page via IPC
 * @param {string} category - Log category (e.g., 'memory', 'device', 'dispatch', 'warning', 'debug')
 * @param {string|object} message - Log message content
 */
function logEvent(category, message) {
  // Check if master logging is enabled before proceeding
  if (!getMasterLoggingEnabled()) {
    return;
  }

  // Use the global main window reference directly to avoid circular dependency
  if (!global.mainWindow || global.mainWindow.isDestroyed()) {
    // Silently fail if window is not available - no console logging
    return;
  }

  try {
    // Structure the log event data
    const logData = {
      timestamp: new Date().toISOString(),
      category: category || 'debug',
      message: typeof message === 'string' ? message : JSON.stringify(message, null, 2)
    };

    // Send the log event to the frontend via IPC
    global.mainWindow.webContents.send('log:event', logData);
  } catch (error) {
    // Silently fail - no console logging as per requirements
  }
}

/**
 * Clear the master logging cache (call when settings change)
 */
function clearMasterLoggingCache() {
  cachedMasterLoggingEnabled = null;
  lastCacheTime = 0;
}

module.exports = {
  logEvent,
  clearMasterLoggingCache
};
