
import { profileStorage } from "./profileStorage";
import { MemoryProfile } from "@/types/memoryProfiles";
import { MessageProfile } from "@/types/messageProfiles";
import { isElectron } from "@/utils/isElectron";

export interface ProfileWithType {
  profile: MemoryProfile | MessageProfile;
  type: 'default' | 'user' | 'community';
  fileName: string;
}

/**
 * Enhanced profile manager that handles default, user, and community profiles
 */
export const profileManager = {
  /**
   * List all memory profiles from default, community, and user directories
   */
  listMemoryProfiles: async (): Promise<ProfileWithType[]> => {
    const profiles: ProfileWithType[] = [];
    
    try {
      // Load user profiles
      const userProfiles = await profileStorage.listMemoryProfiles();
      for (const fileName of userProfiles) {
        const profile = await profileStorage.getMemoryProfile(fileName);
        if (profile) {
          profiles.push({
            profile,
            type: 'user',
            fileName
          });
        }
      }
      
      // Load default profiles
      if (isElectron() && window.electron?.listDefaultMemoryProfiles) {
        const defaultProfiles = await window.electron.listDefaultMemoryProfiles();
        if (defaultProfiles && defaultProfiles.success && defaultProfiles.profiles) {
          for (const fileName of defaultProfiles.profiles) {
            const response = await window.electron.getDefaultMemoryProfile(fileName);
            if (response && response.success && response.profile) {
              profiles.push({
                profile: response.profile,
                type: 'default',
                fileName
              });
            }
          }
        }
      }

      // Load community profiles
      if (isElectron() && window.electron?.ipcRenderer) {
        const communityProfiles = await window.electron.ipcRenderer.invoke('memory-profile:list-community');
        if (communityProfiles && communityProfiles.success && communityProfiles.profiles) {
          for (const fileName of communityProfiles.profiles) {
            const response = await window.electron.ipcRenderer.invoke('memory-profile:get-community', fileName);
            if (response && response.success && response.profile) {
              profiles.push({
                profile: response.profile,
                type: 'community',
                fileName
              });
            }
          }
        }
      }
      
      return profiles;
    } catch (error) {
      console.error('Error listing memory profiles:', error);
      return [];
    }
  },

  /**
   * List all message profiles from default, community, and user directories
   */
  listMessageProfiles: async (): Promise<ProfileWithType[]> => {
    const profiles: ProfileWithType[] = [];
    
    try {
      // Load user profiles
      if (isElectron() && window.electron?.ipcRenderer) {
        const userProfiles = await window.electron.ipcRenderer.invoke('message-profile:list');
        if (Array.isArray(userProfiles)) {
          for (const fileName of userProfiles) {
            const response = await window.electron.ipcRenderer.invoke('message-profile:get', fileName);
            if (response && response.success && response.profile) {
              profiles.push({
                profile: response.profile,
                type: 'user',
                fileName
              });
            }
          }
        }
      }
      
      // Load default profiles
      if (isElectron() && window.electron?.ipcRenderer) {
        const defaultProfiles = await window.electron.ipcRenderer.invoke('message-profile:list-default');
        if (Array.isArray(defaultProfiles)) {
          for (const fileName of defaultProfiles) {
            const response = await window.electron.ipcRenderer.invoke('message-profile:get-default', fileName);
            if (response && response.success && response.profile) {
              profiles.push({
                profile: response.profile,
                type: 'default',
                fileName
              });
            }
          }
        }
      }

      // Load community profiles
      if (isElectron() && window.electron?.ipcRenderer) {
        const communityProfiles = await window.electron.ipcRenderer.invoke('message-profile:list-community');
        if (Array.isArray(communityProfiles)) {
          for (const fileName of communityProfiles) {
            const response = await window.electron.ipcRenderer.invoke('message-profile:get-community', fileName);
            if (response && response.success && response.profile) {
              profiles.push({
                profile: response.profile,
                type: 'community',
                fileName
              });
            }
          }
        }
      }
      
      return profiles;
    } catch (error) {
      console.error('Error listing message profiles:', error);
      return [];
    }
  },

  /**
   * Get a specific memory profile by filename and type
   */
  getMemoryProfile: async (fileName: string, type: 'default' | 'user' | 'community'): Promise<MemoryProfile | null> => {
    try {
      if (type === 'user') {
        return await profileStorage.getMemoryProfile(fileName);
      } else if (type === 'default') {
        if (isElectron() && window.electron?.getDefaultMemoryProfile) {
          const response = await window.electron.getDefaultMemoryProfile(fileName);
          return response && response.success ? response.profile : null;
        }
      } else if (type === 'community') {
        if (isElectron() && window.electron?.ipcRenderer) {
          const response = await window.electron.ipcRenderer.invoke('memory-profile:get-community', fileName);
          return response && response.success ? response.profile : null;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting memory profile:', error);
      return null;
    }
  },

  /**
   * Get a specific message profile by filename and type
   */
  getMessageProfile: async (fileName: string, type: 'default' | 'user' | 'community'): Promise<MessageProfile | null> => {
    try {
      if (type === 'user') {
        if (isElectron() && window.electron?.ipcRenderer) {
          const response = await window.electron.ipcRenderer.invoke('message-profile:get', fileName);
          return response && response.success ? response.profile : null;
        }
      } else if (type === 'default') {
        if (isElectron() && window.electron?.ipcRenderer) {
          const response = await window.electron.ipcRenderer.invoke('message-profile:get-default', fileName);
          return response && response.success ? response.profile : null;
        }
      } else if (type === 'community') {
        if (isElectron() && window.electron?.ipcRenderer) {
          const response = await window.electron.ipcRenderer.invoke('message-profile:get-community', fileName);
          return response && response.success ? response.profile : null;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting message profile:', error);
      return null;
    }
  },

  /**
   * Save a memory profile based on its type
   */
  saveMemoryProfile: async (fileName: string, profile: MemoryProfile, type: 'user' | 'community'): Promise<boolean> => {
    try {
      if (type === 'user') {
        const result = await profileStorage.saveMemoryProfile(fileName, profile);
        return result.success;
      } else if (type === 'community') {
        if (isElectron() && window.electron?.ipcRenderer) {
          const result = await window.electron.ipcRenderer.invoke('memory-profile:save-community', fileName, profile);
          return result && result.success;
        }
      }
      return false;
    } catch (error) {
      console.error('Error saving memory profile:', error);
      return false;
    }
  },

  /**
   * Save a message profile based on its type
   */
  saveMessageProfile: async (fileName: string, profile: MessageProfile, type: 'user' | 'community'): Promise<boolean> => {
    try {
      if (type === 'user') {
        if (isElectron() && window.electron?.ipcRenderer) {
          const result = await window.electron.ipcRenderer.invoke('message-profile:save', fileName, profile);
          return result && result.success;
        }
      } else if (type === 'community') {
        if (isElectron() && window.electron?.ipcRenderer) {
          const result = await window.electron.ipcRenderer.invoke('message-profile:save-community', fileName, profile);
          return result && result.success;
        }
      }
      return false;
    } catch (error) {
      console.error('Error saving message profile:', error);
      return false;
    }
  },

  /**
   * Promote a default profile to user profile (creates a copy in user directory)
   */
  promoteToUserProfile: async (fileName: string, profileType: 'memory' | 'message'): Promise<boolean> => {
    try {
      // Get the default profile
      let defaultProfile: any = null;
      
      if (profileType === 'memory') {
        defaultProfile = await profileManager.getMemoryProfile(fileName, 'default');
        if (defaultProfile) {
          const result = await profileStorage.saveMemoryProfile(fileName, defaultProfile);
          return result.success;
        }
      } else {
        defaultProfile = await profileManager.getMessageProfile(fileName, 'default');
        if (defaultProfile && isElectron() && window.electron?.ipcRenderer) {
          const result = await window.electron.ipcRenderer.invoke('message-profile:save', fileName, defaultProfile);
          return result && result.success;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error promoting profile to user:', error);
      return false;
    }
  }
};
