import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { profileManager, ProfileWithType } from "@/lib/profileManager";
import { MemoryProfile } from "@/types/memoryProfiles";
import { MemoryAddress } from "@/types/memoryAddress";
import { syncGameProfilesToMemoryProfile } from "@/lib/profileSynchronization";
import { useUnsavedChanges } from "@/components/UnsavedChangesProvider";

interface UseProfileManagerProps {
  onAddressesLoad: (addresses: MemoryAddress[]) => void;
  onSelectedProcessChange: (process: string | null) => void;
  onPollIntervalChange: (interval: number) => void;
  selectedProcess: string | null;
  memoryAddresses: MemoryAddress[];
  debugLoggingEnabled?: boolean;
}

export function useProfileManager({
  onAddressesLoad,
  onSelectedProcessChange,
  onPollIntervalChange,
  selectedProcess,
  memoryAddresses,
  debugLoggingEnabled = false
}: UseProfileManagerProps) {
  const { setHasUnsavedChanges, clearUnsavedChanges } = useUnsavedChanges();
  const [availableProfiles, setAvailableProfiles] = useState<string[]>([]);
  const [profilesWithType, setProfilesWithType] = useState<ProfileWithType[]>([]);
  const [currentProfileName, setCurrentProfileName] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<MemoryProfile | null>(null);
  const [defaultPollInterval, setDefaultPollInterval] = useState(16);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  
  // Track original values for change detection
  const [originalPollInterval, setOriginalPollInterval] = useState(16);
  const [originalProcess, setOriginalProcess] = useState<string | null>(null);

  // Check for profile settings changes
  const profileSettingsChanged = useCallback(() => {
    if (!currentProfile) return false;
    
    return (
      defaultPollInterval !== originalPollInterval ||
      selectedProcess !== originalProcess
    );
  }, [defaultPollInterval, originalPollInterval, selectedProcess, originalProcess, currentProfile]);

  // Monitor profile settings changes - with loading guard
  useEffect(() => {
    // Don't detect changes while loading a profile
    if (isLoadingProfile) return;
    
    if (currentProfile && profileSettingsChanged()) {
      setHasUnsavedChanges(true, 'profile');
    }
  }, [profileSettingsChanged, setHasUnsavedChanges, currentProfile, isLoadingProfile]);

  const loadAvailableProfiles = useCallback(async () => {
    try {
      const profilesWithTypeData = await profileManager.listMemoryProfiles();
      const profileNames = profilesWithTypeData.map(p => p.fileName);
      
      if (debugLoggingEnabled) {
        //console.log("Available memory profiles:", profileNames);
      }
      
      setProfilesWithType(profilesWithTypeData);
      setAvailableProfiles(profileNames);
      return profileNames;
    } catch (error) {
      //console.error("Failed to load memory profiles:", error);
      toast.error("Failed to load memory profiles");
      return [];
    }
  }, [debugLoggingEnabled]);

  const loadMemoryProfile = useCallback(async (fileName: string, profileType?: 'default' | 'user') => {
    try {
      setIsLoadingProfile(true);
      
      // Clear unsaved changes first, before any state changes
      clearUnsavedChanges();
      
      if (debugLoggingEnabled) {
        //console.log(`Loading profile: "${fileName}" with type: ${profileType}`);
      }

      // Use explicit profile type if provided, otherwise try to detect from stored profiles
      let actualProfileType = profileType;
      if (!actualProfileType) {
        const profileWithType = profilesWithType.find(p => p.fileName === fileName);
        actualProfileType = profileWithType?.type || 'user'; // Default to 'user' for backwards compatibility
      }
      
      if (debugLoggingEnabled) {
        //console.log(`Using profile type: ${actualProfileType}`);
      }

      const profile = await profileManager.getMemoryProfile(fileName, actualProfileType);
      
      if (!profile) {
        toast.error(`Failed to load memory profile: ${fileName}`);
        setIsLoadingProfile(false);
        return false;
      }

      if (debugLoggingEnabled) {
        //console.log(`Raw profile data:`, JSON.stringify(profile, null, 2));
      }
      
      const processName = profile.process || "";
      
      if (debugLoggingEnabled) {
        //console.log(`Extracted process name: "${processName}"`);
      }
      
      // Set the process from the profile
      onSelectedProcessChange(processName);
      
      if (!processName) {
        //console.warn("No process field found in profile");
        toast.warning("No process specified in the profile");
      }
      
      const newAddresses = (profile.outputs || []).map((output: any) => {
        const address = convertProfileOutputToAddress(output);
        
        if (debugLoggingEnabled) {
          //console.log(`Converted address for "${output.label}":`, address);
        }
        
        return address;
      });

      if (debugLoggingEnabled) {
        //console.log("All converted addresses:", newAddresses);
      }
      
      onAddressesLoad(newAddresses);
      setCurrentProfileName(fileName);
      
      const completeProfile: MemoryProfile = {
        id: fileName,
        fileName,
        process: processName,
        pollInterval: profile.pollInterval || 16,
        outputs: profile.outputs || [],
        outputCount: profile.outputs?.length || 0,
        lastModified: Date.now(),
        memoryProfileType: profile.memoryProfileType || actualProfileType
      };
      
      if (debugLoggingEnabled) {
        //console.log("Setting current profile with process:", completeProfile.process);
      }
      setCurrentProfile(completeProfile);
      
      const pollInterval = profile.pollInterval || 16;
      setDefaultPollInterval(pollInterval);
      onPollIntervalChange(pollInterval);

      // Store original values for change detection AFTER setting current values
      setOriginalPollInterval(pollInterval);
      setOriginalProcess(processName);
      
      toast.success(`Loaded memory profile: ${fileName}`);
      
      // Clear loading state after a brief delay to ensure all state updates complete
      setTimeout(() => {
        setIsLoadingProfile(false);
      }, 100);
      
      return true;
    } catch (error) {
      setIsLoadingProfile(false);
      toast.error(`Error loading profile: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }, [onAddressesLoad, onPollIntervalChange, onSelectedProcessChange, debugLoggingEnabled, clearUnsavedChanges, profilesWithType]);

  // Helper function to convert profile output to memory address
  const convertProfileOutputToAddress = (output: any): MemoryAddress => {
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
      source: output.source || "profile" // Set source to "profile" for loaded addresses
    };
  };
  
  const saveMemoryProfile = useCallback(async (fileName: string, overwrite: boolean = false) => {
    try {
      setIsSaving(true);
      if (!fileName.endsWith('.json')) {
        fileName += '.json';
      }

      const outputs = memoryAddresses.map((addr) => {
        const {
          id, value, rawValue, finalValue, lastRead, error, success, ...clean
        } = addr;
        
        if (debugLoggingEnabled) {
          //console.log(`Saving address: ${addr.label}, useModuleOffset: ${addr.useModuleOffset}, moduleName: ${addr.moduleName}, offset: ${addr.offset}`);
        }
        
        return convertAddressToProfileOutput(clean);
      });

      const profileData = {
        process: selectedProcess || "",
        pollInterval: defaultPollInterval,
        outputs,
        memoryProfileType: "user" as const
      };
      
      if (debugLoggingEnabled) {
        //console.log("Saving profile data:", JSON.stringify(profileData, null, 2));
      }

      if (!overwrite) {
        const profiles = await loadAvailableProfiles();
        if (profiles.includes(fileName)) {
          toast.error(`Profile "${fileName}" already exists. Choose another name or use overwrite option.`);
          setIsSaving(false);
          return false;
        }
      }

      const success = await saveMemoryProfileData(fileName, profileData);
      if (success) {
        setCurrentProfileName(fileName);
        const updatedProfile: MemoryProfile = {
          id: fileName,
          fileName,
          process: selectedProcess || "",
          pollInterval: defaultPollInterval,
          outputs,
          lastModified: Date.now(),
          outputCount: outputs.length,
          memoryProfileType: "user"
        };
        setCurrentProfile(updatedProfile);

        // Update original values after successful save
        setOriginalPollInterval(defaultPollInterval);
        setOriginalProcess(selectedProcess);
        
        // Clear unsaved changes after successful save
        clearUnsavedChanges();

        await loadAvailableProfiles();
        
        if (overwrite) {
          // Automatically sync game profiles instead of showing manual button
          toast.success(`Memory profile "${fileName}" updated successfully`);
          
          try {
            //console.log(`Starting automatic game profile sync for memory profile: ${fileName}`);
            const syncedCount = await syncGameProfilesToMemoryProfile(updatedProfile);
            if (syncedCount > 0) {
              //console.log(`Successfully synced ${syncedCount} game profiles automatically`);
              toast.success(`${syncedCount} game profile(s) automatically synchronized`);
            } else {
              //console.log("No game profiles needed syncing");
              toast.info("No game profiles needed synchronization");
            }
          } catch (syncError) {
            //console.error("Error during automatic game profile sync:", syncError);
            toast.error(`Auto-sync failed: ${syncError instanceof Error ? syncError.message : String(syncError)}`);
          }
        } else {
          toast.success(`Profile "${fileName}" saved successfully`);
        }
        
        return true;
      } else {
        toast.error(`Failed to save profile "${fileName}"`);
        return false;
      }
    } catch (error) {
      toast.error(`Save error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [memoryAddresses, defaultPollInterval, selectedProcess, debugLoggingEnabled, clearUnsavedChanges, loadAvailableProfiles]);

  // Helper function to save memory profile data
  const saveMemoryProfileData = async (fileName: string, profileData: any): Promise<boolean> => {
    try {
      if (window.electron?.saveMemoryProfile) {
        const result = await window.electron.saveMemoryProfile(fileName, profileData);
        return result && result.success === true;
      } else {
        // Web version fallback
        localStorage.setItem(`memoryProfile_${fileName}`, JSON.stringify(profileData));
        return true;
      }
    } catch (error) {
      return false;
    }
  };

  // Helper function to convert address to profile output with proper type casting
  const convertAddressToProfileOutput = (address: Partial<MemoryAddress>) => {
    // Ensure bitwiseOp is properly typed
    const bitwiseOp = address.bitwiseOp || "";
    const validBitwiseOp = (bitwiseOp === "AND" || bitwiseOp === "OR" || bitwiseOp === "XOR" || bitwiseOp === "NOT" || bitwiseOp === "") 
      ? bitwiseOp as ("" | "AND" | "OR" | "XOR" | "NOT")
      : "" as const;

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
      bitwiseOp: validBitwiseOp,
      bitfield: address.bitfield || false,
      isPointerChain: address.isPointerChain || false,
      source: address.source || "user" // Include source field, defaulting to "user"
    };
  };
  
  const deleteProfile = useCallback(async () => {
    if (!currentProfileName) return false;
  
    try {
      const result = await window.electron.deleteMemoryProfile(currentProfileName);
      if (result.success) {
        toast.success(`Deleted profile: ${currentProfileName}`);
        setCurrentProfileName(null);
        setCurrentProfile(null);
        onAddressesLoad([]);
        onSelectedProcessChange(null);
        setDefaultPollInterval(16);
        onPollIntervalChange(16);
        
        // Clear original values and unsaved changes
        setOriginalPollInterval(16);
        setOriginalProcess(null);
        clearUnsavedChanges();
  
        await loadAvailableProfiles();
        return true;
      } else {
        toast.error(`Failed to delete profile: ${result.error || "Unknown error"}`);
        return false;
      }
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }, [currentProfileName, onAddressesLoad, onSelectedProcessChange, onPollIntervalChange, clearUnsavedChanges, loadAvailableProfiles]);

  const clearData = useCallback(() => {
    // Clear unsaved changes first
    clearUnsavedChanges();
    
    setCurrentProfileName(null);
    setCurrentProfile(null);
    onAddressesLoad([]);
    onSelectedProcessChange(null);
    setDefaultPollInterval(16);
    onPollIntervalChange(16);
    
    // Clear original values
    setOriginalPollInterval(16);
    setOriginalProcess(null);
  }, [onAddressesLoad, onSelectedProcessChange, onPollIntervalChange, clearUnsavedChanges]);

  // Enhanced setDefaultPollInterval that updates original value when needed
  const setDefaultPollIntervalWithTracking = useCallback((interval: number) => {
    setDefaultPollInterval(interval);
    // Only update original if we don't have a profile loaded (new profile scenario)
    if (!currentProfile) {
      setOriginalPollInterval(interval);
    }
  }, [currentProfile]);

  return {
    availableProfiles,
    currentProfileName,
    currentProfile,
    defaultPollInterval,
    setDefaultPollInterval: setDefaultPollIntervalWithTracking,
    isSaving,
    loadAvailableProfiles,
    loadMemoryProfile,
    saveMemoryProfile,
    deleteProfile,
    clearData
  };
}
