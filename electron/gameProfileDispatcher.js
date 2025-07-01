/**
 * Game Profile Dispatcher
 * Handles routing memory profile outputs to devices based on Game Profile mappings
 */

const { logEvent } = require('./loggerBridge');
const { dispatchPacDriveOutput, dispatchPacDriveBitmask } = require('./devices/pacDriveDispatcher');
// Destructure the controller to match how it's used in the code
const { arduinoController } = require('./devices/arduinoController');
const wledController = require('./devices/wledController');
const deviceStore = require('./devices/deviceStoreController');
const { getOutputOptimizationConfig } = require('./settingsManager');

// Track PacDrive channel states per device - add state tracking
const pacDriveStates = {};

// Store the currently loaded game profile and message profile for message handling
let currentGameProfile = null;
let currentMessageProfile = null;

// Value change tracking for optimization
let lastSentValues = {};
let forceUpdateCounter = 0;
let optimizationConfig = { sendOnlyChangedValues: false, forceUpdateInterval: 10 };

/**
 * Load optimization configuration
 */
async function loadOptimizationConfig(appPath) {
  try {
    optimizationConfig = getOutputOptimizationConfig(appPath);
  } catch (error) {
    logEvent('warning', `Failed to load optimization config: ${error.message}`);
    optimizationConfig = { sendOnlyChangedValues: false, forceUpdateInterval: 10 };
  }
}

/**
 * Load and store the current game profile for message handling
 * @param {Object} gameProfile - The game profile to store
 */
function setCurrentGameProfile(gameProfile) {
  currentGameProfile = gameProfile;
  logEvent('debug', `Current game profile set: ${gameProfile?.profileName || 'none'}`);
}

/**
 * Load and store the current message profile for message handling
 * @param {Object} messageProfile - The message profile to store
 */
function setCurrentMessageProfile(messageProfile) {
  currentMessageProfile = messageProfile;
  logEvent('debug', `Current message profile set with ${messageProfile?.outputs?.length || 0} outputs`);
}

/**
 * Handle incoming message output from Win32 messages
 * @param {string} key - The output key from the message
 * @param {any} value - The output value from the message
 */
async function handleMessageOutput(key, value) {
  // Validate that we have both game profile and message profile loaded
  if (!currentGameProfile || !currentMessageProfile) {
    logEvent('warning', `Message output received but no active profiles loaded. Key: ${key}, Value: ${value}`);
    return;
  }

  // Find the matching output in the message profile
  const messageOutput = currentMessageProfile.outputs?.find(output => output.key === key);
  if (!messageOutput) {
    logEvent('debug', `Message key '${key}' not found in current message profile outputs`);
    return;
  }

  // Find the corresponding game profile output by label
  const gameOutput = currentGameProfile.outputs?.find(output => 
    output.label === messageOutput.label && output.isActive !== false
  );
  
  if (!gameOutput) {
    logEvent('debug', `No active game profile output found for message key '${key}' (label: ${messageOutput.label})`);
    return;
  }

  // Log the message output detection
  logEvent('message', `Message output detected: key='${key}', value=${value}, label='${messageOutput.label}'`);

  // Create a memory values object for dispatching (reusing existing dispatch system)
  const messageValues = {
    [messageOutput.label]: value
  };

  try {
    // Dispatch using the existing memory dispatch system
    const dispatchResults = await dispatchMemoryValues(currentGameProfile, messageValues);
    
    // Log dispatch results for message outputs
    if (dispatchResults.length > 0) {
      const result = dispatchResults.find(r => r.label === messageOutput.label);
      if (result) {
        const status = result.success ? 'SUCCESS' : 'FAILED';
        const errorInfo = result.error ? ` (${result.error})` : '';
        logEvent('dispatch', `Message key '${key}' dispatched to ${result.device} Ch${result.channel} = ${result.value} - ${status}${errorInfo}`);
      }
    }
  } catch (error) {
    logEvent('warning', `Error dispatching message output for key '${key}': ${error.message || String(error)}`);
  }
}

/**
 * Shuts down all devices by sending 0 values to all outputs in the game profile
 * This is called when a process drops out or monitoring is stopped
 * @param {Object} gameProfile - The active game profile with output mappings
 * @returns {Promise<boolean>} True if shutdown was successful, false otherwise
 */
async function shutdownAllDevices(gameProfile) {
  // Reset value tracking on shutdown
  lastSentValues = {};
  forceUpdateCounter = 0;
  
  // Validate that we have both game profile and message profile loaded
  if (!currentGameProfile || !currentMessageProfile) {
    logEvent('warning', `Shutdown process initiated but no active profiles loaded`);
    return true; // Not an error if no profiles to shut down
  }

  // Create a single comprehensive shutdown log instead of multiple separate logs
  let shutdownLogMessage = `***** DEVICE SHUTDOWN LOGS *****\n`;
  shutdownLogMessage += `Shutdown Process Initiated:\n`;
  shutdownLogMessage += `• Profile: ${gameProfile.profileName || 'unknown'}\n`;
  shutdownLogMessage += `• Total Outputs: ${gameProfile.outputs.length}\n`;
  
  // Create memory values object with all outputs set to 0
  const shutdownValues = {};
  const activeOutputs = [];
  
  gameProfile.outputs.forEach(output => {
    if (output.label && output.device && output.device !== 'none' && output.device !== 'None') {
      shutdownValues[output.label] = 0;
      activeOutputs.push(`${output.label} (${output.device})`);
    }
  });

  shutdownLogMessage += `• Active Outputs to Shutdown: ${activeOutputs.length}\n`;
  if (activeOutputs.length > 0) {
    shutdownLogMessage += `• Output List: ${activeOutputs.join(', ')}\n`;
  }

  if (Object.keys(shutdownValues).length === 0) {
    shutdownLogMessage += `• Shutdown Process: COMPLETED\n`;
    shutdownLogMessage += `• Result: No active outputs found\n`;
    shutdownLogMessage += `***** DEVICE SHUTDOWN COMPLETE *****`;
    logEvent('device', shutdownLogMessage);
    return true;
  }

  shutdownLogMessage += `• Shutdown Process: Starting device dispatch...\n`;

  // Dispatch all zeros to devices
  const shutdownResults = await dispatchMemoryValues(gameProfile, shutdownValues);
  
  // Process results
  let successCount = 0;
  let failureCount = 0;
  const resultDetails = [];
  
  shutdownResults.forEach(result => {
    if (result.success) {
      successCount++;
      resultDetails.push(`✅ ${result.label} on ${result.device}`);
    } else {
      failureCount++;
      resultDetails.push(`❌ ${result.label} on ${result.device}: ${result.error || 'Unknown error'}`);
    }
  });

  shutdownLogMessage += `• Dispatch Results: ${successCount} successful, ${failureCount} failed\n`;
  if (resultDetails.length > 0) {
    shutdownLogMessage += `• Detailed Results:\n`;
    resultDetails.forEach(detail => {
      shutdownLogMessage += `  ${detail}\n`;
    });
  }

  // Reset PacDrive state tracking since all devices are now off
  const resetDevices = [];
  Object.keys(pacDriveStates).forEach(deviceId => {
    pacDriveStates[deviceId] = 0;
    resetDevices.push(deviceId);
  });

  if (resetDevices.length > 0) {
    shutdownLogMessage += `• PacDrive State Reset: Devices ${resetDevices.join(', ')}\n`;
  }

  shutdownLogMessage += `• Shutdown Process: COMPLETED\n`;
  shutdownLogMessage += `• Final Result: ${failureCount === 0 ? 'SUCCESS' : 'PARTIAL FAILURE'}\n`;
  shutdownLogMessage += `***** DEVICE SHUTDOWN COMPLETE *****`;

  // Send consolidated shutdown log
  logEvent('device', shutdownLogMessage);

  return failureCount === 0;
}

/**
 * Dispatches memory values to the appropriate output devices based on game profile mappings
 * @param {Object} gameProfile - The loaded Game Profile with output mappings
 * @param {Object} memoryValues - Object containing formatted memory values (keyed by memory output labels)
 * @returns {Array} Array of dispatch results for logging and status updates
 */
async function dispatchMemoryValues(gameProfile, memoryValues) {
  // Load current optimization config if needed
  if (global.mainWindow) {
    try {
      const app = require('electron').app;
      await loadOptimizationConfig(app.getAppPath());
    } catch (error) {
      // Continue with defaults if config load fails
    }
  }

  // CRITICAL FIX: If we're testing a single output (from dispatchTestValue),
  // ensure we properly handle its properties
  const isSingleOutputTest = !gameProfile?.outputs && gameProfile?.label && gameProfile?.device;
  
  if (isSingleOutputTest) {
    // Create consolidated test mode log instead of multiple separate logs
    const testLogMessage = `*** TEST MODE DETECTED ***\nTest dispatch for output: ${gameProfile.label}\nDevice: ${gameProfile.device}, Target Device: ${gameProfile.targetDevice}, Channel: ${gameProfile.channel}\nTest initiated for single output configuration`;
    logEvent('testing', testLogMessage);
    
    // For testing, always send the value regardless of optimization settings
    const tempProfile = {
      outputs: [gameProfile]
    };
    
    return await dispatchOutputsToDevices(tempProfile, memoryValues, true); // Force send for tests
  }

  // Handle regular case where gameProfile has outputs
  if (!gameProfile?.outputs || !Array.isArray(gameProfile.outputs)) {
    return [];
  }

  // Check if optimization is enabled
  const shouldOptimize = optimizationConfig.sendOnlyChangedValues;
  let forceSend = false;

  if (shouldOptimize) {
    // Increment force update counter
    forceUpdateCounter++;
    
    // Check if we should force send all values
    if (forceUpdateCounter >= optimizationConfig.forceUpdateInterval) {
      forceSend = true;
      forceUpdateCounter = 0;
      logEvent('debug', `Force update triggered after ${optimizationConfig.forceUpdateInterval} cycles`);
    }
  }

  // Continue with normal operation
  return await dispatchOutputsToDevices(gameProfile, memoryValues, forceSend);
}

/**
 * Core function to dispatch outputs to devices - extracted to avoid code duplication
 * @param {Object} gameProfile - Game profile with outputs array
 * @param {Object} memoryValues - Memory values to dispatch
 * @param {boolean} forceSend - Whether to force send all values regardless of changes
 * @returns {Array} Array of dispatch results
 */
async function dispatchOutputsToDevices(gameProfile, memoryValues, forceSend = false) {
  const dispatchResults = [];
  const deviceCache = {};
  
  // Collect all debug information for consolidated logging
  const debugInfo = [];
  
  // Add optimization info to debug
  const shouldOptimize = optimizationConfig.sendOnlyChangedValues && !forceSend;
  debugInfo.push(`Optimization: ${shouldOptimize ? 'enabled' : 'disabled'}, Force send: ${forceSend}`);
  
  // Load devices once to avoid multiple store reads
  try {
    deviceCache.devices = await deviceStore.readDeviceStore();
    
    // Add device store information to debug
    debugInfo.push(`Device store loaded: ${deviceCache.devices.length} devices available`);
    debugInfo.push(`Available device IDs: ${deviceCache.devices.map(d => `${d.id} (${d.name || 'no name'}, ${d.type || 'no type'})`).join(', ')}`);
    
    // Add detailed device information
    deviceCache.devices.forEach(device => {
      debugInfo.push(`Device details: ID=${device.id}, Name=${device.name}, Type=${device.type}, Properties=${JSON.stringify(device)}`);
    });
    
  } catch (error) {
    logEvent('warning', `Failed to load devices: ${error.message || String(error)}`);
    debugInfo.push(`Device store read failed: ${error.message || String(error)}`);
    deviceCache.devices = [];
  }

  // Process each output mapping
  for (const output of gameProfile.outputs) {
    const { label, device, channel, targetDevice, isActive } = output;
    
    // Add output processing details to debug
    debugInfo.push(`Processing output: ${label}, device: ${device}, targetDevice: ${targetDevice}, channel: ${channel}, isActive: ${isActive}`);
    
    // Skip if output is not active or no device is configured
    if (isActive === false) {
      debugInfo.push(`Skipping output ${label}: isActive is false`);
      continue;
    }
    
    if (!memoryValues.hasOwnProperty(label)) {
      debugInfo.push(`Skipping output ${label}: No memory value available`);
      continue;
    }
    
    if (!device || device === 'none' || device === 'None') {
      debugInfo.push(`Skipping output ${label}: No device configured (device: ${device})`);
      continue;
    }

    // Get the value and ensure it's the right type for the device
    let value = memoryValues[label];
    
    // Check if value has changed (optimization logic)
    const valueKey = `${label}_${device}_${targetDevice}_${channel}`;
    const lastValue = lastSentValues[valueKey];
    const hasChanged = lastValue === undefined || lastValue !== value;
    
    debugInfo.push(`Value change check for ${label}: last=${lastValue}, current=${value}, changed=${hasChanged}`);
    
    // Skip if optimization is enabled and value hasn't changed
    if (shouldOptimize && !hasChanged) {
      debugInfo.push(`Skipping output ${label}: Value unchanged and optimization enabled`);
      continue;
    }
    
    // Update last sent value
    lastSentValues[valueKey] = value;
    
    debugInfo.push(`Memory value for ${label}: ${value} (type: ${typeof value})`);
    
    let dispatchResult = {
      label,
      device,
      channel,
      value,
      success: false,
      error: null
    };

    try {
      if (!targetDevice && targetDevice !== 0) { // Allow literal 0 for PacDrive
        dispatchResult.error = 'No target device ID provided';
        logEvent('warning', `Missing target device ID for output ${label}`);
        debugInfo.push(`Target device validation failed for ${label}: targetDevice=${targetDevice}`);
        dispatchResults.push(dispatchResult);
        continue;
      }
      
      // Special handling for PacDrive devices - recognize both numeric indices and UUIDs
      let deviceConfig = null;
      
      if (device.toLowerCase() === 'pacdrive') {
        debugInfo.push(`PacDrive device processing for ${label}: targetDevice=${targetDevice} (type: ${typeof targetDevice})`);
        
        // Always try to convert to number for PacDrive first (both string numerics and actual numbers)
        const numTargetDevice = Number(targetDevice);
        
        if (!isNaN(numTargetDevice)) {
          // Use numeric targetDevice directly for PacDrive
          debugInfo.push(`Using numeric PacDrive index: ${numTargetDevice} (converted from ${targetDevice})`);
          deviceConfig = {
            id: String(targetDevice),
            deviceId: numTargetDevice,
            type: 'PacDrive'
          };
        }
        else {
          // If it's not a number, look up in device cache
          debugInfo.push(`Looking up PacDrive UUID: ${targetDevice} in device store`);
          
          // Handle both string and object comparisons
          deviceConfig = deviceCache.devices.find(d => {
            // Compare as strings to handle type mismatches
            return String(d.id) === String(targetDevice);
          });
          
          if (deviceConfig) {
            // Extract numeric ID for PacDrive
            const numericId = getDeviceId(deviceConfig);
            if (numericId !== null && !isNaN(numericId)) {
              debugInfo.push(`Found PacDrive device: ${deviceConfig.name}, extracted numeric ID: ${numericId}`);
              // Update deviceId in config for dispatching
              deviceConfig.deviceId = numericId;
            } else {
              logEvent('warning', `WARNING: Found PacDrive device but couldn't extract numeric ID from properties: ${JSON.stringify(deviceConfig)}`);
              debugInfo.push(`PacDrive numeric ID extraction failed for device: ${JSON.stringify(deviceConfig)}`);
              dispatchResult.error = `PacDrive device found but couldn't extract numeric index`;
              dispatchResults.push(dispatchResult);
              continue;
            }
          } else {
            logEvent('warning', `CRITICAL ERROR: No device found with ID ${targetDevice} in device cache`);
            debugInfo.push(`Device lookup failed for ID ${targetDevice}. Available devices: ${deviceCache.devices.map(d => d.id).join(', ')}`);
            dispatchResult.error = `Device not found: ${targetDevice}`;
            dispatchResults.push(dispatchResult);
            continue;
          }
        }
      } else {
        // For non-PacDrive devices, simply look up the device by ID
        debugInfo.push(`Non-PacDrive device lookup for ${label}: searching for device ID ${targetDevice}`);
        deviceConfig = deviceCache.devices.find(d => String(d.id) === String(targetDevice));
        
        if (deviceConfig) {
          debugInfo.push(`Found device: ${deviceConfig.name || 'unnamed'} (${deviceConfig.type || 'no type'})`);
        } else {
          debugInfo.push(`Device not found with ID ${targetDevice}. Available device IDs: ${deviceCache.devices.map(d => d.id).join(', ')}`);
        }
      }
      
      // If we still don't have a device config
      if (!deviceConfig) {
        logEvent('warning', `CRITICAL ERROR: No deviceConfig could be created for ${targetDevice}`);
        debugInfo.push(`Device configuration failed for targetDevice ${targetDevice}, device type ${device}`);
        dispatchResult.error = `No device configuration found for ID: ${targetDevice}`;
        dispatchResults.push(dispatchResult);
        continue;
      }

      debugInfo.push(`Device configuration successful: ${deviceConfig?.name || 'unknown'} (${deviceConfig?.type || 'unknown'}) - ID: ${deviceConfig?.id || 'unknown'}`);

      // Type conversion based on device type
      const deviceType = device.toLowerCase();
      if (deviceType === 'pacdrive') {
        // Ensure PacDrive values are numeric 1 or 0 only
        value = value === 1 || value === "1" ? 1 : 0;
        debugInfo.push(`PacDrive value normalized to: ${value} (${typeof value})`);
      }

      // Route to the appropriate device type - case insensitive matching
      if (deviceType === 'serial') {
        await dispatchToArduino(deviceConfig, value, dispatchResult, debugInfo);
      } 
      else if (deviceType === 'pacdrive') {
        // For PacDrive, use the numeric deviceId from the config
        const numericId = deviceConfig.deviceId !== undefined ? deviceConfig.deviceId : getDeviceId(deviceConfig);
        
        if (numericId === null || isNaN(Number(numericId))) {
          dispatchResult.error = `Invalid PacDrive device ID: ${numericId}`;
          logEvent('warning', `Invalid PacDrive ID: ${numericId} for output ${label}`);
          debugInfo.push(`PacDrive numeric ID validation failed: ${numericId} (type: ${typeof numericId})`);
          dispatchResults.push(dispatchResult);
          continue;
        }
        
        debugInfo.push(`Using PacDrive numeric ID: ${numericId} for dispatch`);
        await dispatchToPacDrive(deviceConfig, channel, value, dispatchResult, debugInfo);
      }
      else if (deviceType === 'wled') {
        await dispatchToWLED(deviceConfig, value, output.wledProfileId, dispatchResult, debugInfo);
      }
      else {
        dispatchResult.error = `Unsupported device type: ${device}`;
        logEvent('warning', `Unsupported device type: ${device} for output ${label}`);
        debugInfo.push(`Device type not supported: ${device} for output ${label}`);
      }
      
    } catch (error) {
      dispatchResult.error = `Dispatch error: ${error.message || String(error)}`;
      logEvent('warning', `Error dispatching to ${device} for ${label}: ${error.message || String(error)}`);
      debugInfo.push(`Dispatch exception for ${label}: ${error.message || String(error)}`);
    }
    
    dispatchResults.push(dispatchResult);
  }

  // Add dispatch cycle summary to debug
  const successCount = dispatchResults.filter(r => r.success).length;
  const totalCount = dispatchResults.length;
  const skippedCount = gameProfile.outputs.length - dispatchResults.length;
  debugInfo.push(`Dispatch cycle completed: ${successCount}/${totalCount} outputs succeeded, ${skippedCount} skipped`);
  
  if (dispatchResults.length > 0) {
    const resultSummary = dispatchResults.map(r => `${r.label}: ${r.success ? 'SUCCESS' : 'FAILED' + (r.error ? ` (${r.error})` : '')}`).join(', ');
    debugInfo.push(`Detailed results: ${resultSummary}`);
  }

  // Send consolidated debug log
  if (debugInfo.length > 0) {
    logEvent('debug', debugInfo.join('\n'));
  }

  return dispatchResults;
}

/**
 * Dispatches a value to an Arduino device
 */
async function dispatchToArduino(deviceConfig, value, dispatchResult, debugInfo) {
  // Check for COM port using either comPort or port property
  const comPort = deviceConfig.comPort || deviceConfig.port;
  
  if (!comPort) {
    dispatchResult.error = 'Missing COM port configuration';
    logEvent('warning', `Serial dispatch error: Missing COM port configuration for device ${JSON.stringify(deviceConfig.id || 'unknown')}`);
    debugInfo.push(`Serial COM port validation failed: deviceConfig=${JSON.stringify(deviceConfig)}`);
    return;
  }

  const baudRate = deviceConfig.baudRate || 9600;
  const message = value.toString();
  
  try {
    debugInfo.push(`Serial dispatch: port=${comPort}, baudRate=${baudRate}, message=${message}`);
    
    // Use the arduinoController explicitly (already destructured at the top)
    const result = await arduinoController.sendSerialMessage(comPort, baudRate, message);
    
    if (result && result.success) {
      dispatchResult.success = true;
      debugInfo.push(`Serial dispatch successful: sent "${message}" to ${comPort}`);
    } else {
      dispatchResult.error = result?.error || 'Failed to send message';
      logEvent('warning', `Serial dispatch failed: ${result?.error || 'Unknown error'}`);
      debugInfo.push(`Serial dispatch failed: result=${JSON.stringify(result)}`);
    }
  } catch (error) {
    dispatchResult.error = `Serial error: ${error.message || String(error)}`;
    logEvent('warning', `Serial dispatch exception: ${error.message || String(error)}`);
    debugInfo.push(`Serial dispatch exception details: ${error.stack || error.message || String(error)}`);
  }
}

/**
 * Dispatches a value to a PacDrive device
 * MODIFIED: Now uses bitmask approach to preserve state across all channels
 */
async function dispatchToPacDrive(deviceConfig, channel, value, dispatchResult, debugInfo) {
  // Enhanced logging to diagnose device ID issues
  debugInfo.push(`PacDrive device config: ${JSON.stringify(deviceConfig)}`);
  debugInfo.push(`PacDrive dispatch with value: ${value} (type: ${typeof value})`);
  
  // Check for device ID using multiple possible property names
  const deviceId = getDeviceId(deviceConfig);
  
  if (deviceId === null || deviceId === undefined) {
    dispatchResult.error = 'Missing PacDrive device ID';
    logEvent('warning', `PacDrive dispatch error: Missing device ID in configuration - Properties available: ${Object.keys(deviceConfig).join(', ')}`);
    debugInfo.push(`PacDrive device ID extraction failed from config: ${JSON.stringify(deviceConfig)}`);
    return;
  }

  // Convert device ID to number if it's a string
  const deviceIdNumber = Number(deviceId);
  if (isNaN(deviceIdNumber)) {
    dispatchResult.error = `Invalid PacDrive device ID: ${deviceId} (not a number)`;
    logEvent('warning', `PacDrive dispatch error: Device ID must be a number, received: ${typeof deviceId} ${deviceId}`);
    debugInfo.push(`PacDrive device ID number conversion failed: ${deviceId} -> ${deviceIdNumber}`);
    return;
  }

  // Convert value to numeric for PacDrive (instead of boolean)
  const numericValue = Number(value);
  
  // Validate the numeric value
  if (isNaN(numericValue)) {
    dispatchResult.error = `Invalid PacDrive value: ${value} is not a number`;
    logEvent('warning', `PacDrive dispatch error: Value must be a number, received: ${typeof value} ${value}`);
    debugInfo.push(`PacDrive value validation failed: ${value} (type: ${typeof value})`);
    return;
  }
  
  try {
    // FIXED: PacDrive channels need to be converted from 1-based (UI) to 0-based (internal)
    // Handle different channel formats: string, number, or array
    let channelZeroBased = [];
    
    if (Array.isArray(channel)) {
      // Handle array of channels
      channelZeroBased = channel.map(c => {
        const parsedChannel = typeof c === 'string' ? parseInt(c, 10) : Number(c);
        // Ensure channel is in range 1-16 (UI numbering) before converting to 0-15 (internal)
        if (isNaN(parsedChannel) || parsedChannel < 1 || parsedChannel > 16) {
          throw new Error(`Invalid channel number: ${c}. Must be between 1-16.`);
        }
        return parsedChannel - 1; // Convert 1-based to 0-based
      });
    } else {
      // Handle single channel
      const parsedChannel = typeof channel === 'string' ? parseInt(channel, 10) : Number(channel);
      // Validate channel is in range 1-16 (UI numbering)
      if (isNaN(parsedChannel)) {
        throw new Error(`Invalid channel format: ${channel}. Must be a number.`);
      }
      if (parsedChannel < 1 || parsedChannel > 16) {
        throw new Error(`Invalid channel number: ${parsedChannel}. Must be between 1-16.`);
      }
      channelZeroBased = [parsedChannel - 1]; // Convert 1-based to 0-based
    }
    
    // Log detailed information for debugging
    debugInfo.push(`Dispatching to PacDrive ${deviceIdNumber}, UI channels: ${channel}, internal channels: ${JSON.stringify(channelZeroBased)}, value: ${numericValue}`);
    
    // CRITICAL FIX: Use bitmask approach to maintain state across all channels
    // Initialize device state if not already tracking it
    if (!pacDriveStates[deviceIdNumber]) {
      pacDriveStates[deviceIdNumber] = 0; // Start with all channels off
      debugInfo.push(`Initializing state tracking for PacDrive device ${deviceIdNumber}`);
    }
    
    // Get the current state for this device
    let currentState = pacDriveStates[deviceIdNumber];
    debugInfo.push(`Current PacDrive state for device ${deviceIdNumber}: ${currentState.toString(16)} (hex), ${currentState.toString(2).padStart(16, '0')} (binary)`);
    
    // Update the state based on channels and value
    for (const channelNum of channelZeroBased) {
      if (numericValue > 0) {
        // Turn on this bit
        currentState |= (1 << channelNum);
        debugInfo.push(`Setting channel ${channelNum} ON, new state: ${currentState.toString(16)} (hex), ${currentState.toString(2).padStart(16, '0')} (binary)`);
      } else {
        // Turn off this bit
        currentState &= ~(1 << channelNum);
        debugInfo.push(`Setting channel ${channelNum} OFF, new state: ${currentState.toString(16)} (hex), ${currentState.toString(2).padStart(16, '0')} (binary)`);
      }
    }
    
    // Update our state tracking
    pacDriveStates[deviceIdNumber] = currentState;
    
    // Send the full state using bitmask approach
    debugInfo.push(`Sending full state to device ${deviceIdNumber}: ${currentState.toString(16)} (hex), ${currentState.toString(2).padStart(16, '0')} (binary)`);
    const result = await dispatchPacDriveBitmask(deviceIdNumber, channelZeroBased, numericValue);
    
    if (result && result.success) {
      dispatchResult.success = true;
      debugInfo.push(`Successfully updated PacDrive ${deviceIdNumber} state with channels ${channel} set to ${numericValue}`);
    } else {
      dispatchResult.error = result?.error || 'PacDrive dispatch failed';
      logEvent('warning', `PacDrive dispatch failed: ${result?.error || 'Unknown error'}`);
      debugInfo.push(`PacDrive dispatch failed with result: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    dispatchResult.error = `PacDrive error: ${error.message || String(error)}`;
    logEvent('warning', `PacDrive dispatch exception: ${error.message || String(error)}`);
    debugInfo.push(`PacDrive dispatch exception details: ${error.stack || error.message || String(error)}`);
  }
}

/**
 * Helper function to get device ID from various possible property names
 */
function getDeviceId(deviceConfig) {
  const debugInfo = [];
  debugInfo.push(`Getting device ID from config: ${JSON.stringify(deviceConfig)}`);
  
  // CRITICAL FIX: Check if it's a PacDrive device with a numeric index in usbPath
  if (deviceConfig.type === 'PacDrive' && deviceConfig.usbPath !== undefined) {
    // For PacDrive devices, usbPath often contains the device index
    const numericPath = parseInt(deviceConfig.usbPath, 10);
    if (!isNaN(numericPath)) {
      debugInfo.push(`Extracted device ID from usbPath: ${numericPath}`);
      return numericPath;
    }
    
    // Try to extract a number from usbPath if it's not directly numeric
    const match = deviceConfig.usbPath.match(/(\d+)$/);
    if (match) {
      const extractedIndex = parseInt(match[1], 10);
      debugInfo.push(`Extracted device ID from usbPath pattern: ${extractedIndex}`);
      return extractedIndex;
    }
  }
  
  // First, check for the dedicated deviceId property
  if (deviceConfig.deviceId !== undefined) {
    debugInfo.push(`Found deviceId property: ${deviceConfig.deviceId}`);
    return deviceConfig.deviceId;
  } 
  
  // Then check alternative property names
  if (deviceConfig.deviceIndex !== undefined) {
    debugInfo.push(`Found deviceIndex property: ${deviceConfig.deviceIndex}`);
    return deviceConfig.deviceIndex;
  }
  
  // For PacDrive devices, name often contains the index number (e.g., "PacDrive 0")
  if (deviceConfig.type === 'PacDrive' && deviceConfig.name) {
    const match = deviceConfig.name.match(/PacDrive\s+(\d+)/i);
    if (match) {
      const indexFromName = parseInt(match[1], 10);
      debugInfo.push(`Extracted device ID from name pattern: ${indexFromName}`);
      return indexFromName;
    }
  }
  
  if (deviceConfig.id !== undefined) {
    // If id is a number, use it directly
    if (typeof deviceConfig.id === 'number') {
      debugInfo.push(`Found numeric id property: ${deviceConfig.id}`);
      return deviceConfig.id;
    }
    
    // If id is a string with digits only, convert to number
    if (typeof deviceConfig.id === 'string' && /^\d+$/.test(deviceConfig.id)) {
      const numericId = parseInt(deviceConfig.id, 10);
      debugInfo.push(`Converted string id to number: ${numericId}`);
      return numericId;
    }
  }
  
  if (deviceConfig.index !== undefined) {
    debugInfo.push(`Found index property: ${deviceConfig.index}`);
    return deviceConfig.index;
  }
  
  // If we have a string ID, try to extract a number from it
  if (typeof deviceConfig.id === 'string' && deviceConfig.id.match(/\d+/)) {
    const match = deviceConfig.id.match(/\d+/);
    if (match) {
      const extractedNumber = parseInt(match[0], 10);
      debugInfo.push(`Extracted number from string id: ${extractedNumber}`);
      return extractedNumber;
    }
  }
  
  logEvent('warning', `No valid device ID found in config with properties: ${Object.keys(deviceConfig).join(', ')}`);
  debugInfo.push(`Device ID extraction failed for config: ${JSON.stringify(deviceConfig)}`);
  return null;
}

/**
 * Dispatches a value to a WLED device using its profile
 * MODIFIED: Now uses loose equality for rule matching to handle type differences
 */
async function dispatchToWLED(deviceConfig, value, wledProfileId, dispatchResult, debugInfo) {
  // Check for IP address using either ip or ipAddress property
  const deviceIp = deviceConfig.ip || deviceConfig.ipAddress;
  
  if (!deviceIp) {
    dispatchResult.error = 'Missing WLED device IP address';
    logEvent('warning', `WLED dispatch error: Missing IP address in configuration (checked both ip and ipAddress properties)`);
    debugInfo.push(`WLED IP address validation failed: deviceConfig=${JSON.stringify(deviceConfig)}`);
    return;
  }
  
  try {
    debugInfo.push(`WLED dispatch: IP=${deviceIp}, profileId=${wledProfileId}, value=${value} (type: ${typeof value})`);
    
    // Load the WLED profile if provided
    if (!wledProfileId) {
      dispatchResult.error = 'No WLED profile specified';
      logEvent('warning', `WLED dispatch error: No profile ID provided`);
      debugInfo.push(`WLED profile ID validation failed: profileId=${wledProfileId}`);
      return;
    }
    
    const profile = await wledController.loadWLEDProfile(`${wledProfileId}.json`);
    
    if (!profile) {
      dispatchResult.error = `WLED profile not found: ${wledProfileId}`;
      logEvent('warning', `WLED dispatch error: Profile not found: ${wledProfileId}`);
      debugInfo.push(`WLED profile loading failed: ${wledProfileId}`);
      return;
    }
    
    // Modify the profile based on the incoming value
    // For WLED, we're setting the deviceIP from the device configuration
    profile.deviceIP = deviceIp;
    
    // Find the appropriate rule based on value (if rules exist)
    if (profile.rules && Array.isArray(profile.rules)) {
      // CRITICAL FIX: Use loose equality (==) instead of strict equality (===) to handle type differences
      // This allows matching between numeric exactValue and string-converted values
      const matchingRules = profile.rules.filter(rule => 
        rule.triggerType === 'exact' && rule.exactValue == value
      );
      
      debugInfo.push(`WLED rule matching: found ${matchingRules.length} rules for value ${value} (type: ${typeof value}) out of ${profile.rules.length} total rules`);
      debugInfo.push(`WLED rule types: ${profile.rules.map(r => `exactValue=${r.exactValue} (type: ${typeof r.exactValue})`).join(', ')}`);
      
      if (matchingRules.length > 0) {
        // Create a subset profile with all matching rules for this value
        const testProfile = {
          ...profile,
          rules: matchingRules
        };
        
        // Log additional information for debugging
        debugInfo.push(`Sending WLED profile to ${deviceIp} with ${matchingRules.length} matching rules for value ${value}`);
        
        // Send the profile to the device
        const result = await wledController.sendWLEDProfileToDevice(testProfile);
        
        if (result && result.success) {
          dispatchResult.success = true;
          debugInfo.push(`WLED dispatch successful: sent profile ${wledProfileId} to ${deviceIp} with ${matchingRules.length} rules`);
        } else {
          dispatchResult.error = result?.error || 'WLED profile dispatch failed';
          logEvent('warning', `WLED dispatch failed: ${result?.error || 'Unknown error'}`);
          debugInfo.push(`WLED dispatch failed with result: ${JSON.stringify(result)}`);
        }
      } else {
        dispatchResult.error = `No matching rule found for value ${value}`;
        logEvent('warning', `WLED dispatch error: No matching rule found for value ${value} (type: ${typeof value})`);
        debugInfo.push(`WLED rule matching failed: no rules match value ${value} (type: ${typeof value}). Available rules: ${profile.rules.map(r => `${r.triggerType}=${r.exactValue} (type: ${typeof r.exactValue})`).join(', ')}`);
      }
    } else {
      dispatchResult.error = 'WLED profile has no rules defined';
      logEvent('warning', `WLED dispatch error: Profile has no rules defined`);
      debugInfo.push(`WLED profile validation failed: no rules in profile ${wledProfileId}`);
    }
  } catch (error) {
    dispatchResult.error = `WLED error: ${error.message || String(error)}`;
    logEvent('warning', `WLED dispatch exception: ${error.message || String(error)}`);
    debugInfo.push(`WLED dispatch exception details: ${error.stack || error.message || String(error)}`);
  }
}

/**
 * Dispatches a test value to an output device
 * @param {Object} output - The output configuration to test
 * @param {any} value - The test value to dispatch
 * @returns {Object} Result object with success flag and any error messages
 */
async function dispatchTestValue(output, value) {
  // Create a single comprehensive test log instead of multiple separate logs
  let testLogMessage = `***** DEVICE TESTING LOGS *****\n`;
  testLogMessage += `Test Dispatch Initiated:\n`;
  testLogMessage += `• Output Label: ${output?.label || 'undefined'}\n`;
  testLogMessage += `• Device Type: ${output?.device || 'undefined'}\n`;
  testLogMessage += `• Target Device: ${output?.targetDevice || 'undefined'}\n`;
  testLogMessage += `• Channel: ${output?.channel || 'undefined'}\n`;
  testLogMessage += `• Original Value: ${value} (type: ${typeof value})\n`;
  
  if (!output || !output.label) {
    testLogMessage += `• Validation: FAILED - Invalid output configuration\n`;
    testLogMessage += `• Result: ABORT\n`;
    logEvent('testing', testLogMessage);
    return { success: false, error: 'Invalid output configuration' };
  }
  
  // For PacDrive, ensure the value is numeric 1 or 0 only
  let processedValue = value;
  if (output.device && output.device.toLowerCase() === 'pacdrive') {
    processedValue = value === 1 || value === "1" ? 1 : 0;
    testLogMessage += `• PacDrive Value Normalization: ${value} → ${processedValue}\n`;
  }
  
  // Create a memory values object with just this output
  const memoryValues = {
    [output.label]: processedValue
  };
  
  testLogMessage += `• Memory Values Created: ${JSON.stringify(memoryValues)}\n`;
  testLogMessage += `• Dispatch Process: Starting...\n`;
  
  try {
    // CRITICAL FIX: Pass the ENTIRE output object to dispatchMemoryValues
    // This preserves ALL properties including targetDevice
    const results = await dispatchMemoryValues(output, memoryValues);
    
    // Find the result for this output
    const result = results.find(r => r.label === output.label);
    
    if (result) {
      testLogMessage += `• Dispatch Process: COMPLETED\n`;
      testLogMessage += `• Result Status: ${result.success ? 'SUCCESS' : 'FAILED'}\n`;
      if (result.error) {
        testLogMessage += `• Error Details: ${result.error}\n`;
      }
      testLogMessage += `• Full Result: ${JSON.stringify(result)}\n`;
      testLogMessage += `***** TEST DISPATCH COMPLETE *****`;
      
      logEvent('testing', testLogMessage);
      return {
        success: result.success,
        error: result.error,
        details: result
      };
    } else {
      testLogMessage += `• Dispatch Process: FAILED\n`;
      testLogMessage += `• Error: No result returned for output\n`;
      testLogMessage += `***** TEST DISPATCH FAILED *****`;
      
      logEvent('testing', testLogMessage);
      return {
        success: false,
        error: 'No dispatch result returned'
      };
    }
  } catch (error) {
    testLogMessage += `• Dispatch Process: EXCEPTION\n`;
    testLogMessage += `• Exception Details: ${error.message || String(error)}\n`;
    testLogMessage += `• Stack Trace: ${error.stack || 'not available'}\n`;
    testLogMessage += `***** TEST DISPATCH FAILED *****`;
    
    logEvent('testing', testLogMessage);
    return {
      success: false,
      error: `Dispatch error: ${error.message || String(error)}`
    };
  }
}

/**
 * Reset the state tracking for a PacDrive device
 * @param {number} deviceId - The PacDrive device ID to reset
 */
function resetPacDriveState(deviceId) {
  if (pacDriveStates[deviceId]) {
    logEvent('device', `Resetting state tracking for PacDrive device ${deviceId}`);
    logEvent('debug', `PacDrive state reset for device ${deviceId}: previous state was ${pacDriveStates[deviceId]}`);
    pacDriveStates[deviceId] = 0;
  }
}

module.exports = {
  dispatchMemoryValues,
  dispatchTestValue,
  resetPacDriveState,
  shutdownAllDevices,
  handleMessageOutput,
  setCurrentGameProfile,
  setCurrentMessageProfile
};
