
const { ipcMain } = require('electron');
const { getOutputOptimizationConfig, updateOutputOptimizationConfig } = require('../settingsManager');
const { getMainWindow } = require('../state/globals');

function registerOutputOptimizationHandlers(app) {
  // Helper function to broadcast settings changes
  const broadcastSettingsChange = (eventName, data) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log(`Broadcasting ${eventName}:`, data);
      mainWindow.webContents.send(eventName, data);
    }
  };

  // Get output optimization configuration
  ipcMain.handle('output-optimization:get-config', async () => {
    try {
      const appPath = app.getAppPath();
      const config = getOutputOptimizationConfig(appPath);
      return config;
    } catch (error) {
      throw new Error(`Failed to get output optimization config: ${error.message}`);
    }
  });

  // Update output optimization configuration
  ipcMain.handle('output-optimization:update-config', async (event, config) => {
    try {
      const appPath = app.getAppPath();
      const success = updateOutputOptimizationConfig(appPath, config);
      
      if (!success) {
        throw new Error('Failed to save output optimization configuration');
      }
      
      // Broadcast the change
      broadcastSettingsChange('settings:outputOptimizationChanged', config);
      
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to update output optimization config: ${error.message}`);
    }
  });
}

module.exports = { registerOutputOptimizationHandlers };
