
const { ipcMain } = require('electron');
const { startPollingMemory, stopPollingMemory, updatePollRate, getPerformanceMetrics, readMemoryBatch } = require('../memoryPollingService');
const realMemoryReader = require('../memoryReaderReal');
const { setCurrentGameProfile, getCurrentGameProfile, getMainWindow } = require('../state/globals');
const { setHighPerformanceMode, isHighPerformanceMode } = require('../logger');
const fs = require('fs');
const path = require('path');

function registerMemoryHandlers(app) {
  // Add memory read handler with enhanced error handling and retry logic
  ipcMain.handle('read-memory', async (_, processName, address, type, index) => {
    try {
      if (!processName || !address || !type) {
        throw new Error('Invalid parameters: processName, address, and type are required');
      }

      // First attempt to read memory
      let result = await realMemoryReader.readRealMemory(processName, address, type);
      
      // If first attempt fails, retry once
      if (!result.success) {
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send('log:devtools', `First read attempt failed: ${result.error}. Retrying once...`);
        }
        
        // Wait a short time before retrying (50ms)
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Retry the memory read
        result = await realMemoryReader.readRealMemory(processName, address, type);
        
        if (!result.success && mainWindow) {
          mainWindow.webContents.send('log:devtools', `Retry also failed: ${result.error}`);
        }
      }
      
      // Include index in result for proper matching during polling
      return {
        ...result,
        id: index
      };
      
    } catch (error) {
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('log:devtools', `Critical error reading memory: ${error.message}`);
      }
      return {
        success: false,
        error: error.message || 'Unknown memory read error',
        value: null,
        id: index
      };
    }
  });

  // Add module base find handler
  ipcMain.handle('find-module-base', async (event, processName, moduleName) => {
    if (!processName || !moduleName) {
      return {
        success: false,
        error: 'Process name and module name are required'
      };
    }
    
    try {
      return await realMemoryReader.findModuleBaseAddress(processName, moduleName);
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to find module base address'
      };
    }
  });

  // Memory profile handlers
  ipcMain.handle('memory-profile:list', async () => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const memoryProfilesPath = path.join(projectRoot, 'public', 'memoryProfiles');
      
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('log:devtools', `Looking for memory profiles in: ${memoryProfilesPath}`);
      }
      
      if (!fs.existsSync(memoryProfilesPath)) {
        if (mainWindow) {
          mainWindow.webContents.send('log:devtools', `Memory profiles directory not found: ${memoryProfilesPath}`);
        }
        return { success: false, error: "Memory profiles directory not found", profiles: [] };
      }
      
      try {
        const files = fs.readdirSync(memoryProfilesPath);
        // Filter for .json files and exclude the old index file
        const profiles = files.filter(file => 
          file.endsWith('.json') && 
          file !== 'memoryProfiles.json'
        );
        
        if (mainWindow) {
          mainWindow.webContents.send('log:devtools', `Found ${profiles.length} profile files via directory scan`);
        }
        
        return { success: true, profiles };
      } catch (error) {
        if (mainWindow) {
          mainWindow.webContents.send('log:devtools', `Error reading directory ${memoryProfilesPath}: ${error.message}`);
        }
        return { success: false, error: `Error reading profiles directory: ${error.message}`, profiles: [] };
      }
    } catch (error) {
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('log:devtools', `Error listing memory profiles: ${error.message}`);
      }
      return { success: false, error: error.message, profiles: [] };
    }
  });

  ipcMain.handle('memory-profile:get', async (_, fileName) => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const profilePath = path.join(projectRoot, 'public', 'memoryProfiles', fileName);
      
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('log:devtools', `Looking for memory profile at: ${profilePath}`);
      }
      
      if (!fs.existsSync(profilePath)) {
        return { success: false, error: `Profile file not found: ${fileName}` };
      }
      
      const profileJson = fs.readFileSync(profilePath, 'utf8');
      try {
        const profileData = JSON.parse(profileJson);
        
        // Strictly enforce process field over moduleName at root level
        let processName = "";
        if (profileData.process && typeof profileData.process === 'string') {
          processName = profileData.process;
        } else if (profileData.moduleName && typeof profileData.moduleName === 'string') {
          // Only use moduleName as fallback if it exists and process doesn't
          processName = profileData.moduleName;
          
          // Log a warning about the deprecated format
          if (mainWindow) {
            mainWindow.webContents.send('log:devtools', 
              `Warning: Profile ${fileName} uses deprecated root-level 'moduleName' field instead of 'process'.`);
          }
        }
        
        const profile = {
          id: fileName,
          fileName,
          process: processName, // Use the extracted process name, NOT moduleName
          pollInterval: profileData.pollInterval || 16,
          outputs: profileData.outputs || [],
          lastModified: fs.statSync(profilePath).mtime.getTime(),
          outputCount: profileData.outputs?.length || 0
        };
        
        return { success: true, profile };
      } catch (error) {
        return { success: false, error: `Error parsing profile ${fileName}: ${error.message}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handle poll interval updates from renderer
  ipcMain.on('update:poll-interval', (_, interval) => {
    const newInterval = parseInt(interval, 10);
    if (!isNaN(newInterval) && newInterval > 0) {
      const success = updatePollRate(newInterval);
      const mainWindow = getMainWindow();
      if (success && mainWindow) {
        mainWindow.webContents.send('poll:interval:updated', newInterval);
        
        // Also update the current game profile if one is active
        const currentGameProfile = getCurrentGameProfile();
        if (currentGameProfile) {
          currentGameProfile.pollInterval = newInterval;
        }
      }
    }
  });

  // Add handler for saving memory profile
  ipcMain.handle('memory-profile:save', async (_, fileName, profileJson) => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const memoryProfilesPath = path.join(projectRoot, 'public', 'memoryProfiles');

      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('log:devtools', `App path: ${appPath}`);
        mainWindow.webContents.send('log:devtools', `Project root: ${projectRoot}`);
        mainWindow.webContents.send('log:devtools', `Target memoryProfiles dir: ${memoryProfilesPath}`);
        mainWindow.webContents.send('log:devtools', `Received profile data: ${JSON.stringify(profileJson, null, 2)}`);
      }
      
      if (!fs.existsSync(memoryProfilesPath)) {
        if (mainWindow) {
          mainWindow.webContents.send('log:devtools', `Memory Profiles directory not found at: ${memoryProfilesPath}, attempting to create it...`);
        }
        fs.mkdirSync(memoryProfilesPath, { recursive: true });
      }
      
      // Ensure memoryProfileType is preserved and defaults to 'user' if not present
      const profileToSave = {
        ...profileJson,
        memoryProfileType: profileJson.memoryProfileType || 'user'
      };
      
      if (mainWindow) {
        mainWindow.webContents.send('log:devtools', `Profile to save: ${JSON.stringify(profileToSave, null, 2)}`);
      }
      
      const profilePath = path.join(memoryProfilesPath, fileName);
      
      fs.writeFileSync(profilePath, JSON.stringify(profileToSave, null, 2), 'utf8');
      
      if (mainWindow) {
        mainWindow.webContents.send('log:devtools', `Memory profile successfully saved to: ${profilePath}`);
        
        // Verify what was actually written to the file
        const savedContent = fs.readFileSync(profilePath, 'utf8');
        mainWindow.webContents.send('log:devtools', `Verified saved content: ${savedContent}`);
      }
      
      return { success: true, message: `Profile saved to ${fileName}` };
    } catch (error) {
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('log:devtools', `Error saving memory profile: ${error.message}`);
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('memory-profile:delete', async (_, fileName) => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const memoryProfilesDir = path.join(projectRoot, 'public', 'memoryProfiles');
      const filePath = path.join(memoryProfilesDir, fileName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Add handler for disabling caching with high performance mode toggle
  ipcMain.handle('set-disable-caching', (_, disable) => {
    try {
      if (typeof disable !== 'boolean') {
        return { success: false, error: 'Invalid parameter: disable must be a boolean' };
      }
      
      // Enable high performance mode when cache is disabled for maximum speed
      setHighPerformanceMode(disable);
      
      // Add debug log for performance mode changes
      const { logEvent } = require('../loggerBridge');
      logEvent('debug', `Performance mode updated: caching ${disable ? 'disabled' : 'enabled'}, high performance mode: ${isHighPerformanceMode() ? 'ON' : 'OFF'}`);
      
      const mainWindow = getMainWindow();
      if (mainWindow && !isHighPerformanceMode()) {
        mainWindow.webContents.send('log:devtools', `Cache ${disable ? 'disabled' : 'enabled'}, high performance mode: ${isHighPerformanceMode() ? 'ON' : 'OFF'}`);
      }
      
      return { success: true, message: `Caching ${disable ? 'disabled' : 'enabled'}, high performance mode: ${isHighPerformanceMode() ? 'ON' : 'OFF'}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Add handler for getting performance metrics
  ipcMain.handle('get-performance-metrics', () => {
    try {
      return { 
        success: true, 
        metrics: getPerformanceMetrics() 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        metrics: {
          lastPollDuration: 0,
          avgPollDuration: 0,
          pollsPerSecond: 0,
          skippedPolls: 0
        }
      };
    }
  });

  // Add handler for batch memory reading with support for disabling caching and high performance mode
  ipcMain.handle('read-memory-batch', async (event, processName, addresses) => {
    try {
      // Check if disableCaching flag is set in any address
      const disableCaching = addresses.some(addr => addr.disableCaching === true);
      
      // Safe logging with error handling - skip in high performance mode
      if (!isHighPerformanceMode()) {
        try {
          const { logToFile } = require('../logger');
          if (disableCaching) {
            logToFile('Batch read with caching disabled');
          }
        } catch (logError) {
          // Don't let logging errors affect memory reading
          const mainWindow = getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send('log:devtools', `Warning: Logging error: ${logError.message}`);
          }
        }
      }
      
      return await readMemoryBatch(processName, addresses);
    } catch (error) {
      return addresses.map(addr => ({
        id: addr.id,
        success: false,
        value: null,
        error: error.message || 'Unknown error in batch memory read'
      }));
    }
  });

  // Update memory polling IPC handlers to store current profile
  ipcMain.on('start-memory-read', (_, gameProfile) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      return;
    }
    
    // Store the complete profile with all output mappings
    setCurrentGameProfile(gameProfile);
    
    // Add debug log for memory polling start
    const { logEvent } = require('../loggerBridge');
    logEvent('debug', `Memory polling started for profile: ${gameProfile?.profileName || 'Unknown'} with ${gameProfile?.outputs?.length || 0} outputs, poll interval: ${gameProfile?.pollInterval || 16}ms`);
    
    startPollingMemory(mainWindow, gameProfile);
  });

  ipcMain.on('stop-memory-read', () => {
    const { logEvent } = require('../loggerBridge');
    const currentGameProfile = getCurrentGameProfile();
    logEvent('debug', `Memory polling stopped${currentGameProfile ? ` for profile: ${currentGameProfile.profileName || 'Unknown'}` : ''}`);
    
    setCurrentGameProfile(null);
    stopPollingMemory();
  });

  // Memory update handler to process data through outputDispatcher
  ipcMain.on('memory:update', (_, data) => {
    const currentGameProfile = getCurrentGameProfile();
    if (!currentGameProfile) return;

    // Handle the memory update by forwarding it to outputDispatcher
    const { handleUpdate } = require('../outputDispatcher');
    handleUpdate(currentGameProfile, data);
    
    // Forward the data to the renderer
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('memory:values', data);
    }
  });
}

module.exports = { registerMemoryHandlers };
