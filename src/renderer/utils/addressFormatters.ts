
import { MemoryAddress } from "@/types/memoryAddress";

/**
 * Returns a formatted address string for display
 */
export function getFormattedAddress(addr: MemoryAddress): string {
  if (addr.useModuleOffset && addr.moduleName) {
    // Use offset value if available
    const offsetValue = addr.offset || '';
    return `${addr.moduleName}+${offsetValue}`;
  }
  return addr.address || "—";
}

/**
 * Checks if an address has a pointer chain
 */
export function hasPointerChain(addr: MemoryAddress): boolean {
  return Array.isArray(addr.offsets) && addr.offsets.length > 0;
}

/**
 * Renders a value or error message for display
 * Returns a string representation instead of JSX
 */
export function renderValueOrError(addr: MemoryAddress, valueType: 'raw' | 'final'): string {
  if (addr.error) {
    return addr.error;
  }
  if (addr.success === false) {
    return "Failed to read memory";
  }
  const value = valueType === 'raw' ? addr.rawValue : addr.finalValue;
  return value !== null ? value.toString() : "—";
}

/**
 * Gets a summary of a pointer chain for display
 * Returns a string representation instead of JSX
 */
export function getPointerChainSummary(
  usePointerChain: boolean,
  offsets: string[],
  baseAddress: string
): string | null {
  if (!usePointerChain || !offsets || offsets.length === 0) return null;
  return `${baseAddress} → [${offsets.join(' → ')}]`;
}

/**
 * Get correct address format for display based on module and offset settings
 */
export function getCorrectAddressFormat(addr: MemoryAddress): string {
  if (!addr) return "—";
  
  if (addr.useModuleOffset && addr.moduleName) {
    const offsetValue = addr.offset || '';
    return `${addr.moduleName}+${offsetValue}`;
  } else {
    return addr.address || "—";
  }
}

/**
 * Logs important address information for debugging
 */
export function logAddressInfo(addr: MemoryAddress, label: string = "Address"): void {
//  console.log(`${label}: ${addr.label || "Unnamed"}`, {
//    useModuleOffset: addr.useModuleOffset,
//    moduleName: addr.moduleName,
//    offset: addr.offset,
//    address: addr.address,
//    type: addr.type
//  });
}
