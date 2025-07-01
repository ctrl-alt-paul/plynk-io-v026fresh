
import { MemoryProfileOutput } from "@/types/memoryProfiles";

/**
 * Formats a memory address with module name, offset, and bitmask (if available)
 */
export function formatMemoryAddress(output: MemoryProfileOutput): string {
  if (!output) return "—";

  let formattedAddress = "";
  
  // Add module+offset format if available
  if (output.useModuleOffset && output.moduleName && output.offset) {
    formattedAddress = `${output.moduleName}+${output.offset}`;
  } else if (output.address) {
    formattedAddress = output.address;
  } else {
    formattedAddress = "—";
  }
  
  // Add bitmask if available
  if (output.bitmask && output.bitfield) {
    formattedAddress += ` [${output.bitmask}]`;
  }
  
  // Add pointer chain if available
  if (output.isPointerChain && Array.isArray(output.offsets) && output.offsets.length > 0) {
    formattedAddress += ` → [${output.offsets.join(' → ')}]`;
  }
  
  return formattedAddress;
}
