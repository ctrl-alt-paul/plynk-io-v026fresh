
const memoryjs = require('memoryjs');
const { logToFile } = require('./logger');

// Memory type mapping
const MEMORY_TYPES = {
  'Int32': memoryjs.INT32,
  'Int16': memoryjs.INT16,
  'Int8': memoryjs.INT8,
  'Float': memoryjs.FLOAT,
  'Double': memoryjs.DOUBLE,
  'Byte': memoryjs.BYTE,
  'CustomSize': memoryjs.INT32 // Default to INT32 for custom sizes
};

// Flag to track if we've shown the process warning
let processWarningShown = false;

// ───────────────────────── NEW: Non-blocking process scan
function processExists(processName) {
  return new Promise((resolve) => {
    if (!processName) return resolve(false);

    memoryjs.getProcesses((err, list) => {
      if (err) {
        logToFile(`[ERROR] getProcesses failed: ${err.message}`);
        return resolve(false);
      }
      const found = list.some(
        p => p.szExeFile.toLowerCase() === processName.toLowerCase()
      );
      resolve(found);
    });
  });
}

// Helper to get memoryjs type constant
function getMemoryjsType(type) {
  const mappedType = MEMORY_TYPES[type];
  if (!mappedType) {
    throw new Error(`Unsupported memory type: ${type}`);
  }
  return mappedType;
}

// Function to check if a process is running with enhanced error handling
async function isProcessRunning(processName) {
  if (!processName) {
    logToFile('Process name is empty');
    return false;
  }
  
  try {
    return await processExists(processName);
  } catch (error) {
    logToFile(`Failed to check if process is running: ${error.message}`);
    return false;
  }
}

// Helper to parse address string into components
function parseAddressString(addressString) {
  try {
    if (typeof addressString === 'string' && addressString.includes('+')) {
      const [moduleName, offsetString] = addressString.split('+').map(part => part.trim());
      if (!moduleName) throw new Error('Module name is empty');
      
      const offset = offsetString.startsWith('0x') 
        ? BigInt(offsetString) 
        : BigInt(parseInt(offsetString, 10));
        
      return {
        type: 'module_offset',
        moduleName,
        offset
      };
    } else {
      return {
        type: 'direct',
        address: parseAddressInput(addressString)
      };
    }
  } catch (error) {
    throw new Error(`Invalid address format: ${error.message}`);
  }
}

// Parse address string to BigInt, handling both hex and decimal formats with enhanced error handling
function parseAddressInput(addressString, format = 'hex') {
  if (!addressString) {
    logToFile('Address string is empty');
    return null;
  }
  
  try {
    // If format is explicitly set to hex
    if (format === 'hex') {
      // Handle with or without 0x prefix
      const normalized = addressString.toLowerCase().startsWith('0x')
        ? addressString
        : `0x${addressString}`;
      return BigInt(normalized);
    }
    // If format is decimal
    else if (format === 'decimal') {
      return BigInt(parseInt(addressString, 10));
    }
    // Try auto-detection (legacy support)
    else {
      // Check if it's a hex string with 0x prefix
      if (typeof addressString === 'string' && addressString.toLowerCase().startsWith('0x')) {
        return BigInt(addressString);
      }
      // Otherwise, try parsing as decimal
      return BigInt(addressString);
    }
  } catch (error) {
    // Explicitly log parsing errors
    logToFile(`Failed to parse address "${addressString}" as ${format}: ${error.message}`);
    return null;
  }
}

// Find and return module base address without performing a memory read
async function findModuleBaseAddress(processName, moduleName) {
  if (!processName || !moduleName) {
    return {
      success: false,
      error: "Process name and module name are required"
    };
  }
  
  try {
    logToFile(`Looking for module '${moduleName}' in process '${processName}'`);
    
    const processList = memoryjs.getProcesses();
    const match = processList.find(p => p.szExeFile.toLowerCase() === processName.toLowerCase());
    
    if (!match) {
      return {
        success: false,
        error: `Process '${processName}' not found (case-insensitive)`
      };
    }

    const processObject = memoryjs.openProcess(match.szExeFile);
    if (!processObject) {
      throw new Error(`Failed to get handle for process ${processName}`);
    }
    
    const moduleNameLower = moduleName.toLowerCase();
    const modules = memoryjs.getModules(processObject.th32ProcessID);
    
    const moduleInfo = modules.find(mod => 
      mod.szModule.toLowerCase() === moduleNameLower || 
      mod.name?.toLowerCase() === moduleNameLower
    );
    
    if (!moduleInfo) {
      throw new Error(`Module ${moduleName} not found in process ${processName}`);
    }
    
    logToFile(`Found module '${moduleName}' base address: 0x${moduleInfo.modBaseAddr.toString(16)}`);
    
    return {
      success: true,
      baseAddress: moduleInfo.modBaseAddr,
      baseAddressHex: `0x${moduleInfo.modBaseAddr.toString(16).toUpperCase()}`
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to find module ${moduleName}: ${error.message}`
    };
  }
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
      case "XOR":
        return value ^ mask;
      case "NOT":
        return ~value;
      default:
        return value;
    }
  } catch (error) {
    logToFile(`Error applying bitwise operation: ${error.message}`);
    return value;
  }
}

// Enhanced readRealMemory with support for direct absolute addresses or module+offset
// and case-insensitive module matching
async function readRealMemory(processName, addressInput, type) {
  try {
    // Get process handle for memory reading
    const processList = memoryjs.getProcesses();
    const match = processList.find(p => p.szExeFile.toLowerCase() === processName.toLowerCase());
    
    if (!match) {
      return {
        success: false,
        error: `Process '${processName}' not found (case-insensitive)`
      };
    }
    
    const processObject = memoryjs.openProcess(match.szExeFile);

    if (!processObject) {
      throw new Error(`Failed to get handle for process ${processName}`);
    }
    
    // Calculate the final memory address to read from
    let finalAddress;
    
    try {
      // Check if we have a pointer chain to follow
      if (typeof addressInput === 'object' && addressInput !== null && Array.isArray(addressInput.offsets) && addressInput.offsets.length > 0) {
        // Initialize with base address calculation
        let currentAddress;
        
        // NEW: If this address was already resolved and passed in directly, use it
        if (addressInput.resolvedFromCache && addressInput.address) {
          // OPTIMIZATION: Skip the pointer chain traversal completely
          finalAddress = BigInt(addressInput.address);
        }
        else if (addressInput.useModuleOffset) {
          // Find module and calculate base address
          const modules = memoryjs.getModules(processObject.th32ProcessID);
          const moduleNameLower = addressInput.moduleName.toLowerCase();
          
          const moduleInfo = modules.find(mod => 
            mod.szModule.toLowerCase() === moduleNameLower || 
            mod.name?.toLowerCase() === moduleNameLower
          );
          
          if (!moduleInfo) {
            throw new Error(`Module ${addressInput.moduleName} not found in process ${processName}`);
          }
          
          // Parse offset based on format
          const offsetValue = addressInput.offsetFormat === 'hex'
            ? BigInt(addressInput.offset.startsWith('0x') ? addressInput.offset : `0x${addressInput.offset}`)
            : BigInt(parseInt(addressInput.offset, 10));
            
          currentAddress = BigInt(moduleInfo.modBaseAddr) + offsetValue;
          
          // Store the original pointer for caching later
          const originalPointer = currentAddress;
          
          // Follow the pointer chain, reading each level
          for (let i = 0; i < addressInput.offsets.length; i++) {
            const offset = addressInput.offsets[i];
            
            // Parse the offset string to a number
            let offsetValue;
            try {
              offsetValue = BigInt(offset.toString().startsWith('0x') 
                ? offset.toString()
                : `0x${offset.toString()}`);
            } catch (error) {
              throw new Error(`Invalid offset format at index ${i}: ${offset}`);
            }
            
            // Read the address at the current pointer
            const pointerValue = memoryjs.readMemory(processObject.handle, Number(currentAddress), memoryjs.POINTER);
            
            // If this is null, the pointer chain is broken
            if (pointerValue === 0 || pointerValue === null) {
              throw new Error(`Null pointer encountered at offset index ${i}`);
            }
            
            logToFile(`Pointer at 0x${currentAddress.toString(16)} -> 0x${pointerValue.toString(16)}`);
            
            // Calculate the next address by adding the offset
            currentAddress = BigInt(pointerValue) + offsetValue;
            
            logToFile(`After adding offset ${offset} -> 0x${currentAddress.toString(16)}`);
          }
          
          // The final address after traversing the pointer chain
          finalAddress = currentAddress;
        } 
        else {
          // Direct base address
          currentAddress = parseAddressInput(addressInput.address);
          
          if (currentAddress === null || currentAddress === undefined) {
            throw new Error("Failed to calculate base pointer address");
          }
          
          logToFile(`Starting pointer chain from base address: 0x${currentAddress.toString(16)}`);
          
          // Follow the pointer chain, reading each level
          for (let i = 0; i < addressInput.offsets.length; i++) {
            const offset = addressInput.offsets[i];
            
            // Parse the offset string to a number
            let offsetValue;
            try {
              offsetValue = BigInt(offset.toString().startsWith('0x') 
                ? offset.toString()
                : `0x${offset.toString()}`);
            } catch (error) {
              throw new Error(`Invalid offset format at index ${i}: ${offset}`);
            }
            
            // Read the address at the current pointer
            const pointerValue = memoryjs.readMemory(processObject.handle, Number(currentAddress), memoryjs.POINTER);
            
            // If this is null, the pointer chain is broken
            if (pointerValue === 0 || pointerValue === null) {
              throw new Error(`Null pointer encountered at offset index ${i}`);
            }
            
            logToFile(`Pointer at 0x${currentAddress.toString(16)} -> 0x${pointerValue.toString(16)}`);
            
            // Calculate the next address by adding the offset
            currentAddress = BigInt(pointerValue) + offsetValue;
            
            logToFile(`After adding offset ${offset} -> 0x${currentAddress.toString(16)}`);
          }
          
          // The final address after traversing the pointer chain
          finalAddress = currentAddress;
        }
      }
      // OPTIMIZATION: Check if addressInput is already a number (pre-calculated absolute address)
      else if (typeof addressInput === 'number' || typeof addressInput === 'bigint') {
        // Use the pre-calculated address directly (fastest path)
        finalAddress = BigInt(addressInput);
        
        logToFile(`Using pre-calculated absolute address: 0x${finalAddress.toString(16)}`);
      } 
      else if (typeof addressInput === 'object' && addressInput !== null) {
        // Handle structured object format with module+offset
        if (addressInput.resolvedFromCache && addressInput.address) {
          // OPTIMIZATION: Use the pre-resolved address directly
          finalAddress = BigInt(addressInput.address);
        }
        else if (addressInput.address) {
          // Use the direct address
          finalAddress = parseAddressInput(addressInput.address);
        }
        else {
          // Module+offset address
          const { moduleName, offset, offsetFormat } = addressInput;
          if (!moduleName || !offset) {
            throw new Error('Module name and offset are required');
          }
          
          // Find the module with CASE-INSENSITIVE matching
          const modules = memoryjs.getModules(processObject.th32ProcessID);
          const moduleNameLower = moduleName.toLowerCase();
          
          const moduleInfo = modules.find(mod => 
            mod.szModule.toLowerCase() === moduleNameLower || 
            mod.name?.toLowerCase() === moduleNameLower
          );
          
          if (!moduleInfo) {
            throw new Error(`Module ${moduleName} not found in process ${processName}`);
          }
          
          // Parse offset based on format
          const offsetValue = offsetFormat === 'hex'
            ? BigInt(offset.startsWith('0x') ? offset : `0x${offset}`)
            : BigInt(parseInt(offset, 10));
            
          finalAddress = BigInt(moduleInfo.modBaseAddr) + offsetValue;
          
          logToFile(`Resolved ${moduleName}+${offset} to address 0x${finalAddress.toString(16)}`);
        }
      } else {
        // Handle string format (backward compatibility)
        const parsedAddress = parseAddressString(addressInput);
        
        if (parsedAddress.type === 'module_offset') {
          // Find module with CASE-INSENSITIVE matching and calculate address
          const modules = memoryjs.getModules(processObject.th32ProcessID);
          const moduleNameLower = parsedAddress.moduleName.toLowerCase();
          
          const moduleInfo = modules.find(mod => 
            mod.szModule.toLowerCase() === moduleNameLower ||
            mod.name?.toLowerCase() === moduleNameLower
          );
          
          if (!moduleInfo) {
            throw new Error(`Module ${parsedAddress.moduleName} not found in process ${processName}`);
          }
          finalAddress = BigInt(moduleInfo.modBaseAddr) + parsedAddress.offset;
        } else {
          finalAddress = parsedAddress.address;
        }
      }
      
      // Validate final address
      if (finalAddress === null || finalAddress < BigInt(0x10000)) {
        return {
          success: false,
          error: `Invalid memory address: 0x${finalAddress?.toString(16) || '0'}`,
          value: null
        };
      }
      
      // Get proper memoryjs type constant
      const memoryjsType = getMemoryjsType(type);
      
      // Perform the actual memory read
      try {
        let value = memoryjs.readMemory(processObject.handle, Number(finalAddress), memoryjsType);
        
        logToFile(`Memory read at 0x${finalAddress.toString(16)}: ${value}`);
        
        // Apply bitwise operations if specified in addressInput
        if (typeof addressInput === 'object' && addressInput !== null) {
          const { bitmask, bitwiseOp, bitfield } = addressInput;
        
          if (bitmask && bitwiseOp) {
            const originalValue = value;
            value = applyBitwiseOperation(value, bitmask, bitwiseOp);
            logToFile(`Applied ${bitwiseOp} with mask ${bitmask}: ${originalValue} -> ${value}`);
          }
        
          if (bitfield && bitmask) {
            try {
              const maskInt = typeof bitmask === 'string'
                ? parseInt(bitmask, bitmask.startsWith('0x') ? 16 : 10)
                : bitmask;
        
              // Calculate how many bits to shift to align the lowest bit of the mask
              let shift = 0;
              let temp = maskInt;
              while ((temp & 1) === 0 && shift < 32) {
                temp >>= 1;
                shift++;
              }
        
              const originalValue = value;
              value = (value & maskInt) >> shift;
              logToFile(`Applied bitfield extraction with mask ${bitmask}, shift ${shift}: ${originalValue} -> ${value}`);
            } catch (err) {
              logToFile(`Bitfield extraction failed: ${err.message}`);
            }
          }
        }
        
        return {
          success: true,
          value: value,
          error: null,
          // Add the resolved address to the result to support caching
          resolvedAddress: finalAddress
        };
        
      } catch (readError) {
        throw new Error(`Memory read failed: ${readError.message}`);
      }
      
    } catch (error) {
      return {
        success: false,
        error: `Address resolution failed: ${error.message}`,
        value: null
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      value: null
    };
  }
}

module.exports = {
  readRealMemory,
  isProcessRunning,
  findModuleBaseAddress,
  applyBitwiseOperation
};
