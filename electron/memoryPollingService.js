const fs = require('fs');
const path = require('path');
const { logToFile, logToFileAsync, isHighPerformanceMode, setHighPerformanceMode } = require('./logger');
const { handleUpdate } = require('./outputDispatcher');
const { readRealMemory, isProcessRunning } = require('./memoryReaderReal');
const BatchReader = require('./BatchMemoryReader');

/**
 * Memory Polling Service
 * 
 * This module provides memory polling functionality by:
 * 1. Managing poll intervals
 * 2. Caching module base addresses
 * 3. Processing memory data
 * 4. Providing robust error handling
 * 
 * It uses BatchMemoryReader for optimized memory reading
 */

// Performance metrics tracking
let lastPollDuration = 0;
let avgPollDuration = 0;
let pollsPerSecond = 0;
const pollDurations = [];
let pollCount = 0;
let pollCountStart = Date.now();

// Polling overlap prevention
let pollInProgress = false;
let skippedPolls = 0;

// Fast mode tracking
let fastModeEnabled = false;

/**
 * Read memory with direct access to real memory
 */
async function readMemory(address, type, processName, useModuleOffset = false) {
  return await readRealMemory(processName, address, type, useModuleOffset);
}

/**
 * Validate address configuration before sending to batch reader
 */
function validateAddressConfig(addr, processName) {
  // Validate module+offset addresses
  if (addr.useModuleOffset) {
    if (!addr.moduleName || typeof addr.moduleName !== 'string' || addr.moduleName.trim() === '') {
      // Fix the address by setting moduleName to processName
      addr.moduleName = processName;
      logToFileAsync(`Fixed missing moduleName for address: ${addr.id || addr.label || 'unknown'}`);
    }
    
    // UPDATED: Check both offset and address fields when useModuleOffset is true
    // Prioritize the offset field if available, otherwise check the address field
    if ((!addr.offset || typeof addr.offset !== 'string' || addr.offset.trim() === '') &&
        (!addr.address || typeof addr.address !== 'string' || addr.address.trim() === '')) {
      return {
        isValid: false,
        error: `Missing offset and address for module+offset memory read (id: ${addr.id || addr.label || 'unknown'})`
      };
    }
    
    // If offset is missing but address is available, use address as the offset
    if (!addr.offset || typeof addr.offset !== 'string' || addr.offset.trim() === '') {
      if (addr.address) {
        addr.offset = addr.address;
        logToFileAsync(`Used address as fallback for missing offset: ${addr.id || addr.label || 'unknown'}`);
      }
    }
  }
  // Validate direct addresses
  else if (!addr.address || typeof addr.address !== 'string' || addr.address.trim() === '') {
    return {
      isValid: false,
      error: `Missing address for direct memory read (id: ${addr.id || addr.label || 'unknown'})`
    };
  }
  
  return { isValid: true };
}

/**
 * Read a batch of memory addresses in optimized fashion
 */
async function readMemoryBatch(processName, addresses) {
  // NEW: Validate and fix addresses before passing to BatchReader
  const validatedAddresses = [];
  const invalidResults = [];
  
  for (const addr of addresses) {
    // Create a clean copy to avoid mutation
    const addressCopy = { ...addr };
    
    // Validate the address
    const validation = validateAddressConfig(addressCopy, processName);
    if (validation.isValid) {
      validatedAddresses.push(addressCopy);
    } else {
      invalidResults.push({
        id: addr.id,
        success: false,
        value: null,
        error: validation.error
      });
      
      // Log validation failures but not too frequently
      if (!isHighPerformanceMode()) {
        logToFileAsync(`Address validation failed: ${validation.error}`);
      }
    }
  }
  
  // Check for fast mode flag in any address
  const shouldUseFastMode = addresses.some(addr => addr.fastModeEnabled === true);
  if (shouldUseFastMode !== fastModeEnabled) {
    // Update fast mode state
    fastModeEnabled = shouldUseFastMode;
    // Enable high performance logging mode when in fast mode
    setHighPerformanceMode(fastModeEnabled);
    
    if (!isHighPerformanceMode()) {
      logToFileAsync(`Fast Mode ${fastModeEnabled ? 'enabled' : 'disabled'}`);
    }
  }
  
  // Use the optimized batch reader for valid addresses
  const batchResults = validatedAddresses.length > 0 
    ? await BatchReader.readMemoryBatch(processName, validatedAddresses)
    : [];
  
  // Combine results
  return [...batchResults, ...invalidResults];
}

// Clear the cache when a process is no longer running
async function clearCacheForNonRunningProcesses() {
  await BatchReader.clearAllCaches();
}

let pollingInterval = null;
let currentPollRate = 50;
let gameProfileInUse = null;
let mainWindowRef = null;
let memoryProfileInUse = null;
let processConnectionAttempted = false;

// Clear the cache periodically (every 5 minutes)
setInterval(clearCacheForNonRunningProcesses, 5 * 60 * 1000);

async function startPollingMemory(mainWindow, gameProfile) {
  try {
    // Stop any existing polling first
    stopPollingMemory();
    
    mainWindowRef = mainWindow;
    currentPollRate = gameProfile.pollInterval || 50;
    
    // Update the cache TTL based on poll rate
    BatchReader.setCacheTTL(currentPollRate);
    
    memoryProfileInUse = { outputs: gameProfile.outputs || [] };
    gameProfileInUse = {
      ...gameProfile,
      outputs: gameProfile.outputs || (memoryProfileInUse && memoryProfileInUse.outputs) || []
    };
    
    // Reset connection attempt flag for this session
    processConnectionAttempted = false;
    
    // Reset performance metrics
    lastPollDuration = 0;
    avgPollDuration = 0;
    pollDurations.length = 0;
    pollCount = 0;
    pollCountStart = Date.now();
    pollInProgress = false;
    skippedPolls = 0;
    fastModeEnabled = false;
    
    // Log performance mode being used
    const hasOutputs = gameProfileInUse?.outputs?.length > 0;
    const fastModeOutputs = gameProfileInUse?.outputs?.filter(o => o.fastModeEnabled).length || 0;
    
    if (!isHighPerformanceMode()) {
      logToFileAsync(`Memory polling started: ${hasOutputs ? gameProfileInUse.outputs.length : 0} outputs, ${fastModeOutputs} with fast mode enabled`);
    }

    pollingInterval = setInterval(async () => {
      // Skip if a poll is already in progress
      if (pollInProgress) {
        skippedPolls++;
        
        // Log skipped polls but not too frequently
        if (skippedPolls % 10 === 0 && !isHighPerformanceMode()) {
          logToFileAsync(`Skipped ${skippedPolls} poll cycles due to overlap`);
        }
        return;
      }
      
      pollInProgress = true;
      const pollStartTime = Date.now();
      
      // Check process connection only once per polling session
      if (!processConnectionAttempted) {
        processConnectionAttempted = true;
        const processName = gameProfileInUse?.processName || 'daytona.exe';
        
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('log:devtools', 
            `Trying to connect to ${processName}...`
          );
        }
        
        const isRunning = await isProcessRunning(processName);
        
        if (!isRunning) {
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('log:devtools', 
              `⚠️ Error: ${processName} not found. Cannot read memory, stopping polling.`
            );
          }
          stopPollingMemory();
          pollInProgress = false;
          return;
        } else {
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('log:devtools', 
              `✅ Connected to ${processName} - Using high-performance worker-based reading`
            );
          }
        }
      }
      
      const inputs = {};
      try {
        // Get all configured outputs
        const allOutputs = memoryProfileInUse.outputs || [];
        
        if (allOutputs.length === 0) {
          pollInProgress = false;
          return;
        }

        // Check if fast mode is enabled for performance logging
        const fastModeCount = allOutputs.filter(output => output.fastModeEnabled === true).length;
        if (!isHighPerformanceMode() && fastModeCount > 0) {
          logToFileAsync(`[PERFORMANCE] Processing ${allOutputs.length} outputs, ${fastModeCount} with fast mode enabled`);
        }
        
        // Prepare all memory address configurations
        const batchAddresses = allOutputs.map(output => {
          // Prepare memory address configuration based on output type
          let addressConfig = {};
          
          if (output.offsets && output.offsets.length > 0) {
            // This is a pointer chain
            addressConfig = {
              id: output.label,
              moduleName: output.moduleName,
              offset: output.offset || output.address.replace(/^0x/i, ""),
              offsetFormat: 'hex',
              useModuleOffset: output.useModuleOffset,
              offsets: output.offsets,
              type: output.type,
              bitmask: output.bitmask,
              bitwiseOp: output.bitwiseOp,
              bitfield: output.bitfield,
              fastModeEnabled: output.fastModeEnabled || false
            };
          } else if (output.useModuleOffset) {
            // NEW: Ensure module name is always set for module+offset addresses
            const moduleName = output.moduleName || gameProfileInUse?.processName || 'daytona.exe';
            
            // Module+offset - UPDATED: Prioritize using output.offset, only fall back to address if offset missing
            addressConfig = { 
              id: output.label,
              moduleName: moduleName,
              offset: output.offset || output.address, // Use offset field first, only fall back to address if offset is missing
              offsetFormat: 'hex',
              useModuleOffset: true,
              bitmask: output.bitmask,
              bitwiseOp: output.bitwiseOp,
              bitfield: output.bitfield,
              type: output.type,
              fastModeEnabled: output.fastModeEnabled || false
            };
          } else {
            // Direct absolute address
            addressConfig = {
              id: output.label,
              address: output.address,
              bitmask: output.bitmask,
              bitwiseOp: output.bitwiseOp,
              bitfield: output.bitfield,
              type: output.type,
              fastModeEnabled: output.fastModeEnabled || false
            };
          }
          
          return addressConfig;
        });
            
        // Read all addresses in a single batch for better performance
        const processName = gameProfileInUse?.processName || 'daytona.exe';
        const batchResults = await readMemoryBatch(processName, batchAddresses);
        
        // Apply a single consistent timestamp to all results
        const pollTimestamp = new Date();
        
        // Convert results to the inputs object
        batchResults.forEach(result => {
          if (result.id) {
            // IMPORTANT: Ensure numeric values are properly converted from BigInt
            let value = result.value;
            if (typeof value === 'bigint') {
              value = Number(value);
            }
            
            inputs[result.id] = {
              ...result,
              value: value,
              lastRead: pollTimestamp
            };
          }
        });
        
        // Get current overrides from global state
        let currentOverrides = {};
        if (global.outputOverrides && typeof global.outputOverrides === 'object') {
          currentOverrides = global.outputOverrides;
        }
        
        // Apply overrides to create the final memory data
        const finalMemoryData = { ...inputs };
        for (const key in currentOverrides) {
          if (key in finalMemoryData && currentOverrides[key] !== undefined && currentOverrides[key] !== '') {
            finalMemoryData[key] = Number(currentOverrides[key]);
          }
        }
        
        try {
          // Process outputs through the outputDispatcher
          // This will handle all logging in one place
          handleUpdate(gameProfileInUse, finalMemoryData);
        } catch (logError) {
          // Silently fail logging but log the error to file if not in high performance mode
          if (!isHighPerformanceMode()) {
            logToFileAsync(`Error in handleUpdate: ${logError.message}`);
          }
        }
        
        // Send the memory update to the main process
        if (mainWindowRef && mainWindowRef.webContents) {
          mainWindowRef.webContents.send('memory:update', finalMemoryData);
        }
        
        // Update performance metrics
        const pollDuration = Date.now() - pollStartTime;
        lastPollDuration = pollDuration;
        
        pollDurations.push(pollDuration);
        if (pollDurations.length > 10) {
          pollDurations.shift(); // Keep only last 10 measurements
        }
        
        avgPollDuration = pollDurations.reduce((sum, dur) => sum + dur, 0) / pollDurations.length;
        
        pollCount++;
        const elapsedSinceStart = Date.now() - pollCountStart;
        if (elapsedSinceStart >= 1000) { // Update once per second
          pollsPerSecond = (pollCount / elapsedSinceStart) * 1000;
          pollCount = 0;
          pollCountStart = Date.now();
          
          // Send performance metrics to renderer
          if (mainWindowRef && mainWindowRef.webContents) {
            mainWindowRef.webContents.send('memory:metrics', {
              lastPollDuration,
              avgPollDuration,
              pollsPerSecond,
              skippedPolls,
              fastModeEnabled: fastModeCount > 0
            });
          }
        }
        
      } catch (error) {
        if (!isHighPerformanceMode()) {
          logToFileAsync(`Error during memory polling: ${error.message}`);
        }
      } finally {
        pollInProgress = false;
      }
    }, currentPollRate);

    return true;
  } catch (error) {
    stopPollingMemory();
    return false;
  }
}

function updatePollRate(newRate) {
  if (typeof newRate !== 'number' || newRate < 10) {
    return false;
  }

  if (newRate === currentPollRate) {
    return true; // No change needed
  }

  currentPollRate = newRate;
  
  // Update the cache TTL based on new poll rate
  BatchReader.setCacheTTL(currentPollRate);

  // If we're actively polling, restart with the new rate
  if (pollingInterval && mainWindowRef && memoryProfileInUse) {
    stopPollingMemory();
    startPollingMemory(mainWindowRef, {
      ...gameProfileInUse,
      pollInterval: currentPollRate
    });
    
    // Notify the renderer of the poll rate change
    if (mainWindowRef) {
      mainWindowRef.webContents.send('poll:interval:updated', currentPollRate);
    }
  }
  
  return true;
}

function stopPollingMemory() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  
  // Turn off fast mode and high performance mode when stopping
  fastModeEnabled = false;
  setHighPerformanceMode(false);
  
  mainWindowRef = null;
  gameProfileInUse = null;
  memoryProfileInUse = null;
  pollInProgress = false;
}

// Find and return module base address - wrapper around BatchReader function
const findModuleBase = BatchReader.getCachedModuleBase;

// Export performance metrics
function getPerformanceMetrics() {
  return {
    lastPollDuration,
    avgPollDuration,
    pollsPerSecond,
    skippedPolls,
    fastModeEnabled
  };
}

module.exports = {
  startPollingMemory,
  stopPollingMemory,
  updatePollRate,
  getCurrentPollRate: () => currentPollRate,
  findModuleBase,
  readMemoryBatch,
  getPerformanceMetrics
};
