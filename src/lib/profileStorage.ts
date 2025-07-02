import { GameProfile } from "@/types/profiles";
import { isElectron } from "@/utils/isElectron";
import { MemoryAddress } from "@/types/memoryAddress";
import { MemoryProfile, MemoryProfileOutput } from "@/types/memoryProfiles";
import { MessageProfile } from "@/types/messageProfiles";
import { ElectronAPI } from "@/types/electron";

// Cache for loaded profiles to avoid repeated disk reads
const profileCache = new Map<string, any>();

export const profileStorage = {
  /**
   * List all memory profiles
   */
  listMemoryProfiles: async (): Promise<string[]> => {
    try {
      if (isElectron()) {
        const response = await window.electron.listMemoryProfiles();
        if (response && response.success && response.profiles) {
          return response.profiles;
        } else {
          return [];
        }
      } else {
        // Web version - filter out old index file from localStorage
        const profiles = localStorage.getItem("memoryProfiles");
        if (!profiles) return [];
        
        const parsedProfiles = JSON.parse(profiles);
        // Filter out the old index file if it somehow got into localStorage
        return Array.isArray(parsedProfiles) 
          ? parsedProfiles.filter(profile => profile !== 'memoryProfiles.json')
          : [];
      }
    } catch (error) {
      return [];
    }
  },

  /**
   * Get a memory profile
   */
  getMemoryProfile: async (fileName: string): Promise<any> => {
    try {
      if (isElectron()) {
        const response = await window.electron.getMemoryProfile(fileName);
        if (response && response.success && response.profile) {
          return response.profile;
        } else {
          return null;
        }
      } else {
        // Web version
        const profile = localStorage.getItem(`memoryProfile_${fileName}`);
        return profile ? JSON.parse(profile) : null;
      }
    } catch (error) {
      return null;
    }
  },

  /**
   * Delete a memory profile
   */
  deleteMemoryProfile: async (fileName: string): Promise<boolean> => {
    try {
      if (isElectron()) {
        const response = await window.electron.deleteMemoryProfile(fileName);
        return response && response.success;
      } else {
        // Web version
        const profiles = await profileStorage.listMemoryProfiles();
        const updatedProfiles = profiles.filter((p) => p !== fileName);
        localStorage.setItem("memoryProfiles", JSON.stringify(updatedProfiles));
        localStorage.removeItem(`memoryProfile_${fileName}`);
        return true;
      }
    } catch (error) {
      return false;
    }
  },

  /**
   * List all game profiles - now works without index file
   */
  listGameProfiles: async (): Promise<string[]> => {
    try {
      if (isElectron()) {
        const response = await window.electron.getGameProfiles();
        return response || [];
      } else {
        // Web version - get all game profile keys from localStorage
        const keys = Object.keys(localStorage);
        const profileKeys = keys.filter(key => key.startsWith('gameProfile_'));
        return profileKeys.map(key => key.replace('gameProfile_', ''));
      }
    } catch (error) {
      return [];
    }
  },

  /**
   * Get a game profile
   */
  getGameProfile: async (id: string): Promise<GameProfile | null> => {
    try {
      const profiles = await profileStorage.listGameProfiles();
      const profileName = profiles.find((profile) => profile === `${id}.json` || profile === id);

      if (!profileName) {
        return null;
      }

      if (isElectron() && window.electron) {
        const response = await window.electron.getGameProfile(profileName);
        if (response && response.success && response.profile) {
          // Ensure messageFile is preserved if present
          const profile = response.profile;
          return {
            ...profile,
            messageFile: profile.messageFile || undefined // Safely handle missing field
          };
        } else {
          return null;
        }
      } else {
        // Web version
        const profile = localStorage.getItem(`gameProfile_${profileName}`);
        if (profile) {
          const parsed = JSON.parse(profile);
          return {
            ...parsed,
            messageFile: parsed.messageFile || undefined // Safely handle missing field
          };
        }
        return null;
      }
    } catch (error) {
      return null;
    }
  },

  /**
   * Delete a game profile
   */
  deleteGameProfile: async (id: string): Promise<boolean> => {
    try {
      const profiles = await profileStorage.listGameProfiles();
      
      // Check if the id already ends with .json extension
      const hasJsonExt = id.toLowerCase().endsWith('.json');
      
      // Look for profile with or without the .json extension
      const profileName = profiles.find((profile) => 
        profile === (hasJsonExt ? id : `${id}.json`) || profile === id
      );

      if (!profileName) {
        return false;
      }

      if (isElectron()) {
        // We need to pass the id without .json extension since the backend adds it
        const idToDelete = hasJsonExt ? id.slice(0, -5) : id;
        
        const response = await window.electron.removeGameProfile(idToDelete);
        
        // Handle both object and boolean responses
        if (response && typeof response === 'object') {
          return response.success === true;
        } else {
          return Boolean(response);
        }
      } else {
        // Web version - just remove from localStorage
        localStorage.removeItem(`gameProfile_${profileName}`);
        return true;
      }
    } catch (error) {
      return false;
    }
  },

  /**
   * Save a memory profile
   */
  saveMemoryProfile: async (
    fileName: string,
    profileData: any
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (isElectron()) {
        const result = await window.electron.saveMemoryProfile(fileName, profileData);
        if (result && typeof result === "object") {
          return { 
            success: result.success === true, 
            error: result.error || undefined 
          };
        }
        return { success: false, error: "Invalid response from electron" };
      } else {
        // Web version implementation
        try {
          const profiles = await profileStorage.listMemoryProfiles();
          if (!profiles.includes(fileName)) {
            profiles.push(fileName);
            localStorage.setItem("memoryProfiles", JSON.stringify(profiles));
          }

          localStorage.setItem(`memoryProfile_${fileName}`, JSON.stringify(profileData));
          return { success: true };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  /**
   * Save a message profile
   */
  saveMessageProfile: async (
    fileName: string,
    profileData: MessageProfile
  ): Promise<boolean> => {
    try {
      if (isElectron()) {
        const result = await window.electron.saveMessageProfile(fileName, profileData);
        return result && result.success === true;
      } else {
        // Web version - save directly to localStorage
        localStorage.setItem(`messageProfile_${fileName}`, JSON.stringify(profileData));
        return true;
      }
    } catch (error) {
      console.error('Error saving message profile:', error);
      return false;
    }
  },

  /**
   * Save a game profile
   */
  saveGameProfile: async (
    fileName: string,
    profile: GameProfile
  ): Promise<boolean> => {
    try {
      if (isElectron()) {
        // Ensure messageFile is included in the saved profile if present
        const profileToSave = {
          ...profile,
          messageFile: profile.messageFile || undefined
        };
        const result = await window.electron.saveGameProfile(fileName, profileToSave);
        return result && result.success === true;
      } else {
        // Web version - save directly to localStorage
        const profileToSave = {
          ...profile,
          messageFile: profile.messageFile || undefined
        };
        localStorage.setItem(`gameProfile_${fileName}`, JSON.stringify(profileToSave));
        return true;
      }
    } catch (error) {
      return false;
    }
  },

  /**
   * Convert memory profile output to memory address
   */
  convertProfileOutputToAddress: (output: MemoryProfileOutput): MemoryAddress => {
    return {
      id: crypto.randomUUID(),
      label: output.label || "",
      address: output.address || "",
      type: output.type || "Int32",
      value: null,
      rawValue: null,
      finalValue: null,
      lastRead: null,
      success: false,
      error: null,
      notes: output.notes || "",
      invert: output.invert || false,
      format: output.format || "{value}",
      script: output.script || "",
      useModuleOffset: output.useModuleOffset || false,
      moduleName: output.moduleName || "",
      offset: output.offset || "",
      offsetFormat: "hex",
      offsets: output.offsets || [],
      bitmask: output.bitmask || "",
      bitwiseOp: output.bitwiseOp || "",
      bitfield: output.bitfield || false,
      isPointerChain: output.isPointerChain || false,
      disableCaching: false,
      fastModeEnabled: false,
      source: (output.source as "user" | "profile" | "community") || "profile" // Fixed type casting
    };
  },

  /**
   * Convert memory address to memory profile output
   */
  convertAddressToProfileOutput: (address: Partial<MemoryAddress>): MemoryProfileOutput => {
    return {
      label: address.label || "",
      type: address.type || "Int32",
      address: address.address || "",
      notes: address.notes || "",
      invert: address.invert || false,
      format: address.format || "{value}",
      script: address.script || "",
      useModuleOffset: address.useModuleOffset || false,
      moduleName: address.moduleName || "",
      offset: address.offset || "",
      offsets: address.offsets || [],
      bitmask: address.bitmask || "",
      bitwiseOp: address.bitwiseOp || "",
      bitfield: address.bitfield || false,
      isPointerChain: address.isPointerChain || false,
      source: address.source || "user" // Preserve source field
    };
  },

  /**
   * Load all game profiles - simplified without index file
   */
  loadProfiles: (): GameProfile[] => {
    try {
      if (isElectron()) {
        // In Electron, we can't use sync operations, so return empty array
        // This method is mainly for web version compatibility
        return [];
      }
      
      // Web version - get all game profile keys from localStorage
      const keys = Object.keys(localStorage);
      const profileKeys = keys.filter(key => key.startsWith('gameProfile_'));
      
      const profiles: GameProfile[] = [];
      
      for (const key of profileKeys) {
        try {
          const profileStr = localStorage.getItem(key);
          if (profileStr) {
            const profile = JSON.parse(profileStr);
            profiles.push({
              ...profile,
              messageFile: profile.messageFile || undefined // Safely handle missing field
            });
          }
        } catch (err) {
          // Skip invalid profiles
        }
      }
      
      return profiles;
    } catch (error) {
      return [];
    }
  },

  /**
   * Save all game profiles - simplified without index file
   */
  saveProfiles: (profiles: GameProfile[]): boolean => {
    try {
      if (isElectron()) {
        // In Electron, profiles are saved individually via IPC
        // This method is mainly for web version compatibility
        return true;
      }
      
      // Web version - save each profile individually
      for (const profile of profiles) {
        const fileName = `${profile.id}.json`;
        const profileToSave = {
          ...profile,
          messageFile: profile.messageFile || undefined
        };
        localStorage.setItem(`gameProfile_${fileName}`, JSON.stringify(profileToSave));
      }
      
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Update cached memory profile
   */
  updateCachedMemoryProfile: (profile: MemoryProfile): boolean => {
    try {
      profileCache.set(profile.fileName, profile);
      
      // Also update in localStorage for web version
      if (!isElectron()) {
        localStorage.setItem(`memoryProfile_${profile.fileName}`, JSON.stringify(profile));
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
};
