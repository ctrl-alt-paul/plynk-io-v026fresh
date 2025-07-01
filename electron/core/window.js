const { BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const { getMainWindow, setMainWindow, getTray, setTray, getHasShownTrayNotification, setHasShownTrayNotification, getIsQuitting } = require('../state/globals');

function createTray() {
  // Create a tray icon
  const iconPath = path.join(__dirname, '..', '..', 'icon.png');
  const tray = new Tray(iconPath);
  setTray(tray);
  
  // Create context menu for tray
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Hide App',
      click: () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        const { setIsQuitting } = require('../state/globals');
        const { app } = require('electron');
        setIsQuitting(true);
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  // Set the tray context menu
  tray.setContextMenu(contextMenu);
  
  // Set tooltip
  tray.setToolTip('PLYNK-IO');
  
  // Handle tray click to show/hide window
  tray.on('click', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// Function to update tray icon
function updateTrayIcon(iconFileName) {
  const tray = getTray();
  if (tray) {
    const iconPath = path.join(__dirname, '..', '..', iconFileName);
    try {
      tray.setImage(iconPath);
    } catch (error) {
      console.error('Failed to update tray icon:', error);
    }
  }
}

function createWindow() {
  // Add debug log for window creation
  const { logEvent } = require('../loggerBridge');
  logEvent('debug', 'Creating main application window');
  
  // Load startup settings
  const { getStartupConfig } = require('../settingsManager');
  const { app } = require('electron');
  const startupConfig = getStartupConfig(app.getAppPath());
  
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 1400,
    show: !startupConfig.startMinimized, // Don't show immediately if starting minimized
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: false,
      preload: path.join(__dirname, '..', 'preload.js'),
      // Add Content Security Policy
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  
  // CRITICAL FIX: Set the global reference immediately after window creation
  setMainWindow(mainWindow);

  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:8080';
  
  logEvent('debug', `Loading application from: ${startUrl}`);
  
  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' https://cdn.gpteng.co 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "font-src 'self'; " +
          "img-src 'self' data:; " +
          "connect-src 'self' ws: wss:; " +
          "media-src 'self';"
        ]
      }
    });
  });
  
  mainWindow.loadURL(startUrl);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    logEvent('debug', 'Development mode: DevTools opened');
  }

  // Show window after loading if not starting minimized
  mainWindow.webContents.once('ready-to-show', () => {
    if (!startupConfig.startMinimized) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      logEvent('debug', 'Window created minimized to tray');
    }
  });

  // Handle minimize event - hide to tray instead of minimizing
  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
    
    // Show notification on first minimize (optional)
    if (!getHasShownTrayNotification()) {
      const tray = getTray();
      if (tray) {
        tray.displayBalloon({
          iconType: 'info',
          title: 'PLYNK-IO',
          content: 'Application was minimized to tray'
        });
      }
      setHasShownTrayNotification(true);
    }
  });

  // Handle close event - hide to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!getIsQuitting()) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    logEvent('debug', 'Main window closed - shutting down services');
    const { stopPollingMemory } = require('../memoryPollingService');
    const { stopProcessMonitor } = require('../processMonitor');
    
    stopPollingMemory(); // Stop polling when window closes
    stopProcessMonitor(); // Stop process monitor when window closes
    setMainWindow(null);
  });

  // Add IPC handler for tray icon switching
  ipcMain.handle('tray:set-icon', async (event, iconPath) => {
    try {
      // Remove leading slash if present and use the filename
      const iconFileName = iconPath.startsWith('/') ? iconPath.substring(1) : iconPath;
      updateTrayIcon(iconFileName);
      return { success: true };
    } catch (error) {
      console.error('Error setting tray icon:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  createWindow,
  createTray,
  updateTrayIcon
};
