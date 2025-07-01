
const { parentPort, workerData } = require('worker_threads');
const memoryjs = require('memoryjs');
const path = require('path');

// Import memory reading functionality
// We need direct imports here as we're in a separate thread
const { logToFile, isHighPerformanceMode } = require('../logger');

// Track processed reads for metrics
let readsProcessed = 0;
let startTime = Date.now();

// Memory type mapping (copied from memoryReaderReal.js to avoid circular dependencies)
const MEMORY_TYPES = {
  'Int32': memoryjs.INT32,
  'Int16': memoryjs.INT16,
  'Int8': memoryjs.INT8,
  'Float': memoryjs.FLOAT,
  'Double': memoryjs.DOUBLE,
  'Byte': memoryjs.BYTE,
  'CustomSize': memoryjs.INT32 // Default to INT32 for custom sizes
};

// Process-specific state that should not be shared between workers
let processHandle = null;
let processError = null;
let lastProcessName = '';

// Cache for module base addresses (local to this worker)
const moduleBaseCache = new Map();

// Helper to get memoryjs type constant
function getMemoryjsType(type) {
  const mappedType = MEMORY_TYPES[type];
  if (!mappedType) {
    throw new Error(`Unsupported memory type: ${type}`);
  }
  return mappedType;
}

// Apply bitwise operations to a memory value
function applyBitwiseOperation(value, bitmask, bitwiseOp) {
  // If there's no bitmask or operation, return the original value
  if (!bitmask || !bitwiseOp) {
    return value;
  }

  try {
    let mask;
    // Parse the bitmask string to a number
    if (typeof bitmask === 'string') {
      if (bitmask.toLowerCase().startsWith('0x')) {
        mask = parseInt(bitmask, 16);
      } else {
        mask = parseInt(bitmask, 10);
      }
    } else {
      mask = bitmask;
    }

    // Apply the appropriate bitwise operation
    switch (bitwiseOp) {
      case "AND":
        return value & mask;
      case "OR":
        return value | mask;
      case "NOT":
        return ~value;
      case "XOR":
        return value ^ mask;
      default:
        return value;
    }
  } catch (error) {
    if (!isHighPerformanceMode()) {
      logToFile(`Error applying bitwise operation: ${error.message}`);
    }
    return value;
  }
}

/**
 * Safely open a process handle
 * @param {string} processName - Process name
 * @returns {object|null} Process handle or null on failure
 */
/**
 * Safely (re)opens a handle to the target process.
 * Re-uses the existing handle only if the PID is unchanged;
 * otherwise re-opens and flushes all address-resolution caches.
 */
// ────────────────────── NEW STATE ──────────────────────
const PID_CHECK_INTERVAL = 1000;   // ms between inexpensive pid checks
let   lastPid        = 0;          // pid that our current handle belongs to
let   lastPidCheckTs = 0;          // timestamp of the last pid-alive probe
// ───────────────────────────────────────────────────────

// lightweight helper (≈0.02 ms on Win10)
function isPidAlive(pid) {
  try {                // throws if pid is gone or we lack permission
    process.kill(pid, 0);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Fast, PID-aware process-handle manager.
 * Re-uses the existing handle when the same process instance (PID) is still alive.
 * Enumerates processes only when the game closed/re-launched.
 */
function openProcess(processName) {
  if (!processName) return null;

  const now = Date.now();

  /* ── 1 ── fast path: known handle, recent PID check ─────────────────── */
  if (
    processHandle &&
    lastProcessName === processName &&
    now - lastPidCheckTs < PID_CHECK_INTERVAL
  ) {
    return processHandle;                // handle already validated
  }

  /* ── 2 ── slow(ish) path: validate PID once per interval ────────────── */
  if (
    processHandle &&
    lastProcessName === processName &&
    isPidAlive(lastPid)                 // cheap check – no process scan
  ) {
    lastPidCheckTs = now;
    return processHandle;
  }

  /* ── 3 ── handle is stale or never opened → enumerate & reopen ──────── */
  try {
    const match = memoryjs
      .getProcesses()                   // <-- heavy call, happens rarely
      .find(
        p => p.szExeFile.toLowerCase() === processName.toLowerCase()
      );

    if (!match) {
      processError = `Process '${processName}' not found`;
      return null;
    }

    processHandle   = memoryjs.openProcess(match.szExeFile);
    lastProcessName = processName;
    lastPid         = match.th32ProcessID;
    lastPidCheckTs  = now;

    // flush caches that contain absolute addresses from the old PID
    moduleBaseCache.clear();
    resolvedAddressCache?.clear?.();
    memoryReadCache?.clear?.();

    processError = null;
    return processHandle;
  } catch (err) {
    processError = err.message;
    return null;
  }
}



/**
 * Find module base address in a process
 * @param {object} processObject - Process object
 * @param {string} moduleName - Module name
 * @returns {object} Module info or null
 */
function findModule(processObject, moduleName) {
  if (!processObject || !moduleName) return null;
  
  const moduleNameLower = moduleName.toLowerCase();
  
  // Check cache first
  const cacheKey = `${lastProcessName}:${moduleNameLower}`;
  if (moduleBaseCache.has(cacheKey)) {
    const cached = moduleBaseCache.get(cacheKey);
    // Cache doesn't expire in the worker since it's short-lived
    return cached;
  }
  
  try {
    const modules = memoryjs.getModules(processObject.th32ProcessID);
    
    const moduleInfo = modules.find(mod => 
      mod.szModule.toLowerCase() === moduleNameLower || 
      mod.name?.toLowerCase() === moduleNameLower
    );
    
    if (moduleInfo) {
      // Cache the result
      moduleBaseCache.set(cacheKey, moduleInfo);
    }
    
    return moduleInfo;
  } catch (error) {
    if (!isHighPerformanceMode()) {
      logToFile(`Error finding module ${moduleName}: ${error.message}`);
    }
    return null;
  }
}

// IMPROVED: Validate address configuration before processing
function validateAddressConfig(addressConfig, processName) {
  // For module+offset addresses
  if (addressConfig.useModuleOffset) {
    if (!addressConfig.moduleName || typeof addressConfig.moduleName !== 'string') {
      return {
        isValid: false,
        error: `Missing or invalid moduleName for module+offset address (id: ${addressConfig.id || 'unknown'})`
      };
    }
    
    if (!addressConfig.offset) {
      return {
        isValid: false,
        error: `Missing offset for module+offset address (moduleName: ${addressConfig.moduleName}, id: ${addressConfig.id || 'unknown'})`
      };
    }
  }
  // For direct addresses
  else if (!addressConfig.address) {
    return {
      isValid: false,
      error: `Missing address for direct memory read (id: ${addressConfig.id || 'unknown'})`
    };
  }
  
  return { isValid: true };
}

/**
 * Read memory from a process
 * @param {string} processName - Process name
 * @param {object} addressConfig - Address configuration
 * @returns {object} Memory read result
 */
function readMemory(processName, addressConfig) {
  try {
    // NEW: Validate the address configuration before proceeding
    const validation = validateAddressConfig(addressConfig, processName);
    if (!validation.isValid) {
      return {
        id: addressConfig.id,
        index: addressConfig.index,
        success: false,
        error: validation.error
      };
    }
    
    // Ensure we have a handle to the process
    const processObject = openProcess(processName);
    if (!processObject) {
      return {
        id: addressConfig.id,
        index: addressConfig.index,
        success: false,
        error: processError || `Failed to open process: ${processName}`
      };
    }
    
    // Calculate final memory address
    let finalAddress;
    let resolvedPointers = [];

    try {
      // Special case: Already resolved address from cache
      if (addressConfig.resolvedFromCache && addressConfig.address) {
        finalAddress = BigInt(addressConfig.address);
      }
      // Handle pointer chains
      else if (addressConfig.offsets && addressConfig.offsets.length > 0) {
        // Initialize with base address
        let currentAddress;
        
        if (addressConfig.useModuleOffset) {
          // IMPROVED: Additional validation for module+offset with detailed error
          if (!addressConfig.moduleName) {
            return {
              id: addressConfig.id,
              index: addressConfig.index,
              success: false,
              error: `Module name is missing for module+offset address (id: ${addressConfig.id || 'unknown'})`
            };
          }
          
          if (!addressConfig.offset) {
            return {
              id: addressConfig.id,
              index: addressConfig.index,
              success: false,
              error: `Offset is missing for module+offset address (moduleName: ${addressConfig.moduleName}, id: ${addressConfig.id || 'unknown'})`
            };
          }
          
          // Find module and calculate base address
          const moduleInfo = findModule(processObject, addressConfig.moduleName);
          
          if (!moduleInfo) {
            return {
              id: addressConfig.id,
              index: addressConfig.index,
              success: false,
              error: `Module ${addressConfig.moduleName} not found in process ${processName}`
            };
          }
          
          // IMPROVED: Safer offset parsing with error handling
          try {
            // Parse offset based on format
            const offsetValue = addressConfig.offsetFormat === 'hex'
              ? BigInt(addressConfig.offset.startsWith('0x') ? addressConfig.offset : `0x${addressConfig.offset}`)
              : BigInt(parseInt(addressConfig.offset, 10));
              
            currentAddress = BigInt(moduleInfo.modBaseAddr) + offsetValue;
          } catch (offsetError) {
            return {
              id: addressConfig.id,
              index: addressConfig.index,
              success: false,
              error: `Failed to parse offset "${addressConfig.offset}" for module ${addressConfig.moduleName}: ${offsetError.message}`
            };
          }
        } 
        else {
          // Direct base address
          try {
            currentAddress = BigInt(addressConfig.address);
          } catch (addressError) {
            return {
              id: addressConfig.id,
              index: addressConfig.index,
              success: false,
              error: `Failed to convert address "${addressConfig.address}" to BigInt: ${addressError.message}`
            };
          }
        }
        
        resolvedPointers.push(Number(currentAddress));
        
        // Follow the pointer chain
        for (let i = 0; i < addressConfig.offsets.length; i++) {
          const offset = addressConfig.offsets[i];
          
          // Parse offset value
          let offsetValue;
          try {
            offsetValue = BigInt(offset.toString().startsWith('0x') 
              ? offset.toString()
              : `0x${offset.toString()}`);
          } catch (error) {
            return {
              id: addressConfig.id,
              index: addressConfig.index,
              success: false,
              error: `Invalid offset format at index ${i}: ${offset}`
            };
          }
          
          // Read pointer
          const pointerValue = memoryjs.readMemory(
            processObject.handle, 
            Number(currentAddress), 
            memoryjs.POINTER
          );
          
          if (!pointerValue) {
            return {
              id: addressConfig.id,
              index: addressConfig.index,
              success: false,
              error: `Null pointer encountered at offset index ${i}`
            };
          }
          
          // Calculate next address
          currentAddress = BigInt(pointerValue) + offsetValue;
          resolvedPointers.push(Number(currentAddress));
        }
        
        finalAddress = currentAddress;
      }
      // Module + offset
      else if (addressConfig.useModuleOffset) {
        // IMPROVED: Additional validation for module+offset with detailed error
        if (!addressConfig.moduleName) {
          return {
            id: addressConfig.id,
            index: addressConfig.index,
            success: false,
            error: `Module name is missing for module+offset address (id: ${addressConfig.id || 'unknown'})`
          };
        }
        
        if (!addressConfig.offset) {
          return {
            id: addressConfig.id,
            index: addressConfig.index,
            success: false,
            error: `Offset is missing for module+offset address (moduleName: ${addressConfig.moduleName}, id: ${addressConfig.id || 'unknown'})`
          };
        }
        
        // Find module
        const moduleInfo = findModule(processObject, addressConfig.moduleName);
        
        if (!moduleInfo) {
          return {
            id: addressConfig.id,
            index: addressConfig.index,
            success: false,
            error: `Module ${addressConfig.moduleName} not found in process ${processName}`
          };
        }
        
        // IMPROVED: Safer offset parsing with error handling
        try {
          // Parse offset based on format
          const offsetValue = addressConfig.offsetFormat === 'hex'
            ? BigInt(addressConfig.offset.startsWith('0x') ? addressConfig.offset : `0x${addressConfig.offset}`)
            : BigInt(parseInt(addressConfig.offset, 10));
          
          finalAddress = BigInt(moduleInfo.modBaseAddr) + offsetValue;
        } catch (offsetError) {
          return {
            id: addressConfig.id,
            index: addressConfig.index,
            success: false,
            error: `Failed to parse offset "${addressConfig.offset}" for module ${addressConfig.moduleName}: ${offsetError.message}`
          };
        }
      }
      // Direct address
      else {
        try {
          finalAddress = BigInt(addressConfig.address);
        } catch (addressError) {
          return {
            id: addressConfig.id,
            index: addressConfig.index,
            success: false,
            error: `Failed to convert address "${addressConfig.address}" to BigInt: ${addressError.message}`
          };
        }
      }
      
      // Validate address
      if (finalAddress === null || finalAddress === undefined || finalAddress < BigInt(0x10000)) {
        return {
          id: addressConfig.id,
          index: addressConfig.index,
          success: false,
          error: `Invalid memory address: 0x${finalAddress?.toString(16) || '0'}`
        };
      }
      
      // Get memory type
      const memoryjsType = getMemoryjsType(addressConfig.type || 'Int32');
      
      // Read memory
      let value = memoryjs.readMemory(
        processObject.handle, 
        Number(finalAddress), 
        memoryjsType
      );
      
      // Apply bitwise operations
      const { bitmask, bitwiseOp, bitfield } = addressConfig;
      
      if (bitmask && bitwiseOp) {
        value = applyBitwiseOperation(value, bitmask, bitwiseOp);
      }
      
      if (bitfield && bitmask) {
        try {
          const maskInt = typeof bitmask === 'string'
            ? parseInt(bitmask, bitmask.startsWith('0x') ? 16 : 10)
            : bitmask;
    
          // Calculate bit shift
          let shift = 0;
          let temp = maskInt;
          while ((temp & 1) === 0 && shift < 32) {
            temp >>= 1;
            shift++;
          }
    
          value = (value & maskInt) >> shift;
        } catch (err) {
          // Silently continue with unshifted value
        }
      }
      
      // Increment reads counter
      readsProcessed++;
      
      // Return successful result
      return {
        id: addressConfig.id,
        index: addressConfig.index,
        success: true,
        value,
        resolvedAddress: finalAddress,
        resolvedPointers,
        error: null
      };
      
    } catch (error) {
      return {
        id: addressConfig.id,
        index: addressConfig.index,
        success: false,
        error: `Address resolution failed: ${error.message}`
      };
    }
  } catch (error) {
    return {
      id: addressConfig.id,
      index: addressConfig.index,
      success: false,
      error: `Memory read failed: ${error.message}`
    };
  }
}

/**
 * Process a batch of memory read requests
 * @param {string} processName - Process name
 * @param {Array} addresses - Array of address objects
 * @returns {Array} Array of memory read results
 */
function processMemoryBatch(processName, addresses) {
  const results = [];
  
  for (const addr of addresses) {
    // NEW: Ensure we have a clean copy to work with
    const addressCopy = { ...addr };
    
    // NEW: Fix common issues before proceeding
    if (addressCopy.useModuleOffset && (!addressCopy.moduleName || addressCopy.moduleName.trim() === '')) {
      // Default to processName if moduleName is missing
      addressCopy.moduleName = processName;
    }
    
    // Ensure offset is normalized for module-relative addresses
    if (addressCopy.useModuleOffset && addressCopy.offset && !addressCopy.offset.trim()) {
      addressCopy.offset = addressCopy.address;
    }
    
    const result = readMemory(processName, addressCopy);
    results.push(result);
  }
  
  return results;
}

// Listen for messages from the main thread
parentPort.on('message', (message) => {
  try {
    if (message.type === 'read_batch') {
      const { processName, addresses, workerId } = message;
      
      // Process the batch
      const results = processMemoryBatch(processName, addresses);
      
      // Send results back to main thread
      parentPort.postMessage({
        type: 'result',
        workerId,
        results,
        metrics: {
          readsProcessed,
          readDuration: Date.now() - startTime,
          moduleBaseCacheSize: moduleBaseCache.size
        }
      });
      
      // Reset metrics
      startTime = Date.now();
    }
    else if (message.type === 'terminate') {
      // Clean up resources
      moduleBaseCache.clear();
      processHandle = null;
      
      // Exit gracefully
      process.exit(0);
    }
  } catch (error) {
    // Send error back to main thread
    parentPort.postMessage({
      type: 'error',
      error: error.message || 'Unknown worker error'
    });
  }
});

// Notify main thread that worker is ready
parentPort.postMessage({ type: 'ready' });
