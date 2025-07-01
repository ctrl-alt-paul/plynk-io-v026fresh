
const fs = require('fs');
const path = require('path');
const { logToFile, logToDevTools } = require('./logger');

// Default settings
const DEFAULT_SETTINGS = {
  processMonitor: {
    isRunning: false,
    scanInterval: 3000,
    userPreference: false
  },
  messageListener: {
    isEnabled: false,
    userPreference: false,
    timeout: 120, // Changed from 30 to 120 seconds (2 minutes)
    timeoutEnabled: true // Default timeout feature enabled
  },
  outputOptimization: {
    sendOnlyChangedValues: true,
    forceUpdateInterval: 200
  },
  startup: {
    startMinimized: false,
    startWithWindows: false
  },
  logPage: {
    autoScroll: true,
    consolidateView: true,
    enableVirtualization: true,
    categories: {
      warning: false,
      startup: false,
      process: false,
      memory: false,
      device: false,
      dispatch: false,
      testing: false,
      output: false,
      wled: false,
      "wled-scripts": false,
      debug: false,
      "message-scan": false,
      "message-listen": false
    }
  },
  logConfig: {
    maxLogEntries: 2000
  },
  masterLogging: {
    enabled: false
  }
};

/**
 * Get the settings file path
 */
function getSettingsPath(appPath) {
  const projectRoot = path.dirname(appPath);
  return path.join(projectRoot, 'public', 'settings.json');
}

/**
 * Load settings from file, create with defaults if doesn't exist
 */
function loadSettings(appPath) {
  try {
    const settingsPath = getSettingsPath(appPath);
    
    if (!fs.existsSync(settingsPath)) {
      // Create settings file with defaults
      const publicDir = path.dirname(settingsPath);
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      
      fs.writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
      return DEFAULT_SETTINGS;
    }
    
    const settingsContent = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(settingsContent);
    
    // Merge with defaults to ensure all properties exist
    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      processMonitor: {
        ...DEFAULT_SETTINGS.processMonitor,
        ...(settings.processMonitor || {})
      },
      outputOptimization: {
        ...DEFAULT_SETTINGS.outputOptimization,
        ...(settings.outputOptimization || {})
      },
      logPage: {
        ...DEFAULT_SETTINGS.logPage,
        ...(settings.logPage || {}),
        categories: {
          ...DEFAULT_SETTINGS.logPage.categories,
          ...(settings.logPage?.categories || {})
        }
      },
      logConfig: {
        ...DEFAULT_SETTINGS.logConfig,
        ...(settings.logConfig || {})
      }
    };
    
    return mergedSettings;
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to file
 */
function saveSettings(appPath, settings) {
  try {
    const settingsPath = getSettingsPath(appPath);
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get log configuration
 */
function getLogConfig(appPath) {
  const settings = loadSettings(appPath);
  return settings.logConfig;
}

/**
 * Update log configuration
 */
function updateLogConfig(appPath, config) {
  try {
    const settings = loadSettings(appPath);
    settings.logConfig = {
      ...settings.logConfig,
      ...config
    };
    return saveSettings(appPath, settings);
  } catch (error) {
    return false;
  }
}

/**
 * Get process monitor configuration
 */
function getProcessMonitorConfig(appPath) {
  const settings = loadSettings(appPath);
  return settings.processMonitor;
}

/**
 * Update process monitor configuration
 */
function updateProcessMonitorConfig(appPath, config) {
  try {
    const settings = loadSettings(appPath);
    settings.processMonitor = {
      ...settings.processMonitor,
      ...config
    };
    return saveSettings(appPath, settings);
  } catch (error) {
    return false;
  }
}

/**
 * Update user preference for process monitor
 */
function updateProcessMonitorUserPreference(appPath, userPreference) {
  try {
    const settings = loadSettings(appPath);
    settings.processMonitor.userPreference = userPreference;
    const success = saveSettings(appPath, settings);
    
    return success;
  } catch (error) {
    return false;
  }
}

/**
 * Get log page configuration
 */
function getLogPageConfig(appPath) {
  const settings = loadSettings(appPath);
  return settings.logPage;
}

/**
 * Update log page configuration
 */
function updateLogPageConfig(appPath, config) {
  try {
    const settings = loadSettings(appPath);
    settings.logPage = {
      ...settings.logPage,
      ...config,
      categories: {
        ...settings.logPage.categories,
        ...(config.categories || {})
      }
    };
    return saveSettings(appPath, settings);
  } catch (error) {
    return false;
  }
}

/**
 * Get message listener configuration
 */
function getMessageListenerConfig(appPath) {
  const settings = loadSettings(appPath);
  return {
    ...DEFAULT_SETTINGS.messageListener,
    ...(settings.messageListener || {})
  };
}

/**
 * Update message listener configuration
 */
function updateMessageListenerConfig(appPath, config) {
  try {
    const settings = loadSettings(appPath);
    settings.messageListener = {
      ...settings.messageListener,
      ...config
    };
    return saveSettings(appPath, settings);
  } catch (error) {
    return false;
  }
}

/**
 * Get master logging configuration
 */
function getMasterLoggingConfig(appPath) {
  const settings = loadSettings(appPath);
  return settings.masterLogging;
}

/**
 * Update master logging configuration
 */
function updateMasterLoggingConfig(appPath, config) {
  try {
    const settings = loadSettings(appPath);
    settings.masterLogging = {
      ...settings.masterLogging,
      ...config
    };
    return saveSettings(appPath, settings);
  } catch (error) {
    return false;
  }
}

/**
 * Get output optimization configuration
 */
function getOutputOptimizationConfig(appPath) {
  const settings = loadSettings(appPath);
  return settings.outputOptimization || DEFAULT_SETTINGS.outputOptimization;
}

/**
 * Update output optimization configuration
 */
function updateOutputOptimizationConfig(appPath, config) {
  try {
    const settings = loadSettings(appPath);
    settings.outputOptimization = {
      ...settings.outputOptimization,
      ...config
    };
    return saveSettings(appPath, settings);
  } catch (error) {
    return false;
  }
}

/**
 * Get startup configuration
 */
function getStartupConfig(appPath) {
  const settings = loadSettings(appPath);
  return settings.startup || DEFAULT_SETTINGS.startup;
}

/**
 * Update startup configuration
 */
function updateStartupConfig(appPath, config) {
  try {
    const settings = loadSettings(appPath);
    settings.startup = {
      ...settings.startup,
      ...config
    };
    return saveSettings(appPath, settings);
  } catch (error) {
    return false;
  }
}

module.exports = {
  loadSettings,
  saveSettings,
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
  getOutputOptimizationConfig,
  updateOutputOptimizationConfig,
  getStartupConfig,
  updateStartupConfig,
  DEFAULT_SETTINGS
};
