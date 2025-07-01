
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { initializeGlobalState, getMainWindow, setIsQuitting, getTray, isProcessMonitorStarted, setProcessMonitorStarted, isPacDriveInitialized, setPacDriveInitialized } = require('../state/globals');
const { createWindow, createTray } = require('./window');
const { registerAllIpcHandlers } = require('../ipc/index');
const { pacDriveController } = require('../devices/pacDriveController');
const { logToFile, logToDevTools } = require('../logger');
const { startDeviceStatusMonitoring, stopDeviceStatusMonitoring } = require('../services/deviceStatusService');
const { initializeProcessMonitor, startProcessMonitor, stopProcessMonitor } = require('../processMonitor');
const { stopPollingMemory } = require('../memoryPollingService');
const { logEvent } = require('../loggerBridge');

// Add global error handlers to catch unhandled promise rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  
  logEvent('warning', `Unhandled Promise Rejection: ${errorMessage}`);
  
  // Also log to console in development for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('Unhandled Promise Rejection:', reason);
  }
});

process.on('uncaughtException', (error) => {
  logEvent('warning', `Uncaught Exception: ${error.message}`);
  
  // Also log to console in development for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('Uncaught Exception:', error);
  }
  
  // Don't exit the process in production, just log the error
});

// Redirect console output to prevent CMD/Terminal output
if (process.env.NODE_ENV !== 'development') {
  const noop = () => {};
  //console.log = noop;
  //console.info = noop;
  //console.debug = noop;
  //console.warn = noop;
  //console.error = noop;
}

function initializeApp() {
  // Initialize global state
  initializeGlobalState();
  
  app.whenReady().then(async () => {
    const { initializeMessageOutputHandlers } = require('../ipc/messageOutputHandler');
    initializeMessageOutputHandlers();

    // Create tray first
    createTray();
    
    createWindow();
    
    // Import and test the logger bridge after window creation
    const { logEvent } = require('../loggerBridge');
    
    // Send a test log to verify the pipeline is working
    setTimeout(() => {
      logEvent('startup', 'Application initialized - logging system active');
      logEvent('debug', `Application startup complete - Platform: ${process.platform}, Architecture: ${process.arch}, Node version: ${process.version}`);
    }, 1000);
    
    // Register all IPC handlers
    registerAllIpcHandlers(app);

    // Initialize PacDrive when the app starts
    try {
      if (pacDriveController.isDllLoaded()) {
        const initialized = pacDriveController.initialize();
        setPacDriveInitialized(initialized);
        
        if (initialized) {
          logToFile('PacDrive initialized successfully');
          logEvent('debug', 'PacDrive initialization: SUCCESS - DLL loaded and initialized');
          const mainWindow = getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send('log:devtools', 'PacDrive initialized successfully');
          }
        } else {
          logToFile('PacDrive initialization failed');
          logEvent('debug', 'PacDrive initialization: FAILED - DLL loaded but initialization failed');
          const mainWindow = getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send('log:devtools', 'PacDrive initialization failed');
          }
        }
      } else {
        const error = pacDriveController.getDllError();
        logToFile(`PacDrive DLL not loaded: ${error}`);
        logEvent('debug', `PacDrive initialization: SKIPPED - DLL not loaded (${error})`);
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send('log:devtools', `PacDrive DLL not loaded: ${error}`);
        }
      }
    } catch (error) {
      logToFile(`Error initializing PacDrive: ${error.message}`);
      logEvent('debug', `PacDrive initialization: ERROR - ${error.message}`);
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('log:devtools', `Error initializing PacDrive: ${error.message}`);
      }
    }
    
    // Create WLED profiles directory if it doesn't exist
    try {
      const profilesDir = path.join(path.dirname(app.getAppPath()), 'public', 'wledProfiles');
      if (!fs.existsSync(profilesDir)) {
        fs.mkdirSync(profilesDir, { recursive: true });
        logToFile(`Created WLED profiles directory: ${profilesDir}`);
        logEvent('debug', `WLED profiles directory created: ${profilesDir}`);
      } else {
        logEvent('debug', `WLED profiles directory exists: ${profilesDir}`);
      }
    } catch (error) {
      logToFile(`Error ensuring WLED profiles directory exists: ${error.message}`);
      logEvent('debug', `WLED profiles directory setup failed: ${error.message}`);
    }
    
    // Create message profiles directory if it doesn't exist
    try {
      const messageProfilesDir = path.join(path.dirname(app.getAppPath()), 'public', 'messageProfiles');
      if (!fs.existsSync(messageProfilesDir)) {
        fs.mkdirSync(messageProfilesDir, { recursive: true });
        logEvent('debug', `Message profiles directory created: ${messageProfilesDir}`);
      } else {
        logEvent('debug', `Message profiles directory exists: ${messageProfilesDir}`);
      }
    } catch (error) {
      logEvent('debug', `Message profiles directory setup failed: ${error.message}`);
    }
    
    // Start device status monitoring service
    try {
      startDeviceStatusMonitoring(30000); // Monitor every 30 seconds
      logEvent('device', 'Device status monitoring service started with 30-second interval');
      logEvent('debug', 'Device status monitoring: SUCCESS - service started and will respect master logging toggle');
    } catch (error) {
      logToFile(`Error starting device status monitoring: ${error.message}`);
      logEvent('debug', `Device status monitoring: ERROR - ${error.message}`);
    }
    
    // Start the process monitor after a brief delay to allow other initializations
    setTimeout(() => {
      try {
        const mainWindow = getMainWindow();
        if (mainWindow) {
          // Initialize with saved settings
          const config = initializeProcessMonitor(app.getAppPath());
          
          logEvent('debug', `Process monitor configuration loaded: auto-start ${config.isRunning ? 'ENABLED' : 'DISABLED'}, scan interval: ${config.scanInterval}ms`);
          
          // Start based on user preference, not previous running state
          if (config.isRunning && !isProcessMonitorStarted()) {
            const started = startProcessMonitor(mainWindow, app);
            setProcessMonitorStarted(started);
            
            if (started) {
              logToFile('Process monitor started automatically from user preference');
              logEvent('debug', 'Process monitor auto-start: SUCCESS - started from user preference');
              mainWindow.webContents.send('log:devtools', 'Process monitor started automatically from user preference');
            } else {
              logToFile('Process monitor failed to start from user preference');
              logEvent('debug', 'Process monitor auto-start: FAILED - could not start from user preference');
              mainWindow.webContents.send('log:devtools', 'Process monitor failed to start from user preference');
            }
          } else {
            logToFile('Process monitor initialized but not started (user preference is OFF)');
            logEvent('debug', 'Process monitor auto-start: SKIPPED - user preference is disabled');
            mainWindow.webContents.send('log:devtools', 'Process monitor initialized but not started (user preference is OFF)');
          }
        }
      } catch (error) {
        logToFile(`Error initializing process monitor: ${error.message}`);
        logEvent('debug', `Process monitor initialization: ERROR - ${error.message}`);
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send('log:devtools', `Error initializing process monitor: ${error.message}`);
        }
      }
    }, 2000);
  });
  
  // Add shutdown handler for Arduino ports
  app.on('window-all-closed', () => {
    logEvent('debug', 'All windows closed - beginning application shutdown sequence');
    
    // Don't quit the app when all windows are closed if we're not explicitly quitting
    // This allows the app to continue running in the system tray
    if (!app.isQuitting) {
      return;
    }
    
    stopPollingMemory(); // Ensure polling stops when all windows close
    
    // Stop device status monitoring service
    try {
      stopDeviceStatusMonitoring();
      logEvent('device', 'Device status monitoring service stopped');
      logEvent('debug', 'Device status monitoring shutdown: SUCCESS');
    } catch (error) {
      logToFile(`Error stopping device status monitoring: ${error.message}`);
      logEvent('debug', `Device status monitoring shutdown: ERROR - ${error.message}`);
    }
    
    // Stop process monitor WITHOUT saving any state
    if (isProcessMonitorStarted()) {
      try {
        stopProcessMonitor(); // No longer needs parameter since we removed state saving
        logToFile('Process monitor stopped on window close (user preference preserved)');
        logEvent('debug', 'Process monitor shutdown: SUCCESS - user preferences preserved');
      } catch (error) {
        logToFile(`Error stopping process monitor: ${error.message}`);
        logEvent('debug', `Process monitor shutdown: ERROR - ${error.message}`);
      }
      setProcessMonitorStarted(false);
    }
    
    // Shutdown PacDrive when all windows close
    if (isPacDriveInitialized() && pacDriveController.isDllLoaded()) {
      try {
        pacDriveController.shutdown();
        logToFile('PacDrive shutdown successfully');
        logEvent('debug', 'PacDrive shutdown: SUCCESS');
      } catch (error) {
        logToFile(`Error shutting down PacDrive: ${error.message}`);
        logEvent('debug', `PacDrive shutdown: ERROR - ${error.message}`);
      }
    }
    
    // Close all Arduino serial ports
    try {
      if (typeof arduinoController !== 'undefined' && arduinoController.closeAllPorts) {
        arduinoController.closeAllPorts();
        logToFile('Arduino ports closed successfully');
        logEvent('debug', 'Arduino ports shutdown: SUCCESS');
      }
    } catch (error) {
      logToFile(`Error closing Arduino ports: ${error.message}`);
      logEvent('debug', `Arduino ports shutdown: ERROR - ${error.message}`);
    }
    
    logEvent('debug', 'Application shutdown sequence completed');
    
    if (process.platform !== 'darwin') app.quit();
  });

  // Handle second instance - show window if app is already running
  app.on('second-instance', () => {
    // If someone tries to run a second instance, focus our window instead
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  // Prevent multiple instances
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  }

  app.on('activate', () => {
    const mainWindow = getMainWindow();
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Clean up tray when app is quitting
  app.on('before-quit', () => {
    setIsQuitting(true);
    app.isQuitting = true;
    const tray = getTray();
    if (tray) {
      tray.destroy();
    }
  });
}

module.exports = { initializeApp };
