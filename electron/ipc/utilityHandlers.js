
const { ipcMain } = require('electron');
const { setOutputOverrides, getMainWindow } = require('../state/globals');

// Use dynamic import for ESM module
let psList;
(async () => {
  try {
    psList = (await import('ps-list')).default;
  } catch (err) {
    // Silently fail
  }
})();

function registerUtilityHandlers() {
  // Add override handler
  ipcMain.on('override:update', (_, overrides) => {
    setOutputOverrides(overrides);
    
    // Add debug log for override updates
    const { logEvent } = require('../loggerBridge');
    logEvent('debug', `Output overrides updated: ${Object.keys(overrides || {}).length} overrides active`);
  });

  // Add missing IPC handler for log events from renderer and preload
  ipcMain.on('log:event', (event, logData) => {
    try {
      const { logEvent } = require('../loggerBridge');
      
      // Forward the log event to the loggerBridge system
      if (logData && logData.category && logData.message) {
        logEvent(logData.category, logData.message);
      }
    } catch (error) {
      // Silently fail to avoid infinite loops
    }
  });

  // Add main process memory usage handler
  ipcMain.handle('system:get-memory-usage', async () => {
    try {
      const memoryUsage = process.memoryUsage();
      return {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      };
    } catch (error) {
      console.error('Failed to get memory usage:', error);
      return null;
    }
  });

  // Add renderer process memory usage handler
  ipcMain.handle('system:get-renderer-memory-usage', async (event) => {
    try {
      // Send request to renderer process to get its memory usage
      const mainWindow = getMainWindow();
      if (mainWindow && mainWindow.webContents) {
        const rendererMemory = await mainWindow.webContents.executeJavaScript(`
          (() => {
            const memory = performance.memory || {};
            return {
              usedJSHeapSize: memory.usedJSHeapSize || 0,
              totalJSHeapSize: memory.totalJSHeapSize || 0,
              jsHeapSizeLimit: memory.jsHeapSizeLimit || 0
            };
          })()
        `);
        return rendererMemory;
      }
      return null;
    } catch (error) {
      console.error('Failed to get renderer memory usage:', error);
      return null;
    }
  });

  // Add process list handler
  ipcMain.handle('get-processes', async () => {
    try {
      if (!psList) {
        return [];
      }
      const processes = await psList();
      const filteredProcesses = processes
        .filter(p => p.name && p.name !== '')
        .map(p => ({ name: p.name, pid: p.pid, cmd: p.cmd }))
        .sort((a, b) => a.name.localeCompare(b.name));
        
      // Add debug log for process list requests
      const { logEvent } = require('../loggerBridge');
      logEvent('debug', `Process list requested: found ${filteredProcesses.length} processes`);
      
      return filteredProcesses;
    } catch (error) {
      return [];
    }
  });
}

module.exports = { registerUtilityHandlers };
