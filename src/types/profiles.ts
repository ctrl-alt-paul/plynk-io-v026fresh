
export interface GameProfileOutput {
  label: string;
  type: string;
  address: string;
  /**
   * Message listener key for message-based outputs (e.g., "id_2", "id_3")
   * Use this field for Win32 message outputs, keep address field for memory addresses
   */
  key?: string;
  notes: string;
  device: string;
  channel: number;
  invert: boolean;
  format: string;
  script?: string;
  /**
   * Indicates if the address is module-relative
   */
  useModuleOffset: boolean;
  /**
   * The module name for module-relative addresses (only used when useModuleOffset is true)
   */
  moduleName: string;
  /**
   * The module offset for module-relative addresses (only used when useModuleOffset is true)
   */
  offset?: string;
  offsets?: string[];
  pollInterval?: number;
  lastSyncedWithMemory?: number; // Timestamp of last sync with memory profile
  lastSyncedWithMessage?: number; // Timestamp of last sync with message profile
  bitmask?: string;
  bitwiseOp?: "AND" | "OR" | "XOR" | "NOT" | ""; 
  bitfield?: boolean;
  isPointerChain?: boolean;
  isActive?: boolean;
  /**
   * Stores the WLED profile ID when the device type is WLED
   */
  wledProfileId?: string;
  /**
   * Stores the actual device ID (UUID) of the target output device
   */
  targetDevice?: string;
}

export interface GameProfile {
  id: string;
  processName: string;
  profileName: string;
  memoryFile: string;
  messageFile?: string; // New optional field for Win32 message-based profiles
  messageName?: string; // New field for game name from message profile
  pollInterval: number;
  outputs: GameProfileOutput[];
  isActive: boolean;
  lastModified?: number;
  lastSyncedWithMemory?: number; // Timestamp of last sync with memory profile
  lastSyncedWithMessage?: number; // Timestamp of last sync with message profile
  /**
   * Indicates if the memory profile is a default profile (true) or user profile (false)
   */
  memoryProfileType?: 'default' | 'user' | 'community';
  /**
   * Indicates if the message profile is a default profile (true) or user profile (false)
   */
  messageProfileType?: 'default' | 'user' | 'community';
}
