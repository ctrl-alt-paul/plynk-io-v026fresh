
const { registerDeviceHandlers } = require('./deviceHandlers');
const { registerWLEDHandlers } = require('./wledHandlers');
const { registerGameProfileHandlers } = require('./gameProfileHandlers');
const { registerMessageProfileHandlers } = require('./messageProfileHandlers');
const { registerDefaultProfileHandlers } = require('./defaultProfileHandlers');
const { registerTestDispatchHandlers } = require('./testDispatchHandler');
const { registerOutputOptimizationHandlers } = require('./outputOptimizationHandlers');
const { registerMemoryHandlers } = require('./memoryHandlers');
const { registerSettingsHandlers } = require('./settingsHandlers');
const { registerUtilityHandlers } = require('./utilityHandlers');
const { registerGitHubHandlers } = require('./githubHandlers');
const { setWledHandlersRegistered, isWledHandlersRegistered } = require('../state/globals');
const { logToFile } = require('../logger');

function registerAllIpcHandlers(app) {
  const { logEvent } = require('../loggerBridge');
  const { ipcMain } = require('electron');
  
  // Register device handlers
  registerDeviceHandlers();
  logEvent('debug', 'Device handlers registered successfully');
  
  // Register WLED handlers with guard to prevent duplicate registration
  if (!isWledHandlersRegistered()) {
    registerWLEDHandlers();
    setWledHandlersRegistered(true);
    logToFile('WLED handlers registered successfully');
    logEvent('debug', 'WLED handlers registered and marked as active');
  }
  
  // Register game profile handlers
  registerGameProfileHandlers(app);
  logToFile('Game profile handlers registered successfully');
  logEvent('debug', 'Game profile handlers registered successfully');
  
  // Register message profile handlers
  registerMessageProfileHandlers(app);
  logToFile('Message profile handlers registered successfully');
  logEvent('debug', 'Message profile handlers registered successfully');
  
  // Register default profile handlers
  registerDefaultProfileHandlers(app);
  logToFile('Default profile handlers registered successfully');
  logEvent('debug', 'Default profile handlers registered successfully');
  
  // Register test dispatch handlers
  registerTestDispatchHandlers();
  logToFile('Test dispatch handlers registered successfully');
  logEvent('debug', 'Test dispatch handlers registered successfully');
  
  // Register output optimization handlers
  registerOutputOptimizationHandlers(app);
  logToFile('Output optimization handlers registered successfully');
  logEvent('debug', 'Output optimization handlers registered successfully');
  
  // Register memory handlers
  registerMemoryHandlers(app);
  logEvent('debug', 'Memory handlers registered successfully');
  
  // Register settings handlers
  registerSettingsHandlers(app);
  logEvent('debug', 'Settings handlers registered successfully');
  
  // Register utility handlers
  registerUtilityHandlers();
  logEvent('debug', 'Utility handlers registered successfully');
  
  // Register GitHub handlers
  registerGitHubHandlers(ipcMain);
  logEvent('debug', 'GitHub handlers registered successfully');
}

module.exports = { registerAllIpcHandlers };
