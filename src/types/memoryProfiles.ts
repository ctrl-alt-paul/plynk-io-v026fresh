
export interface MemoryProfileOutput {
  label: string;
  type: string;
  address: string;
  notes: string;
  invert: boolean;
  format: string;
  script: string;
  /**
   * Indicates if the address is module-relative
   */
  useModuleOffset: boolean;
  /**
   * The module name for module-relative addresses (only used when useModuleOffset is true)
   * This property belongs at the output level only, never at the root level
   */
  moduleName: string;
  /**
   * The offset value for module-relative addresses (only used when useModuleOffset is true)
   * This may be the same as address in some cases, or a separately specified value
   */
  offset?: string;
  offsets: string[];
  pollInterval?: number;
  bitmask?: string;
  bitwiseOp?: "AND" | "OR" | "XOR" | "NOT" | ""; 
  bitfield?: boolean;
  isPointerChain?: boolean;
  /**
   * Track the origin of the memory address output
   */
  source?: "user" | "profile" | "community";
}

export interface MemoryProfile {
  id: string;
  fileName: string;
  /**
   * The process name associated with this memory profile (e.g. "game.exe")
   * This field MUST always be used at the root level to specify which process to connect to.
   * The 'moduleName' field should NEVER be used at the root level.
   */
  process: string;
  pollInterval: number;
  outputs: MemoryProfileOutput[];
  content?: string;
  outputCount?: number;
  lastModified?: number;
  usedByGameProfiles?: string[]; // Names of game profiles using this memory profile
  /**
   * The type of memory profile - 'default' for built-in profiles, 'user' for user-created profiles, 'community' for community profiles
   */
  memoryProfileType?: 'default' | 'user' | 'community';
  /**
   * Metadata for community submissions
   */
  _meta?: {
    issue: number;
    submittedBy: string;
    submittedAt: string;
    gameVersion?: string;
    emulator?: string;
    globalNotes?: string;
  };
}
