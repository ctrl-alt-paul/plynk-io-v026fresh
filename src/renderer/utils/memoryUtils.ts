
import { MemoryAddress } from "@/types/memoryAddress";

/**
 * Checks if the given error message indicates a permanent error that can't be resolved by retrying
 */
export function isPermanentError(error: string): boolean {
  if (!error) return false;
  const permanentErrorPatterns = [
    "process not found", 
    "invalid address", 
    "access denied", 
    "process handle", 
    "module not found", 
    "memory access violation"
  ];
  return permanentErrorPatterns.some(pattern => 
    error.toLowerCase().includes(pattern.toLowerCase())
  );
}

// Cache for script functions to avoid repeated parsing
const scriptFunctionCache = new Map<string, Function>();

/**
 * Safely evaluates a JavaScript expression with the given value
 * Uses a cache to improve performance for repeated script evaluations
 */
export function safeEvaluate(script: string, value: number): any {
  if (!script || script.trim() === '') {
    return value;
  }
  
  try {
    // Check cache first
    if (!scriptFunctionCache.has(script)) {
      // This requires 'unsafe-eval' in CSP
      const scriptFn = new Function('value', `return ${script}`);
      scriptFunctionCache.set(script, scriptFn);
    }
    
    // Get from cache and execute
    const cachedFn = scriptFunctionCache.get(script);
    if (cachedFn) {
      return cachedFn(value);
    }
    
    return value;
  } catch (error) {
    //console.error('Script evaluation error:', error);
    return null;
  }
}

/**
 * Applies transformations to raw memory values with improved null/undefined handling
 * @param value The raw value from memory
 * @param invert Whether to invert the value
 * @param script Optional transformation script
 * @param format Optional formatting string
 * @returns The transformed value
 */
export function applyTransformations(
  value: number | null | string | undefined, 
  invert: boolean = false, 
  script: string = '', 
  format: string = ''
): string | number | null {
  // Return null early if value is null or undefined
  if (value === null || value === undefined) return null;
  
  let numericValue: number;
  if (typeof value === 'string') {
    numericValue = parseFloat(value);
    if (isNaN(numericValue)) return value;
  } else {
    numericValue = value;
  }
  
  if (invert) {
    numericValue = -numericValue;
  }
  
  if (script && script.trim() !== '') {
    try {
      // Use the cached evaluation function
      const scriptResult = safeEvaluate(script, numericValue);
      if (typeof scriptResult === 'number') {
        numericValue = scriptResult;
      } else if (scriptResult !== undefined && scriptResult !== null) {
        // Make sure we return a string and not an object that might cause toString errors
        return String(scriptResult);
      }
    } catch (error) {
      //console.error('Script evaluation error:', error);
    }
  }
  
  if (format && format.trim() !== '') {
    try {
      if (format.includes('{value}')) {
        // Safely convert numericValue to string
        const valueStr = numericValue !== null && numericValue !== undefined 
          ? String(numericValue)
          : '';
        return format.replace(/\{value\}/g, valueStr);
      } else {
        const decimalPlaces = (format.match(/0/g) || []).length - 1;
        if (decimalPlaces >= 0) {
          return numericValue.toFixed(Math.max(0, decimalPlaces));
        }
      }
    } catch (error) {
      //console.error('Format error:', error);
      return String(numericValue);
    }
  }
  
  return numericValue;
}

/**
 * Omits specified keys from an object
 */
export const omit = (obj: any, keys: string[]) => {
  const clone = { ...obj };
  for (const key of keys) delete clone[key];
  return clone;
};

/**
 * Validates bitwise operation string against allowed values
 */
export function validateBitwiseOp(operation: string | undefined): "AND" | "OR" | "XOR" | "NOT" | "" {
  if (!operation) return "";
  
  const validOperations = ["AND", "OR", "XOR", "NOT", ""];
  return validOperations.includes(operation) ? 
    operation as "AND" | "OR" | "XOR" | "NOT" | "" : 
    "";
}

/**
 * Parses an offset string to a number with improved error handling
 */
export const parseOffset = (offset: string, format: "hex" | "decimal"): number | null => {
  if (!offset || !offset.trim()) return null;
  
  try {
    if (format === "hex") {
      // Handle hex format with or without 0x prefix
      const hexValue = offset.toLowerCase().replace(/^0x/i, "");
      if (!/^[0-9a-f]+$/i.test(hexValue)) {
        //console.warn(`Invalid hex value: ${offset}`);
        return null;
      }
      return parseInt(hexValue, 16);
    } else {
      // Handle decimal format
      if (!/^\d+$/.test(offset)) {
        //console.warn(`Invalid decimal value: ${offset}`);
        return null;
      }
      return parseInt(offset, 10);
    }
  } catch (error) {
    //console.error(`Error parsing offset ${offset} as ${format}:`, error);
    return null;
  }
};

/**
 * Checks if a memory address configuration is valid
 */
export const isValidMemoryAddress = (address: Partial<MemoryAddress>): boolean => {
  // Address must have either a direct address or a module offset
  if (!address.useModuleOffset && (!address.address || address.address.trim() === '')) {
    return false;
  }
  
  if (address.useModuleOffset) {
    // For module+offset, need both moduleName and offset
    if (!address.moduleName || address.moduleName.trim() === '') {
      return false;
    }
    
    if (!address.offset || address.offset.trim() === '') {
      return false;
    }
    
    // Validate offset format
    const offsetValue = parseOffset(address.offset, address.offsetFormat || 'hex');
    if (offsetValue === null) {
      return false;
    }
  }
  
  return true;
};

/**
 * More thorough address validation that specifically checks for values that would cause
 * BigInt conversion errors in the memory reader
 */
export const isValidAddressForMemoryReading = (address: Partial<MemoryAddress>): { isValid: boolean; error?: string } => {
  // First do basic validation
  if (!isValidMemoryAddress(address)) {
    // Provide more specific error messages based on what's missing
    if (address.useModuleOffset) {
      if (!address.moduleName || address.moduleName.trim() === '') {
        return { isValid: false, error: "Module name is required when using module offset" };
      }
      
      if (!address.offset || address.offset.trim() === '') {
        return { isValid: false, error: "Offset is required when using module offset" };
      }
      
      const offsetValue = parseOffset(address.offset, address.offsetFormat || 'hex');
      if (offsetValue === null) {
        return { isValid: false, error: `Invalid offset format: '${address.offset}'` };
      }
    } else {
      if (!address.address || address.address.trim() === '') {
        return { isValid: false, error: "Direct address is required when not using module offset" };
      }
    }
    
    return { isValid: false, error: "Address configuration is incomplete" };
  }
  
  // Specific validation for direct addresses
  if (!address.useModuleOffset) {
    if (!address.address) {
      return { isValid: false, error: "Direct address is required when not using module offset" };
    }
    
    try {
      // Try to parse as BigInt to catch any conversion issues early
      // Handle hex format with or without 0x prefix
      const cleanedAddress = address.address.toLowerCase().trim();
      const isHex = cleanedAddress.startsWith('0x');
      
      if (isHex) {
        BigInt(cleanedAddress);
      } else if (/^[0-9a-f]+$/i.test(cleanedAddress)) {
        // Looks like hex without prefix
        BigInt(`0x${cleanedAddress}`);
      } else {
        // Try as decimal
        BigInt(parseInt(cleanedAddress, 10));
      }
    } catch (error) {
      return { 
        isValid: false, 
        error: `Invalid address format: ${error instanceof Error ? error.message : 'Cannot convert to BigInt'}`
      };
    }
  }
  
  // Specific validation for module offsets
  if (address.useModuleOffset) {
    if (!address.moduleName || address.moduleName.trim() === '') {
      return { isValid: false, error: "Module name is required when using module offset" };
    }
    
    if (!address.offset || address.offset.trim() === '') {
      return { isValid: false, error: "Offset is required when using module offset" };
    }
    
    try {
      // Try to parse offset as BigInt to catch conversion issues
      const cleanedOffset = address.offset.toLowerCase().trim();
      if (address.offsetFormat === 'hex' || cleanedOffset.startsWith('0x')) {
        const hexOffset = cleanedOffset.startsWith('0x') ? cleanedOffset : `0x${cleanedOffset}`;
        BigInt(hexOffset);
      } else {
        BigInt(parseInt(cleanedOffset, 10));
      }
    } catch (error) {
      return { 
        isValid: false, 
        error: `Invalid offset format: ${error instanceof Error ? error.message : 'Cannot convert to BigInt'}`
      };
    }
  }
  
  // Validate pointer chain offsets if present
  if (address.offsets && address.offsets.length > 0) {
    for (let i = 0; i < address.offsets.length; i++) {
      const offset = address.offsets[i];
      try {
        // Try to parse as BigInt
        const cleanedOffset = offset.toLowerCase().trim();
        if (cleanedOffset.startsWith('0x')) {
          BigInt(cleanedOffset);
        } else {
          BigInt(`0x${cleanedOffset}`);
        }
      } catch (error) {
        return { 
          isValid: false, 
          error: `Invalid pointer chain offset at position ${i}: ${error instanceof Error ? error.message : 'Cannot convert to BigInt'}`
        };
      }
    }
  }
  
  // All validations passed
  return { isValid: true };
};

/**
 * Prepare a memory address for safe use with the Electron back-end
 * Ensures all required fields are present and properly formatted
 */
export function prepareAddressForMemoryReading(address: Partial<MemoryAddress>, defaultModuleName: string = ""): {
  preparedAddress: any;
  isValid: boolean;
  error?: string;
} {
  // Validate address first
  const validation = isValidAddressForMemoryReading(address);
  if (!validation.isValid) {
    return {
      preparedAddress: null,
      isValid: false,
      error: validation.error
    };
  }
  
  try {
    let preparedAddress: any = {};
    
    // Check if this is a pointer chain
    if (address.offsets && address.offsets.length > 0) {
      preparedAddress = {
        moduleName: address.useModuleOffset ? (address.moduleName || defaultModuleName) : undefined, 
        address: !address.useModuleOffset ? address.address : undefined,
        offset: address.offset,
        offsetFormat: address.offsetFormat,
        useModuleOffset: address.useModuleOffset,
        offsets: address.offsets.map(o => o.trim()), // Ensure all offsets are trimmed
        type: address.type,
        bitmask: address.bitmask,
        bitwiseOp: validateBitwiseOp(address.bitwiseOp),
        bitfield: address.bitfield,
        disableCaching: address.disableCaching,
        fastModeEnabled: address.fastModeEnabled,
        priority: address.priority,
        batchGroup: address.batchGroup
      };
      
      // Double check the offsets
      for (const offset of preparedAddress.offsets) {
        if (!offset || offset.trim() === '') {
          return {
            preparedAddress: null,
            isValid: false,
            error: "Empty offset in pointer chain"
          };
        }
      }
    } 
    else if (address.useModuleOffset) {
      // Regular module+offset
      preparedAddress = {
        moduleName: address.moduleName || defaultModuleName,
        offset: address.offset,
        offsetFormat: address.offsetFormat,
        useModuleOffset: true,
        type: address.type,
        bitmask: address.bitmask,
        bitwiseOp: validateBitwiseOp(address.bitwiseOp),
        bitfield: address.bitfield,
        disableCaching: address.disableCaching,
        fastModeEnabled: address.fastModeEnabled,
        priority: address.priority,
        batchGroup: address.batchGroup
      };
      
      // Final checks for module offset mode
      if (!preparedAddress.moduleName || preparedAddress.moduleName.trim() === '') {
        return {
          preparedAddress: null,
          isValid: false,
          error: "Module name is required for module+offset mode"
        };
      }
    } 
    else {
      // Direct address
      preparedAddress = {
        address: address.address,
        useModuleOffset: false,
        type: address.type,
        bitmask: address.bitmask,
        bitwiseOp: validateBitwiseOp(address.bitwiseOp),
        bitfield: address.bitfield,
        disableCaching: address.disableCaching,
        fastModeEnabled: address.fastModeEnabled,
        priority: address.priority,
        batchGroup: address.batchGroup
      };
      
      // Final checks for direct address mode
      if (!preparedAddress.address || preparedAddress.address.trim() === '') {
        return {
          preparedAddress: null,
          isValid: false,
          error: "Direct address cannot be empty"
        };
      }
    }
    
    return {
      preparedAddress,
      isValid: true
    };
  } catch (error) {
    return {
      preparedAddress: null,
      isValid: false,
      error: `Failed to prepare address: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Special validation for pointer chains to ensure they can be processed properly
 */
export function validatePointerChain(
  baseAddress: string | undefined,
  moduleName: string | undefined,
  useModuleOffset: boolean,
  offsets: string[] | undefined
): { isValid: boolean; error?: string } {
  // Must have offsets
  if (!offsets || offsets.length === 0) {
    return { isValid: false, error: "No offsets provided for pointer chain" };
  }
  
  // Check if base address is valid
  if (useModuleOffset) {
    if (!moduleName || moduleName.trim() === '') {
      return { isValid: false, error: "Module name required for pointer chain" };
    }
  } else {
    if (!baseAddress || baseAddress.trim() === '') {
      return { isValid: false, error: "Base address required for pointer chain" };
    }
    
    // Try to parse direct address
    try {
      const cleanedAddress = baseAddress.toLowerCase().trim();
      if (cleanedAddress.startsWith('0x')) {
        BigInt(cleanedAddress);
      } else if (/^[0-9a-f]+$/i.test(cleanedAddress)) {
        BigInt(`0x${cleanedAddress}`);
      } else {
        BigInt(parseInt(cleanedAddress, 10));
      }
    } catch (error) {
      return { 
        isValid: false, 
        error: `Invalid base address format: ${error instanceof Error ? error.message : 'Cannot convert to BigInt'}`
      };
    }
  }
  
  // Validate each offset
  for (let i = 0; i < offsets.length; i++) {
    const offset = offsets[i];
    if (!offset || offset.trim() === '') {
      return { isValid: false, error: `Empty offset at index ${i}` };
    }
    
    try {
      // Try parsing as BigInt to catch issues early
      const cleanedOffset = offset.toLowerCase().trim();
      if (cleanedOffset.startsWith('0x')) {
        BigInt(cleanedOffset);
      } else {
        BigInt(`0x${cleanedOffset}`);
      }
    } catch (error) {
      return { 
        isValid: false, 
        error: `Invalid offset at index ${i}: ${error instanceof Error ? error.message : 'Cannot convert to BigInt'}`
      };
    }
  }
  
  return { isValid: true };
}
