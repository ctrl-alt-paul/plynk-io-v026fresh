
/**
 * Form validation utilities
 */

export const validations = {
  /**
   * Validates that a memory address is in proper hexadecimal format
   */
  isValidHexAddress: (address: string): boolean => {
    if (!address) return false;
    // Must start with 0x and contain only hex characters
    const hexPattern = /^0x[0-9a-fA-F]+$/;
    return hexPattern.test(address);
  },
  
  /**
   * Validates that a format string contains the {value} placeholder
   */
  isValidFormatString: (format: string): boolean => {
    if (!format) return false;
    return format.includes("{value}");
  },
  
  /**
   * Checks if a label is unique within an array of objects with label properties
   */
  isLabelUnique: (label: string, outputs: Array<{label: string}>, currentIndex?: number): boolean => {
    return !outputs.some((output, index) => 
      output.label === label && index !== currentIndex
    );
  },
  
  /**
   * Validates that a poll interval is a reasonable number
   */
  isValidPollInterval: (interval: number): boolean => {
    return !isNaN(interval) && interval >= 10 && interval <= 10000;
  },
  
  /**
   * Validates that an offset string is a valid hexadecimal value
   */
  isValidHexOffset: (offset: string): boolean => {
    if (!offset) return false;
    // Must contain only hex characters, with optional 0x prefix
    const hexPattern = /^(0x)?[0-9a-fA-F]+$/;
    return hexPattern.test(offset);
  },
  
  /**
   * Validates that all offsets in an array are valid hex values
   */
  areOffsetsValid: (offsets: string[]): boolean => {
    if (!offsets || !Array.isArray(offsets)) return true;
    return offsets.every(offset => validations.isValidHexOffset(offset));
  },
  
  /**
   * Formats an offset to consistently use 0x prefix
   */
  formatOffset: (offset: string): string => {
    if (!offset) return '';
    if (offset.toLowerCase().startsWith('0x')) {
      return offset.toLowerCase();
    }
    return `0x${offset.toLowerCase()}`;
  }
};
