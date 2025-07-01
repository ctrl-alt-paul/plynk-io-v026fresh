
const { ipcMain, app: electronApp } = require('electron');
const { 
  getProcessMonitorConfig, 
  updateProcessMonitorConfig, 
  updateProcessMonitorUserPreference,
  getLogPageConfig, 
  updateLogPageConfig,
  getLogConfig,
  updateLogConfig,
  getMasterLoggingConfig, 
  updateMasterLoggingConfig,
  getMessageListenerConfig,
  updateMessageListenerConfig,
  getStartupConfig,
  updateStartupConfig
} = require('../settingsManager');
const { 
  initializeProcessMonitor, 
  startProcessMonitor, 
  stopProcessMonitor, 
  isMonitorRunning, 
  runDiagnostics, 
  setScanInterval,
  setActiveProfile
} = require('../processMonitor');
const { getMainWindow, setProcessMonitorStarted, isProcessMonitorStarted } = require('../state/globals');
const { logToFile } = require('../logger');
const fs = require('fs');
const path = require('path');

function registerSettingsHandlers(app) {
  // Helper function to broadcast settings changes
  const broadcastSettingsChange = (eventName, data) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log(`Broadcasting ${eventName}:`, data);
      mainWindow.webContents.send(eventName, data);
    }
  };

  // Process monitor handlers
  ipcMain.handle('process-monitor:get-status', async () => {
    try {
      const isRunning = isMonitorRunning();
      const diagnostics = runDiagnostics(app);
      
      // Add debug log for process monitor status requests
      const { logEvent } = require('../loggerBridge');
      logEvent('debug', `Process monitor status requested: running=${isRunning}, scan interval=${diagnostics.scanInterval}ms`);
      
      return { 
        success: true, 
        isRunning, 
        diagnostics 
      };
    } catch (error) {
      logToFile(`Error getting process monitor status: ${error.message}`);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  ipcMain.handle('process-monitor:start', async () => {
    try {
      if (isProcessMonitorStarted()) {
        return { 
          success: true, 
          message: 'Process monitor already running' 
        };
      }
      
      const mainWindow = getMainWindow();
      const result = startProcessMonitor(mainWindow, app);
      setProcessMonitorStarted(result);
      
      // Add debug log for process monitor start
      const { logEvent } = require('../loggerBridge');
      logEvent('debug', `Process monitor start requested: ${result ? 'SUCCESS' : 'FAILED'}`);
      
      // Save user preference when they explicitly start the monitor
      if (result) {
        updateProcessMonitorUserPreference(app.getAppPath(), true);
        // Broadcast the change
        broadcastSettingsChange('settings:processMonitorChanged', { isRunning: true });
      }
      
      return { 
        success: result, 
        message: result ? 'Process monitor started' : 'Failed to start process monitor' 
      };
    } catch (error) {
      logToFile(`Error starting process monitor: ${error.message}`);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  ipcMain.handle('process-monitor:stop', async () => {
    try {
      if (!isProcessMonitorStarted()) {
        return { 
          success: true, 
          message: 'Process monitor not running' 
        };
      }
      
      const result = stopProcessMonitor();
      setProcessMonitorStarted(!result);
      
      // Add debug log for process monitor stop
      const { logEvent } = require('../loggerBridge');
      logEvent('debug', `Process monitor stop requested: ${result ? 'SUCCESS' : 'FAILED'}`);
      
      // Save user preference when they explicitly stop the monitor
      if (result) {
        updateProcessMonitorUserPreference(app.getAppPath(), false);
        // Broadcast the change
        broadcastSettingsChange('settings:processMonitorChanged', { isRunning: false });
      }
      
      return { 
        success: result, 
        message: result ? 'Process monitor stopped' : 'Failed to stop process monitor' 
      };
    } catch (error) {
      logToFile(`Error stopping process monitor: ${error.message}`);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  ipcMain.handle('process-monitor:set-interval', async (_, interval) => {
    try {
      const result = setScanInterval(interval);
      
      if (result) {
        // Broadcast the change
        broadcastSettingsChange('settings:processMonitorChanged', { scanInterval: interval });
      }
      
      return { 
        success: result, 
        message: result ? `Scan interval set to ${interval}ms` : 'Failed to set scan interval' 
      };
    } catch (error) {
      logToFile(`Error setting scan interval: ${error.message}`);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // Update process monitor handlers to use settings
  ipcMain.handle('process-monitor:get-config', async () => {
    try {
      const config = getProcessMonitorConfig(app.getAppPath());
      
      return { 
        success: true, 
        isRunning: config.userPreference, // Use userPreference instead of isMonitorRunning()
        scanInterval: config.scanInterval
      };
    } catch (error) {
      logToFile(`Error getting process monitor config: ${error.message}`);
      return { 
        success: false, 
        error: error.message,
        isRunning: false,
        scanInterval: 3000
      };
    }
  });

  // Add log page settings handlers
  ipcMain.handle('log-page:get-config', async () => {
    try {
      const config = getLogPageConfig(app.getAppPath());
      
      return { 
        success: true, 
        autoScroll: config.autoScroll,
        categories: config.categories
      };
    } catch (error) {
      logToFile(`Error getting log page config: ${error.message}`);
      return { 
        success: false, 
        error: error.message,
        autoScroll: true,
        categories: {}
      };
    }
  });

  ipcMain.handle('log-page:update-config', async (_, config) => {
    try {
      const success = updateLogPageConfig(app.getAppPath(), config);
      
      if (success) {
        // Broadcast the change
        broadcastSettingsChange('settings:logPageChanged', config);
      }
      
      return { 
        success, 
        message: success ? 'Log page config updated successfully' : 'Failed to update log page config' 
      };
    } catch (error) {
      logToFile(`Error updating log page config: ${error.message}`);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // Add log configuration handlers
  ipcMain.handle('log-config:get-config', async () => {
    try {
      const config = getLogConfig(app.getAppPath());
      
      return { 
        success: true, 
        maxLogEntries: config.maxLogEntries
      };
    } catch (error) {
      logToFile(`Error getting log config: ${error.message}`);
      return { 
        success: false, 
        error: error.message,
        maxLogEntries: 20000
      };
    }
  });

  ipcMain.handle('log-config:update-config', async (_, config) => {
    try {
      const success = updateLogConfig(app.getAppPath(), config);
      
      if (success) {
        // Broadcast the change
        broadcastSettingsChange('settings:logConfigChanged', config);
      }
      
      return { 
        success, 
        message: success ? 'Log configuration updated successfully' : 'Failed to update log configuration' 
      };
    } catch (error) {
      logToFile(`Error updating log config: ${error.message}`);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // Add master logging settings handlers
  ipcMain.handle('master-logging:get-config', async () => {
    try {
      const config = getMasterLoggingConfig(app.getAppPath());
      
      return { 
        success: true, 
        enabled: config.enabled
      };
    } catch (error) {
      logToFile(`Error getting master logging config: ${error.message}`);
      return { 
        success: false, 
        error: error.message,
        enabled: false
      };
    }
  });

  ipcMain.handle('master-logging:update-config', async (_, config) => {
    try {
      const success = updateMasterLoggingConfig(app.getAppPath(), config);
      
      if (success) {
        // Broadcast the change
        broadcastSettingsChange('settings:masterLoggingChanged', config);
      }
      
      return { 
        success, 
        message: success ? 'Master logging config updated successfully' : 'Failed to update master logging config' 
      };
    } catch (error) {
      logToFile(`Error updating master logging config: ${error.message}`);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // Add message listener handlers
  ipcMain.handle('message-listener:get-config', async () => {
    try {
      const config = getMessageListenerConfig(app.getAppPath());
      
      return { 
        success: true, 
        isEnabled: config.isEnabled
      };
    } catch (error) {
      logToFile(`Error getting message listener config: ${error.message}`);
      return { 
        success: false, 
        error: error.message,
        isEnabled: false
      };
    }
  });

  ipcMain.handle('message-listener:toggle', async (_, isEnabled) => {
    try {
      const success = updateMessageListenerConfig(app.getAppPath(), { isEnabled });
      
      // Clear the master logging cache when settings change
      const { clearMasterLoggingCache } = require('../loggerBridge');
      clearMasterLoggingCache();
      
      if (success) {
        // Broadcast the change
        broadcastSettingsChange('settings:messageListenerChanged', { isEnabled });
      }
      
      return { 
        success, 
        message: success ? `Message listener ${isEnabled ? 'enabled' : 'disabled'}` : 'Failed to update message listener config' 
      };
    } catch (error) {
      logToFile(`Error toggling message listener: ${error.message}`);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // Add the missing message listener handlers that the frontend is trying to use
  ipcMain.handle('settings:getMessageListener', async () => {
    try {
      const config = getMessageListenerConfig(app.getAppPath());
      
      return { 
        success: true,
        isEnabled: config.isEnabled,
        timeout: config.timeout,
        timeoutEnabled: config.timeoutEnabled
      };
    } catch (error) {
      logToFile(`Error getting message listener settings: ${error.message}`);
      return { 
        success: false, 
        error: error.message,
        isEnabled: false,
        timeout: 30,
        timeoutEnabled: true
      };
    }
  });

  ipcMain.handle('settings:updateMessageListener', async (event, updateData) => {
    try {
      const success = updateMessageListenerConfig(app.getAppPath(), updateData);
      
      if (success) {
        // Broadcast the settings change to all renderer processes
        broadcastSettingsChange('settings:messageListenerChanged', updateData);
      }
      
      return { 
        success, 
        message: success ? 'Message listener settings updated successfully' : 'Failed to update message listener settings' 
      };
    } catch (error) {
      logToFile(`Error updating message listener settings: ${error.message}`);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // Add this IPC handler for setting active profile from message detection
  ipcMain.handle('process-monitor:set-active-profile', async (event, { profileName, profile }) => {
    try {
      const result = setActiveProfile(profileName, profile);
      return { success: true, result };
    } catch (error) {
      const { logEvent } = require('../loggerBridge');
      logEvent('warning', `Error setting active profile: ${error.message || String(error)}`);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Add startup settings handlers
  ipcMain.handle('startup:get-config', async () => {
    try {
      const config = getStartupConfig(app.getAppPath());
      
      // Check current auto-launch status
      const loginItemSettings = electronApp.getLoginItemSettings();
      const actualStartWithWindows = loginItemSettings.openAtLogin;
      
      return { 
        success: true, 
        startMinimized: config.startMinimized,
        startWithWindows: actualStartWithWindows
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        startMinimized: false,
        startWithWindows: false
      };
    }
  });

  ipcMain.handle('startup:update-config', async (_, config) => {
    try {
      const success = updateStartupConfig(app.getAppPath(), config);
      
      // Handle start with Windows setting
      if (config.hasOwnProperty('startWithWindows')) {
        electronApp.setLoginItemSettings({
          openAtLogin: config.startWithWindows,
          openAsHidden: config.startMinimized || false
        });
      }
      
      if (success) {
        // Broadcast the change
        broadcastSettingsChange('settings:startupChanged', config);
      }
      
      return { 
        success, 
        message: success ? 'Startup settings updated successfully' : 'Failed to update startup settings' 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // Add handler for writing logs to file (for Log page export functionality)
  ipcMain.handle('log:writeToFile', async (_, logs) => {
    try {
      // Create logs directory if it doesn't exist
      const logsDir = path.join(path.dirname(app.getAppPath()), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `system-logs-${timestamp}.txt`;
      const filePath = path.join(logsDir, filename);
      
      // Format logs for file output
      let logContent = '=== System Logs Export ===\n';
      logContent += `Generated: ${new Date().toLocaleString()}\n`;
      logContent += `Total Entries: ${logs.length}\n\n`;
      
      logs.forEach(log => {
        const timestamp = new Date(log.timestamp).toLocaleString();
        logContent += `[${timestamp}] ${log.category.toUpperCase()}\n`;
        logContent += `${log.description}\n`;
        if (log.data) {
          logContent += `Data: ${JSON.stringify(log.data, null, 2)}\n`;
        }
        logContent += '\n';
      });
      
      // Write to file
      fs.writeFileSync(filePath, logContent, 'utf8');
      
      return {
        success: true,
        filePath: filePath,
        message: `Logs exported successfully to ${filename}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to write logs to file'
      };
    }
  });
}

module.exports = { registerSettingsHandlers };
