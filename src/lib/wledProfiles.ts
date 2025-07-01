
import { v4 as uuid } from 'uuid';
import { toast } from '@/hooks/use-toast';

export interface WLEDSegment {
  id: number;
  color: number[];
  effect: number;
  brightness: number;
  speed: number;
}

export interface WLEDRule {
  id: string;
  triggerType: 'exact' | 'range' | 'external';
  exactValue?: number;
  minValue?: number;
  maxValue?: number;
  segmentId?: number; // For backward compatibility
  segments?: number[]; // New field for multiple segments
  effect: number;
  color: number[];
  brightness: number;
  flash?: boolean;
  imported?: boolean;
  turnOffSegment?: boolean; // New property to turn off the segment
}

export interface WLEDOutputProfile {
  id: string;
  name: string;
  description?: string;
  deviceIP: string;
  importedAt: string;
  segmentCount?: number; // Made optional
  totalLEDs?: number; // Made optional
  segments?: WLEDSegment[]; // Made optional as it's being phased out
  rules: WLEDRule[];
}

export interface WLEDEffect {
  id: number;
  name: string;
}

// New interface for device connection state
export interface WLEDDeviceConnectionState {
  isConnected: boolean;
  ipAddress: string;
  effects: WLEDEffect[];
  segments: number[];
  isLoading: boolean;
}

/**
 * Imports a WLED profile from a device at the specified IP address
 * @param ipAddress The IP address of the WLED device
 * @returns Promise resolving to the imported profile
 */
export const importWLEDProfileFromDevice = async (ipAddress: string): Promise<WLEDOutputProfile> => {
  try {
    if (!window.electron) {
      throw new Error('Electron API not available');
    }
    
    const profile = await window.electron.importWLEDProfile(ipAddress);
    return profile;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Send error to centralized logging system
    if (window.electron) {
      window.electron.ipcRenderer?.send('log:frontend-error', {
        category: 'wled',
        message: `WLED ${ipAddress} - Import Profile: FRONTEND ERROR - ${errorMessage}`,
        timestamp: new Date().toISOString()
      });
    }
    
    toast({
      title: "Import Failed",
      description: `Could not import WLED profile: ${errorMessage}`,
      variant: "destructive"
    });
    throw error;
  }
};

/**
 * Saves a WLED profile to disk
 * @param profile The profile to save
 * @returns Promise resolving to the file path where the profile was saved
 */
export const saveWLEDProfile = async (profile: WLEDOutputProfile): Promise<string> => {
  try {
    if (!window.electron) {
      throw new Error('Electron API not available');
    }
    
    // Ensure profile has an ID
    if (!profile.id) {
      profile.id = uuid();
    }
    
    // Convert any rules with segmentId to use segments array for backward compatibility
    if (profile.rules && Array.isArray(profile.rules)) {
      profile.rules = profile.rules.map(rule => {
        if (!rule.segments && rule.segmentId !== undefined) {
          return {
            ...rule,
            segments: [rule.segmentId]
          };
        }
        return rule;
      });
    }
    
    const filePath = await window.electron.saveWLEDProfile(profile);
    
    // Log successful save
    if (window.electron) {
      window.electron.ipcRenderer?.send('log:frontend-event', {
        category: 'wled',
        message: `WLED Profile Save: SUCCESS - Profile "${profile.name}" saved to disk`,
        timestamp: new Date().toISOString()
      });
    }
    
    return filePath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Send error to centralized logging system
    if (window.electron) {
      window.electron.ipcRenderer?.send('log:frontend-error', {
        category: 'wled',
        message: `WLED Profile Save: FRONTEND ERROR - ${errorMessage}`,
        timestamp: new Date().toISOString()
      });
    }
    
    toast({
      title: "Save Failed",
      description: `Could not save WLED profile: ${errorMessage}`,
      variant: "destructive"
    });
    throw error;
  }
};

/**
 * Gets all available WLED profiles
 * @returns Promise resolving to an array of profile file names
 */
export const getAllWLEDProfiles = async (): Promise<string[]> => {
  try {
    if (!window.electron) {
      return [];
    }
    
    const profiles = await window.electron.listWLEDProfiles();
    return profiles;
  } catch (error) {
    //console.error('Error getting WLED profiles:', error);
    return [];
  }
};

/**
 * Loads a specific WLED profile by filename
 * @param fileName The name of the profile file to load
 * @returns Promise resolving to the loaded profile or null if not found
 */
export const loadWLEDProfile = async (fileName: string): Promise<WLEDOutputProfile | null> => {
  try {
    if (!window.electron) {
      return null;
    }
    
    const profile = await window.electron.loadWLEDProfile(fileName);
    
    if (profile && window.electron) {
      window.electron.ipcRenderer?.send('log:frontend-event', {
        category: 'wled',
        message: `WLED Profile Load: SUCCESS - Profile "${fileName}" loaded from disk`,
        timestamp: new Date().toISOString()
      });
    }
    
    return profile;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Send error to centralized logging system
    if (window.electron) {
      window.electron.ipcRenderer?.send('log:frontend-error', {
        category: 'wled',
        message: `WLED Profile Load: FRONTEND ERROR - Failed to load "${fileName}": ${errorMessage}`,
        timestamp: new Date().toISOString()
      });
    }
    
    return null;
  }
};

/**
 * Deletes a WLED profile by filename
 * @param fileName The name of the profile file to delete
 * @returns Promise resolving to a result object with success status
 */
export const deleteWLEDProfile = async (fileName: string): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!window.electron) {
      throw new Error('Electron API not available');
    }
    
    // Call the Electron method to delete the file
    const result = await window.electron.deleteWLEDProfile(fileName);
    
    if (result.success) {
      // Log successful deletion
      if (window.electron) {
        window.electron.ipcRenderer?.send('log:frontend-event', {
          category: 'wled',
          message: `WLED Profile Delete: SUCCESS - Profile "${fileName}" deleted from disk`,
          timestamp: new Date().toISOString()
        });
      }
      
      toast({
        title: "Profile Deleted",
        description: `Successfully deleted profile: ${fileName}`
      });
    } else {
      // Log deletion failure
      if (window.electron) {
        window.electron.ipcRenderer?.send('log:frontend-error', {
          category: 'wled',
          message: `WLED Profile Delete: ERROR - Failed to delete "${fileName}": ${result.error || 'Unknown error'}`,
          timestamp: new Date().toISOString()
        });
      }
      
      toast({
        title: "Delete Failed",
        description: `Could not delete profile: ${result.error || 'Unknown error'}`,
        variant: "destructive"
      });
    }
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Send error to centralized logging system
    if (window.electron) {
      window.electron.ipcRenderer?.send('log:frontend-error', {
        category: 'wled',
        message: `WLED Profile Delete: FRONTEND ERROR - ${errorMessage}`,
        timestamp: new Date().toISOString()
      });
    }
    
    toast({
      title: "Delete Failed",
      description: `Could not delete profile: ${errorMessage}`,
      variant: "destructive"
    });
    return { success: false, error: errorMessage };
  }
};

/**
 * Imports a WLED profile from a device and saves it
 * @param ipAddress The IP address of the WLED device
 * @returns Promise resolving to the saved profile
 */
export async function importAndSaveWLEDProfile(ipAddress: string): Promise<{ success: boolean, fileName: string }> {
  try {
    // Convert IP to segments for display
    const ipSegments = ipAddress.split('.');
    const shortName = `WLED-${ipSegments[2]}.${ipSegments[3]}`;
    
    // Get device info
    const deviceInfo = await getWLEDDeviceInfo(ipAddress);
    
    // Create profile name from device name or IP
    const profileName = deviceInfo.name ? 
      `${deviceInfo.name} - Imported` : 
      `${shortName} - Imported`;
    
    // Get current device config including all segments
    const deviceSegments = await fetchWLEDDeviceInfo(ipAddress);
    const deviceEffects = await fetchWLEDEffects(ipAddress);
    const currentState = await getWLEDDeviceState(ipAddress);
    
    // Create a profile with device's current settings
    const profile: WLEDOutputProfile = {
      id: uuid(),
      name: profileName,
      deviceIP: ipAddress,
      importedAt: new Date().toISOString(),
      rules: []
    };
    
    //console.log('Current state from WLED:', currentState);
    
    // Add each active segment as a rule
    if (currentState && currentState.seg) {
      for (let i = 0; i < deviceSegments.length; i++) {
        const segmentIndex = deviceSegments[i];
        // Find segment data in currentState.seg
        const segmentData = currentState.seg.find((seg: any) => seg.id === segmentIndex);
        
        if (segmentData) {
          //console.log(`Adding rule for segment ${segmentIndex}:`, segmentData);
          profile.rules.push({
            id: uuid(),
            triggerType: 'exact', // Changed from 'external' to 'exact'
            exactValue: 1, // Added exactValue of 1 for all imported rules
            segments: [segmentIndex],
            effect: segmentData.fx || 0,
            color: segmentData.col ? segmentData.col[0] : [255, 255, 255],
            brightness: segmentData.bri || 255,
            imported: true // Mark as imported
          });
        }
      }
    }
    
    //console.log('Profile to save:', profile);
    
    // Save the profile
    const fileName = await saveWLEDProfile(profile);
    
    return { success: true, fileName };
  } catch (error) {
    //console.error('Error importing WLED profile:', error);
    throw new Error(`Failed to import WLED profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches available effects from a WLED device
 * @param ipAddress The IP address of the WLED device
 * @returns Promise resolving to an array of effect objects with id and name
 */
export const fetchWLEDEffects = async (ipAddress: string): Promise<WLEDEffect[]> => {
  try {
    if (!window.electron) {
      throw new Error('Electron API not available');
    }
    
    const effectNames = await window.electron.getWLEDEffects(ipAddress);
    
    // Create effect objects with id and name
    const effects = effectNames.map((name: string, id: number) => ({ id, name }));
    return effects;
  } catch (error) {
    //console.error('Error fetching WLED effects:', error);
    toast({
      title: "Failed to Get Effects",
      description: `Could not fetch effects: ${error instanceof Error ? error.message : 'Unknown error'}`,
      variant: "destructive"
    });
    throw error;
  }
};

/**
 * Fetches device information from a WLED device including segment count
 * @param ipAddress The IP address of the WLED device
 * @returns Promise resolving to segment information
 */
export const fetchWLEDDeviceInfo = async (ipAddress: string): Promise<number[]> => {
  try {
    if (!window.electron) {
      throw new Error('Electron API not available');
    }
    
    // Fetch both the device info and state in parallel for efficiency
    const [info, state] = await Promise.all([
      window.electron.getWLEDDeviceInfo(ipAddress),
      window.electron.getWLEDDeviceState(ipAddress)
    ]);
    
    //console.log('WLED device info:', info);
    //console.log('WLED device state:', state);
    
    // Extract segment information from state.seg which contains the actual segments
    if (state && state.seg && Array.isArray(state.seg)) {
      // Create array of segment indices based on state.seg length
      // This uses the actual segments configured on the device
      const segmentIndices = Array.from({ length: state.seg.length }, (_, i) => i);
      //console.log('Found segments from state:', segmentIndices);
      return segmentIndices;
    }
    // Fallback to the old method if state.seg is not available
    else if (info && info.leds && info.leds.seglens && Array.isArray(info.leds.seglens)) {
      // Create array of segment indices based on seglens length
      const segmentIndices = Array.from({ length: info.leds.seglens.length }, (_, i) => i);
      //console.log('Fallback to segments from info:', segmentIndices);
      return segmentIndices;
    } else if (info && info.leds && info.leds.count > 0) {
      // Fallback to using single segment if no segment info available
      //console.log('No segment info found, defaulting to segment 0');
      return [0];
    }
    
    //console.log('No segments found');
    return [];
  } catch (error) {
    //console.error('Error fetching WLED device info:', error);
    toast({
      title: "Failed to Get Device Info",
      description: `Could not fetch device info: ${error instanceof Error ? error.message : 'Unknown error'}`,
      variant: "destructive"
    });
    throw error;
  }
};

/**
 * Fetches basic device information from a WLED device
 * @param ipAddress The IP address of the WLED device
 * @returns Promise resolving to device information
 */
export const getWLEDDeviceInfo = async (ipAddress: string): Promise<any> => {
  try {
    if (!window.electron) {
      throw new Error('Electron API not available');
    }
    
    // Call the Electron API to get device info
    const info = await window.electron.getWLEDDeviceInfo(ipAddress);
    return info;
  } catch (error) {
    //console.error('Error fetching WLED device info:', error);
    toast({
      title: "Failed to Get Device Info",
      description: `Could not fetch device info: ${error instanceof Error ? error.message : 'Unknown error'}`,
      variant: "destructive"
    });
    throw error;
  }
};

/**
 * Fetches the current state from a WLED device
 * @param ipAddress The IP address of the WLED device
 * @returns Promise resolving to the device state
 */
export const getWLEDDeviceState = async (ipAddress: string): Promise<any> => {
  try {
    if (!window.electron) {
      throw new Error('Electron API not available');
    }
    
    // Call the Electron API to get device state
    const state = await window.electron.getWLEDDeviceState(ipAddress);
    return state;
  } catch (error) {
    //console.error('Error fetching WLED device state:', error);
    toast({
      title: "Failed to Get Device State",
      description: `Could not fetch device state: ${error instanceof Error ? error.message : 'Unknown error'}`,
      variant: "destructive"
    });
    throw error;
  }
};

/**
 * Migrates an older profile format to the new format without global segments array
 * @param profile The profile to migrate
 * @returns The migrated profile
 */
export const migrateWLEDProfile = (profile: WLEDOutputProfile): WLEDOutputProfile => {
  // If the profile doesn't have segments or already has rules, no migration needed
  if (!profile.segments || profile.segments.length === 0) {
    return profile;
  }

  const updatedProfile = { ...profile };
  
  // If there are no rules yet, create them from segments
  if (!updatedProfile.rules || updatedProfile.rules.length === 0) {
    updatedProfile.rules = profile.segments.map((segment) => ({
      id: uuid(),
      triggerType: 'external',
      segments: [segment.id],
      effect: segment.effect,
      color: segment.color,
      brightness: segment.brightness,
      imported: true
    }));
  }
  
  // Remove the segments array to avoid redundancy
  delete updatedProfile.segments;
  
  return updatedProfile;
};

// Add this new function to provide default effects when no connection is available
export const getDefaultEffects = (): WLEDEffect[] => {
  return [
    { id: 0, name: "Solid" },
    { id: 1, name: "Blink" },
    { id: 2, name: "Breathe" },
    { id: 3, name: "Color Wipe" },
    { id: 4, name: "Random Colors" },
    { id: 5, name: "Rainbow" }
  ];
};
