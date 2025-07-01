
import { MessageProfile } from "@/types/messageProfiles";
import { isElectron } from "@/utils/isElectron";

export const messageProfiles = {
  /**
   * Save a message profile
   */
  saveMessageProfile: async (profile: MessageProfile): Promise<boolean> => {
    try {
      // Ensure all saved message profiles have the user type
      const profileWithType: MessageProfile = {
        ...profile,
        messageProfileType: "user"
      };

      if (isElectron()) {
        const fileName = `${profile.profileName}.json`;
        const result = await window.electron.saveMessageProfile(fileName, profileWithType);
        return result && result.success === true;
      } else {
        // Web version - use localStorage
        const profiles = await messageProfiles.loadMessageProfiles();
        const existingIndex = profiles.findIndex(p => p.profileName === profile.profileName);
        
        if (existingIndex >= 0) {
          profiles[existingIndex] = profileWithType;
        } else {
          profiles.push(profileWithType);
        }
        
        localStorage.setItem('messageProfiles', JSON.stringify(profiles));
        return true;
      }
    } catch (error) {
      console.error('Error saving message profile:', error);
      return false;
    }
  },

  /**
   * Load all message profiles
   */
  loadMessageProfiles: async (): Promise<MessageProfile[]> => {
    try {
      if (isElectron()) {
        const result = await window.electron.listMessageProfiles();
        if (result && Array.isArray(result)) {
          const profiles: MessageProfile[] = [];
          for (const fileName of result) {
            try {
              const profileResult = await window.electron.getMessageProfile(fileName);
              if (profileResult && profileResult.success && profileResult.profile) {
                // Ensure backward compatibility for format and script fields
                const normalizedProfile = {
                  ...profileResult.profile,
                  outputs: profileResult.profile.outputs.map((output: any) => ({
                    ...output,
                    format: output.format ?? "",
                    script: output.script ?? ""
                  })),
                  // Default to 'user' if no type specified for backward compatibility
                  messageProfileType: profileResult.profile.messageProfileType || 'user'
                };
                profiles.push(normalizedProfile);
              }
            } catch (err) {
              // Skip invalid profiles
            }
          }
          return profiles;
        }
        return [];
      } else {
        // Web version
        const stored = localStorage.getItem('messageProfiles');
        if (stored) {
          const profiles = JSON.parse(stored);
          // Ensure backward compatibility for format and script fields
          return profiles.map((profile: any) => ({
            ...profile,
            outputs: profile.outputs.map((output: any) => ({
              ...output,
              format: output.format ?? "",
              script: output.script ?? ""
            })),
            // Default to 'user' if no type specified for backward compatibility
            messageProfileType: profile.messageProfileType || 'user'
          }));
        }
        return [];
      }
    } catch (error) {
      console.error('Error loading message profiles:', error);
      return [];
    }
  },

  /**
   * Delete a message profile
   */
  deleteMessageProfile: async (profileName: string): Promise<boolean> => {
    try {
      if (isElectron()) {
        // Strip any existing .json extension before adding it back to avoid double extension
        const cleanProfileName = profileName.replace(/\.json$/i, '');
        const fileName = `${cleanProfileName}.json`;
        const result = await window.electron.deleteMessageProfile(fileName);
        return result && result.success === true;
      } else {
        // Web version - use localStorage
        const profiles = await messageProfiles.loadMessageProfiles();
        const filteredProfiles = profiles.filter(p => p.profileName !== profileName);
        localStorage.setItem('messageProfiles', JSON.stringify(filteredProfiles));
        return true;
      }
    } catch (error) {
      console.error('Error deleting message profile:', error);
      return false;
    }
  },

  /**
   * Load a specific message profile
   */
  loadMessageProfile: async (profileName: string): Promise<MessageProfile | null> => {
    try {
      if (isElectron()) {
        const fileName = `${profileName}.json`;
        const result = await window.electron.getMessageProfile(fileName);
        if (result && result.success && result.profile) {
          // Ensure backward compatibility for format and script fields
          return {
            ...result.profile,
            outputs: result.profile.outputs.map((output: any) => ({
              ...output,
              format: output.format ?? "",
              script: output.script ?? ""
            })),
            // Default to 'user' if no type specified for backward compatibility
            messageProfileType: result.profile.messageProfileType || 'user'
          };
        }
        return null;
      } else {
        // Web version
        const profiles = await messageProfiles.loadMessageProfiles();
        return profiles.find(p => p.profileName === profileName) || null;
      }
    } catch (error) {
      console.error('Error loading message profile:', error);
      return null;
    }
  }
};
