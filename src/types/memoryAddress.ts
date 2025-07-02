/**
 * Interface for memory address data
 */
export interface MemoryAddress {
  id: string;
  label: string;
  moduleName: string;
  address: string;
  type: string;
  value: number | null;
  rawValue: number | null;
  finalValue: string | number | null;
  lastRead: Date | null;
  useModuleOffset: boolean;
  offset: string;
  offsetFormat: "hex" | "decimal";
  customSize?: number;
  error?: string;
  success?: boolean;
  invert: boolean;
  format: string;
  script: string;
  notes: string; // Added notes property to fix TypeScript errors
  offsets: string[]; // Made required to match MemoryProfileOutput
  bitmask?: string;
  bitwiseOp?: "AND" | "OR" | "XOR" | "NOT" | ""; 
  bitfield?: boolean;
  isPointerChain?: boolean;
  disableCaching?: boolean; // Controls whether memory reads use caching
  fastModeEnabled?: boolean; // Enables high-performance reading
  priority?: "high" | "normal" | "low"; // Priority level for memory reading operations
  refreshInterval?: number; // Custom refresh interval in milliseconds
  batchGroup?: string; // Group identifier for batch processing
  source?: "user" | "profile" | "community"; // Track the origin of the memory address
}

/**
 * Interface for new memory address data before it's added to the list
 */
export type NewMemoryAddress = Omit<
  MemoryAddress, 
  'id' | 'value' | 'lastRead' | 'error' | 'success' | 'rawValue' | 'finalValue'
>;

/**
 * Types for memory values
 */
export const memoryTypes = ["Int8", "Int16", "Int32", "Float", "Double", "Byte", "CustomSize"];

/**
 * Available bitwise operations
 */
export const bitwiseOperations = ["AND", "OR", "XOR", "NOT", ""] as const;

/**
 * Examples of transform operations
 */
export const exampleTransformations = [
  {
    script: "-value",
    format: "",
    rawValue: 4000.34,
    outcome: "-4000.34"
  }, 
  {
    script: "Math.round(value)",
    format: "",
    rawValue: 4000.34,
    outcome: "4000"
  }, 
  {
    script: "value * 2",
    format: "0.00",
    rawValue: 4000.34,
    outcome: "8000.68"
  }, 
  {
    script: "value > 1000 ? 1 : 0",
    format: "",
    rawValue: 4000.34,
    outcome: "1"
  }, 
  {
    script: "value / 10",
    format: "0",
    rawValue: 4000.34,
    outcome: "400"
  }, 
  {
    script: "value + 50",
    format: "0.00",
    rawValue: 4000.34,
    outcome: "4050.34"
  }, 
  {
    script: "Math.floor(value)",
    format: "",
    rawValue: 4000.34,
    outcome: "4000"
  }, 
  {
    script: "value - 100",
    format: "",
    rawValue: 4000.34,
    outcome: "3900.34"
  }, 
  {
    script: "value / 1000",
    format: "0.000",
    rawValue: 4000.34,
    outcome: "4.000"
  }, 
  {
    script: "value",
    format: "RPM={value}",
    rawValue: 4000.34,
    outcome: "RPM=4000.34"
  }
];

/**
 * Interface for process information
 */
export interface Process {
  name: string;
  pid: number;
  cmd: string;
}

/**
 * Performance optimization settings
 */
export interface PerformanceSettings {
  disableCaching: boolean;
  fastModeEnabled: boolean;
  batchSize: number; // Maximum number of addresses to read in a single batch
  priorityThrottling: boolean; // Whether to throttle low priority reads
  adaptivePolling: boolean; // Whether to adapt polling rates based on system load
}
