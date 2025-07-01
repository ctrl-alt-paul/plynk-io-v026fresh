const { getProcesses } = require('memoryjs');
const path = require('path');
const fs = require('fs');
const { logEvent } = require('./loggerBridge');
const { startPollingMemory, stopPollingMemory } = require('./memoryPollingService');
const { getProcessMonitorConfig, updateProcessMonitorConfig } = require('./settingsManager');
const { shutdownAllDevices } = require('./gameProfileDispatcher');

// Monitor configuration - will be loaded from settings
let SCAN_INTERVAL_MS = 3000;
let intervalId = null;
let isRunning = false;
let mainWindowRef = null;
let activeProcessId = null;
let activeGameProfile = null;
let lastProfileUpdate = 0;
let nextScanTime = 0;
let gameProfiles = [];
let appPathRef = null;

/**
 * Extract the actual value from a memory result object
 * This helps normalize data between process monitor and memory manager
 */
function extractMemoryValue(resultObj) {
  // If it's already a primitive value, return it
  if (resultObj === null || 
      resultObj === undefined || 
      typeof resultObj !== 'object' ||
      resultObj instanceof Date) {
    return resultObj;
  }
  
  // If it's an object with a value property, extract it
  if ('value' in resultObj) {
    return resultObj.value;
  }
  
  // Otherwise return the original object
  return resultObj;
}

/**
 * Load all game profiles from the gameProfiles directory
 */
async function loadAllGameProfiles(appPath) {
  try {
    const projectRoot = path.dirname(appPath);
    const profilesPath = path.join(projectRoot, 'public', 'gameProfiles');
    
    if (!fs.existsSync(profilesPath)) {
      logEvent('process', `Game profiles directory not found: ${profilesPath}`);
      return [];
    }
    
    // First check if there's an index file
    const indexFile = path.join(profilesPath, 'gameProfiles.json');
    let profileFileNames = [];
    
    if (fs.existsSync(indexFile)) {
      try {
        profileFileNames = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      } catch (error) {
        logEvent('warning', `Error parsing game profiles index: ${error.message}`);
      }
    }
    
    // If no profiles found in index, list all JSON files
    if (!profileFileNames || profileFileNames.length === 0) {
      const files = fs.readdirSync(profilesPath);
      profileFileNames = files.filter(file => file.endsWith('.json') && file !== 'gameProfiles.json');
    }
    
    // Load each game profile
    const profiles = [];
    for (const fileName of profileFileNames) {
      try {
        const filePath = path.join(profilesPath, fileName);
        if (!fs.existsSync(filePath)) continue;
        
        const profileContent = fs.readFileSync(filePath, 'utf8');
        const profile = JSON.parse(profileContent);
        
        // Add the filename for reference
        profile.fileName = fileName;
        profiles.push(profile);
      } catch (error) {
        logEvent('warning', `Error loading game profile ${fileName}: ${error.message}`);
      }
    }
    
    return profiles;
  } catch (error) {
    logEvent('warning', `Error loading game profiles: ${error.message}`);
    return [];
  }
}

/**
 * Load the memory profile associated with a game profile
 */
async function loadMemoryProfile(appPath, fileName) {
  if (!fileName) return null;
  
  try {
    const projectRoot = path.dirname(appPath);
    const profilePath = path.join(projectRoot, 'public', 'memoryProfiles', fileName);
    
    if (!fs.existsSync(profilePath)) {
      logEvent('process', `Memory profile not found: ${profilePath}`);
      return null;
    }
    
    const profileContent = fs.readFileSync(profilePath, 'utf8');
    const memoryProfile = JSON.parse(profileContent);
    
    return memoryProfile;
  } catch (error) {
    logEvent('warning', `Error loading memory profile ${fileName}: ${error.message}`);
    return null;
  }
}

/**
 * Merge memory profile data into game profile
 */
function mergeProfiles(gameProfile, memoryProfile) {
  if (!gameProfile || !memoryProfile) return gameProfile;
  
  // Create a merged profile with memory profile data
  const mergedProfile = {
    ...gameProfile,
    outputs: gameProfile.outputs.map(output => {
      // Find matching memory profile output
      const memoryOutput = memoryProfile.outputs?.find(mo => mo.label === output.label);
      if (memoryOutput) {
        // Merge memory profile output properties into game profile output
        return {
          ...output,
          address: memoryOutput.address || output.address,
          type: memoryOutput.type || output.type,
          useModuleOffset: memoryOutput.useModuleOffset || output.useModuleOffset,
          moduleName: memoryOutput.moduleName || output.moduleName || memoryProfile.process,
          offset: memoryOutput.offset || output.offset,
          offsets: memoryOutput.offsets || output.offsets || [],
          bitmask: memoryOutput.bitmask || output.bitmask,
          bitwiseOp: memoryOutput.bitwiseOp || output.bitwiseOp,
          bitfield: memoryOutput.bitfield || output.bitfield,
          isPointerChain: memoryOutput.isPointerChain || output.isPointerChain
        };
      }
      return output;
    }),
    // Ensure we have process name for polling
    processName: gameProfile.processName || memoryProfile.process
  };

  return mergedProfile;
}

/**
 * Check if a profile is already active for polling
 */
function isProfileActive(profile) {
  return (
    activeGameProfile &&
    activeGameProfile.id === profile.id &&
    activeProcessId !== null
  );
}

/**
 * Scan for processes and match against game profiles
 */
async function scanProcesses(appPath) {
  try {
    // Get current time for diagnostic purposes
    const now = Date.now();
    nextScanTime = now + SCAN_INTERVAL_MS;
    
    // Collect scan cycle information for consolidated logging
    const scanInfo = [];
    scanInfo.push(`\n*** PROCESS SCAN CYCLE ***`);
    scanInfo.push(`Scan started at: ${new Date(now).toISOString()}`);
    scanInfo.push(`Next scan in: ${SCAN_INTERVAL_MS}ms`);
    
    // Get all running processes
    const processes = getProcesses();
    
    if (!processes || processes.length === 0) {
      scanInfo.push(`No processes found during scan`);
      logEvent('process', scanInfo.join('\n'));
      return;
    }
    
    scanInfo.push(`Total running processes: ${processes.length}`);
    
    // Check if our currently monitored process is still running
    if (activeProcessId) {
      const processStillRunning = processes.some(
        p => p.th32ProcessID === activeProcessId
      );
      
      if (!processStillRunning) {
        scanInfo.push(`Active process ${activeProcessId} is no longer running - stopping polling`);
        
        // CRITICAL: Shut down all devices before stopping polling
        if (activeGameProfile) {
          scanInfo.push(`Shutting down devices for dropped process: ${activeGameProfile.profileName}`);
          await shutdownAllDevices(activeGameProfile);
        }
        
        stopPollingMemory();
        activeProcessId = null;
        activeGameProfile = null;
        
        logEvent('process', scanInfo.join('\n'));
        return;
      }
      
      scanInfo.push(`Active process ${activeProcessId} (${activeGameProfile?.profileName}) still running - continuing polling`);
      logEvent('process', scanInfo.join('\n'));
      return;
    }
    
    // If we haven't loaded game profiles yet, or it's been a while, reload them
    if (!gameProfiles.length || now - lastProfileUpdate > 10000) {
      gameProfiles = await loadAllGameProfiles(appPath);
      lastProfileUpdate = now;
      scanInfo.push(`Game profiles reloaded: ${gameProfiles.length} profiles available`);
    }
    
    // Exit early if no profiles loaded
    if (!gameProfiles.length) {
      scanInfo.push(`No game profiles available for matching`);
      logEvent('process', scanInfo.join('\n'));
      return;
    }
    
    // Filter to only active profiles once per scan
    const activeProfiles = gameProfiles.filter(profile => {
      // Skip if no process name defined
      if (!profile.processName) return false;
      
      // Skip if profile is marked as inactive
      if (profile.isActive === false) {
        return false;
      }
      
      return true;
    });
    
    // Log scan cycle info
    const inactiveCount = gameProfiles.length - activeProfiles.length;
    scanInfo.push(`Active profiles for matching: ${activeProfiles.length}`);
    if (inactiveCount > 0) {
      scanInfo.push(`Inactive profiles skipped: ${inactiveCount}`);
    }
    
    // Check each active profile against running processes
    for (const profile of activeProfiles) {
      // Skip if this profile is already active
      if (isProfileActive(profile)) {
        continue;
      }
      
      const profileProcessName = profile.processName.toLowerCase();
      
      // Check each running process for a match
      for (const process of processes) {
        const exeName = process.szExeFile.toLowerCase();
        
        // Check if process name matches
        if (exeName === profileProcessName || 
            exeName === `${profileProcessName}.exe`) {
          
          scanInfo.push(`MATCH FOUND: ${process.szExeFile} matches profile ${profile.profileName}`);
          
          // Load the memory profile
          const memoryProfile = await loadMemoryProfile(appPath, profile.memoryFile);
          
          if (!memoryProfile) {
            scanInfo.push(`Failed to load memory profile ${profile.memoryFile} for ${profile.profileName}`);
            continue;
          }
          
          // Merge memory profile data into game profile
          const mergedProfile = mergeProfiles(profile, memoryProfile);
          
          // PERFORMANCE FIX: Enable fast mode for all outputs to force worker usage
          if (mergedProfile.outputs) {
            mergedProfile.outputs = mergedProfile.outputs.map(output => ({
              ...output,
              fastModeEnabled: true  // Force worker-based reading for Dashboard
            }));
          }
          
          // Define a custom data processor to extract values before dispatch
          const valueExtractor = (memoryData) => {
            // Create new object with extracted values
            const extractedData = {};
            
            // For each memory value, extract just the actual value
            Object.entries(memoryData).forEach(([key, resultObj]) => {
              extractedData[key] = extractMemoryValue(resultObj);
            });
            
            return extractedData;
          };
          
          // Stop any existing polling
          stopPollingMemory();
          
          // Start polling with merged profile and value extractor
          if (mainWindowRef) {
            scanInfo.push(`Starting high-performance polling for ${profile.profileName} (PID: ${process.th32ProcessID})`);
            scanInfo.push(`Memory profile: ${profile.memoryFile} with ${mergedProfile.outputs?.length || 0} outputs`);
            
            startPollingMemory(mainWindowRef, mergedProfile, valueExtractor);
            
            // Store the active process and profile
            activeProcessId = process.th32ProcessID;
            activeGameProfile = mergedProfile;
            
            // Log successful activation
            logEvent('process', scanInfo.join('\n'));
            
            // We've found and started a profile, no need to check other processes or profiles
            return;
          }
        }
      }
    }
    
    // If we get here, no matches were found
    scanInfo.push(`No matching processes found for any active profiles`);
    logEvent('process', scanInfo.join('\n'));
    
  } catch (error) {
    logEvent('warning', `Error scanning processes: ${error.message}`);
  }
}

/**
 * Run diagnostics to check the state of the process monitor
 */
function runDiagnostics(appPath) {
  try {
    const pollingStatus = activeProcessId ? "ACTIVE" : "INACTIVE";
    const profileCount = gameProfiles.length;
    const nextScanDue = nextScanTime - Date.now();
    
    const diagnosticInfo = {
      isRunning,
      pollingStatus,
      profilesLoaded: profileCount,
      activeProfile: activeGameProfile?.profileName || "None",
      activePID: activeProcessId || "None",
      nextScanInMs: nextScanDue > 0 ? nextScanDue : 0
    };
    
    logEvent('process', `Process Monitor Diagnostics: ${JSON.stringify(diagnosticInfo, null, 2)}`);
    
    return diagnosticInfo;
  } catch (error) {
    logEvent('warning', `Error running diagnostics: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * Initialize process monitor with settings
 */
function initializeProcessMonitor(appPath) {
  try {
    appPathRef = appPath;
    const config = getProcessMonitorConfig(appPath);
    
    SCAN_INTERVAL_MS = config.scanInterval;
    
    logEvent('process', `Process monitor initialized - UserPreference: ${config.userPreference}, ScanInterval: ${config.scanInterval}ms`);
    
    // Return userPreference instead of isRunning for startup decision
    return {
      isRunning: config.userPreference || false,  // Use userPreference for startup
      scanInterval: config.scanInterval
    };
  } catch (error) {
    logEvent('warning', `Error initializing process monitor: ${error.message}`);
    return { isRunning: false, scanInterval: 3000 };
  }
}

/**
 * Set the scan interval dynamically
 */
function setScanInterval(newInterval) {
  try {
    if (newInterval < 500 || newInterval > 30000) {
      logEvent('warning', `Invalid scan interval: ${newInterval}ms. Must be between 500ms and 30000ms`);
      return false;
    }
    
    const oldInterval = SCAN_INTERVAL_MS;
    SCAN_INTERVAL_MS = newInterval;
    
    // Save to settings
    if (appPathRef) {
      updateProcessMonitorConfig(appPathRef, { scanInterval: newInterval });
    }
    
    // If the monitor is running, restart it with the new interval
    if (isRunning && intervalId) {
      clearInterval(intervalId);
      intervalId = setInterval(() => {
        scanProcesses(appPathRef);
      }, SCAN_INTERVAL_MS);
      
      logEvent('process', `Scan interval updated from ${oldInterval}ms to ${SCAN_INTERVAL_MS}ms`);
    }
    
    return true;
  } catch (error) {
    logEvent('warning', `Error setting scan interval: ${error.message}`);
    return false;
  }
}

/**
 * Get the current scan interval
 */
function getScanInterval() {
  return SCAN_INTERVAL_MS;
}

/**
 * Start the process monitor
 */
function startProcessMonitor(mainWindow, app) {
  // Don't start if already running
  if (isRunning) {
    logEvent('process', 'Process monitor start requested but already running');
    return false;
  }
  
  try {
    mainWindowRef = mainWindow;
    appPathRef = app.getAppPath();
    isRunning = true;
    
    logEvent('process', `\n*** PROCESS MONITOR STARTED ***\nScan interval: ${SCAN_INTERVAL_MS}ms\nInitial scan starting now`);
    
    // Run an initial scan
    scanProcesses(appPathRef);
    
    // Start regular scanning
    intervalId = setInterval(() => {
      scanProcesses(appPathRef);
    }, SCAN_INTERVAL_MS);
    
    // Run initial diagnostics
    runDiagnostics(appPathRef);
    
    return true;
  } catch (error) {
    logEvent('warning', `Error starting process monitor: ${error.message}`);
    isRunning = false;
    return false;
  }
}

/**
 * Stop the process monitor
 */
function stopProcessMonitor() {
  if (!isRunning) return false;
  
  try {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    
    // CRITICAL: Shut down all devices before stopping monitoring
    if (activeGameProfile) {
      logEvent('process', `\n*** PROCESS MONITOR STOPPED ***\nShutting down devices for: ${activeGameProfile.profileName}\nStopping memory polling`);
      // Note: This is async but we don't await to avoid blocking the stop operation
      shutdownAllDevices(activeGameProfile).catch(error => {
        logEvent('warning', `Error during shutdown in stopProcessMonitor: ${error.message || String(error)}`);
      });
    } else {
      logEvent('process', `\n*** PROCESS MONITOR STOPPED ***\nNo active profile to shut down`);
    }
    
    // Also stop any active memory polling
    stopPollingMemory();
    activeProcessId = null;
    activeGameProfile = null;
    isRunning = false;
    
    return true;
  } catch (error) {
    logEvent('warning', `Error stopping process monitor: ${error.message}`);
    return false;
  }
}

/**
 * Check if the process monitor is running
 */
function isMonitorRunning() {
  return isRunning;
}

/**
 * Set the active profile externally (for message-based detection)
 */
function setActiveProfile(profileName, profile) {
  try {
    // Stop any existing memory polling first
    stopPollingMemory();
    
    // Set the active profile and a dummy process ID (since message-based detection doesn't have a real PID)
    activeGameProfile = profile;
    activeProcessId = -1; // Use -1 to indicate message-based detection
    
    logEvent('process', `Active profile set externally via message detection: ${profileName}`);
    
    // PERFORMANCE FIX: Enable fast mode for all outputs to force worker usage
    if (activeGameProfile.outputs) {
      activeGameProfile.outputs = activeGameProfile.outputs.map(output => ({
        ...output,
        fastModeEnabled: true  // Force worker-based reading for Dashboard
      }));
    }
    
    // Define a custom data processor to extract values before dispatch
    const valueExtractor = (memoryData) => {
      // Create new object with extracted values
      const extractedData = {};
      
      // For each memory value, extract just the actual value
      Object.entries(memoryData).forEach(([key, resultObj]) => {
        extractedData[key] = extractMemoryValue(resultObj);
      });
      
      return extractedData;
    };
    
    // Start memory polling if we have a main window and memory profile
    if (mainWindowRef && activeGameProfile.memoryFile) {
      logEvent('process', `Starting memory polling for message-detected profile: ${profileName}`);
      startPollingMemory(mainWindowRef, activeGameProfile, valueExtractor);
    }
    
    return { profileName, hasMemoryProfile: !!activeGameProfile.memoryFile };
  } catch (error) {
    logEvent('warning', `Error setting active profile: ${error.message}`);
    throw error;
  }
}

// Export the new function
module.exports = {
  initializeProcessMonitor,
  startProcessMonitor,
  stopProcessMonitor,
  isMonitorRunning,
  runDiagnostics,
  setScanInterval,
  getScanInterval,
  setActiveProfile
};
