import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { GameProfile } from "@/types/profiles";
import { isElectron } from "@/utils/isElectron";
import { profileStorage } from "@/lib/profileStorage";
import { profileManager } from "@/lib/profileManager";
import { messageProfiles } from "@/lib/messageProfiles";
import { toast } from "sonner";
import { MemoryProfileOutput } from "@/types/memoryProfiles";
import { MessageProfileOutput } from "@/types/messageProfiles";
import { Device } from "@/types/devices";
import { WLEDOutputProfile } from "@/lib/wledProfiles";
import { useUnsavedChanges } from "@/components/UnsavedChangesProvider";
import { 
  promoteGameProfileNonUserProfilesToUser, 
  gameProfileUsesNonUserProfiles 
} from "@/lib/profilePromotion";

// Define the mapping interface with source tracking
interface OutputMapping {
  output: MemoryProfileOutput | MessageProfileOutput;
  deviceType: string;
  targetDevice: string;
  outputChannel: string;
  active: boolean;
  source: 'memory' | 'message'; // Track the source of the output
}

// Define the context interface
interface GameManagerContextType {
  gameProfiles: string[];
  selectedGameProfile: string | null;
  currentGameProfile: GameProfile | null;
  isLoading: boolean;
  setSelectedGameProfile: (profile: string | null) => void;
  loadGameProfile: (profile: string | null) => void;
  refreshGameProfiles: () => Promise<void>;
  deleteGameProfile: () => Promise<void>;
  clearProfile: () => void;
  handleSaveSettings: () => Promise<boolean>;
  createGameProfile: (profile: GameProfile) => Promise<boolean>;
  updateGameProfile: (updatedProfile: GameProfile) => Promise<boolean>;
  getFormValues: () => {
    processName: string;
    gameName: string;
    pollInterval: number;
    isActive: boolean;
    memoryFile: string;
    messageFile: string;
  };
  setFormValues: (values: {
    processName?: string;
    pollInterval?: number;
    isActive?: boolean;
    memoryFile?: string;
    messageFile?: string;
  }) => void;
  // Properties for mapping functionality
  selectedMemoryProfile: string | null;
  mappings: OutputMapping[];
  devices: Device[];
  wledProfileObjects: WLEDOutputProfile[];
  updateMapping: (index: number, field: keyof OutputMapping, value: any) => void;
}

// Create the context
const GameManagerContext = createContext<GameManagerContextType | undefined>(undefined);

// Helper function to convert MessageProfileOutput to MemoryProfileOutput format while preserving message structure
const convertMessageOutputToMemoryFormat = (messageOutput: MessageProfileOutput): MemoryProfileOutput => {
  return {
    label: messageOutput.label,
    type: "Message", // Use Message type to distinguish from memory outputs
    address: "", // Keep address empty for message outputs
    notes: `Message output: ${messageOutput.key}`, // Store the key in notes for reference
    invert: false,
    format: messageOutput.format || "{value}",
    script: messageOutput.script || "",
    useModuleOffset: false,
    moduleName: "",
    offset: "",
    offsets: [],
    bitmask: "",
    bitwiseOp: "",
    bitfield: false,
    isPointerChain: false
  };
};

// Helper function to normalize device types for backward compatibility
const normalizeDeviceType = (deviceType: string): string => {
  // Map legacy "Serial" to "Arduino" to match UI dropdown options
  if (deviceType === "Serial") {
    return "Arduino";
  }
  return deviceType;
};

// Provider component
export const GameManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameProfiles, setGameProfiles] = useState<string[]>([]);
  const [selectedGameProfile, setSelectedGameProfile] = useState<string | null>(null);
  const [currentGameProfile, setCurrentGameProfile] = useState<GameProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // New state for mapping functionality
  const [selectedMemoryProfile, setSelectedMemoryProfile] = useState<string | null>(null);
  const [mappings, setMappings] = useState<OutputMapping[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [wledProfileObjects, setWledProfileObjects] = useState<WLEDOutputProfile[]>([]);

  // State for tracking original values for change detection
  const [originalProfileValues, setOriginalProfileValues] = useState<{
    processName: string;
    gameName: string;
    pollInterval: number;
    isActive: boolean;
  } | null>(null);
  const [originalMappings, setOriginalMappings] = useState<OutputMapping[]>([]);

  const { setHasUnsavedChanges, clearUnsavedChanges } = useUnsavedChanges();

  // Load game profiles on mount
  useEffect(() => {
    refreshGameProfiles();
    loadDevices();
    loadWLEDProfiles();
  }, []);

  // Watch for mapping changes and update unsaved state
  useEffect(() => {
    if (originalMappings.length === 0 && mappings.length === 0) {
      // Both are empty, no changes
      return;
    }
    
    if (originalMappings.length === 0 && mappings.length > 0) {
      // Mappings were just loaded, don't mark as unsaved
      return;
    }

    // Check if mappings have changed
    const mappingsChanged = JSON.stringify(mappings) !== JSON.stringify(originalMappings);
    if (mappingsChanged) {
      // Use a timeout to ensure this runs after the current render cycle
      const timeoutId = setTimeout(() => {
        setHasUnsavedChanges(true, 'mappings');
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [mappings, originalMappings, setHasUnsavedChanges]);

  // Load message profile outputs using enhanced profileManager
  const loadMessageProfileOutputs = useCallback(async (messageFileName: string): Promise<MessageProfileOutput[]> => {
    try {
      // First try to determine the profile type by checking available profiles
      const availableProfiles = await profileManager.listMessageProfiles();
      const profileWithType = availableProfiles.find(p => p.fileName === messageFileName);
      const profileType = profileWithType?.type || 'user'; // Default to 'user' for backwards compatibility
      
      const profile = await profileManager.getMessageProfile(messageFileName, profileType);
      if (profile?.outputs) {
        return profile.outputs;
      }
      
      // Fallback to old method if enhanced method fails
      if (isElectron() && window.electron?.getMessageProfile) {
        const result = await window.electron.getMessageProfile(messageFileName);
        if (result?.success && result.profile?.outputs) {
          return result.profile.outputs;
        }
      } else {
        // Web mode - Use messageProfiles
        const profile = await messageProfiles.loadMessageProfile(messageFileName);
        if (profile?.outputs) {
          return profile.outputs;
        }
      }
      return [];
    } catch (error) {
      console.error("Failed to load message profile outputs:", error);
      return [];
    }
  }, []);

  // Load memory profile outputs using enhanced profileManager
  const loadMemoryProfileOutputs = useCallback(async (memoryFileName: string): Promise<MemoryProfileOutput[]> => {
    try {
      // First try to determine the profile type by checking available profiles
      const availableProfiles = await profileManager.listMemoryProfiles();
      const profileWithType = availableProfiles.find(p => p.fileName === memoryFileName);
      const profileType = profileWithType?.type || 'user'; // Default to 'user' for backwards compatibility
      
      const profile = await profileManager.getMemoryProfile(memoryFileName, profileType);
      if (profile?.outputs) {
        return profile.outputs;
      }
      
      // Fallback to old method if enhanced method fails
      if (isElectron() && window.electron?.getMemoryProfile) {
        const result = await window.electron.getMemoryProfile(memoryFileName);
        if (result?.success && result.profile?.outputs) {
          return result.profile.outputs;
        }
      }
      return [];
    } catch (error) {
      console.error("Failed to load memory profile outputs:", error);
      return [];
    }
  }, []);

  // Load combined outputs from both memory and message profiles
  const loadCombinedOutputs = useCallback(async (memoryFileName?: string, messageFileName?: string, gameProfile?: GameProfile | null) => {
    try {
      const memoryOutputs = memoryFileName ? await loadMemoryProfileOutputs(memoryFileName) : [];
      const messageOutputs = messageFileName ? await loadMessageProfileOutputs(messageFileName) : [];

      // Convert message outputs to memory format and mark source
      const convertedMessageOutputs = messageOutputs.map(output => ({
        output: convertMessageOutputToMemoryFormat(output),
        source: 'message' as const,
        originalMessageKey: output.key // Store the original key separately
      }));

      const memoryMappingOutputs = memoryOutputs.map(output => ({
        output,
        source: 'memory' as const,
        originalMessageKey: undefined
      }));

      // Combine all outputs
      const allOutputs = [...memoryMappingOutputs, ...convertedMessageOutputs];

      const newMappings: OutputMapping[] = allOutputs.map(({ output, source, originalMessageKey }) => {
        let gameOutput;
        
        // Find matching game profile output by label and source type
        if (source === 'message') {
          // For message outputs, match by the original message key
          gameOutput = gameProfile?.outputs?.find(go => 
            go.key === originalMessageKey || (go.label === output.label && go.key)
          );
        } else {
          // For memory outputs, match by label and ensure it doesn't have a key (indicating it's not a message output)
          gameOutput = gameProfile?.outputs?.find(go => 
            go.label === output.label && !go.key
          );
        }
        
        let deviceType = "";
        let targetDevice = "";
        let outputChannel = "";
        let active = true;
        
        if (gameOutput) {
          // Use saved settings from game profile with device type normalization
          deviceType = normalizeDeviceType(gameOutput.device || "");
          targetDevice = gameOutput.targetDevice || "";
          active = gameOutput.isActive !== undefined ? gameOutput.isActive : true;
          
          // Map channel/wledProfileId to outputChannel based on device type
          if (gameOutput.device === "WLED" && gameOutput.wledProfileId) {
            outputChannel = gameOutput.wledProfileId;
          } else if (gameOutput.channel !== undefined) {
            outputChannel = gameOutput.channel.toString();
          }
        }
        
        return {
          output,
          deviceType,
          targetDevice,
          outputChannel,
          active,
          source
        };
      });
      
      setMappings(newMappings);
      setOriginalMappings(JSON.parse(JSON.stringify(newMappings))); // Deep copy for comparison

      // Share this data with GameProfileForm
      if (window) {
        (window as any).currentMemoryOutputs = memoryOutputs;
        (window as any).currentMessageOutputs = messageOutputs;
      }
    } catch (error) {
      console.error("Failed to load combined outputs:", error);
    }
  }, [loadMemoryProfileOutputs, loadMessageProfileOutputs]);

  // Load current game profile when selected
  useEffect(() => {
    if (selectedGameProfile) {
      loadGameProfile(selectedGameProfile);
    } else {
      setCurrentGameProfile(null);
      setMappings([]);
      setOriginalMappings([]);
      setOriginalProfileValues(null);
      clearUnsavedChanges(); // Clear changes when no profile selected
    }
  }, [selectedGameProfile, clearUnsavedChanges]);

  // Update selectedMemoryProfile and load outputs when currentGameProfile changes
  useEffect(() => {
    if (currentGameProfile) {
      setSelectedMemoryProfile(currentGameProfile.memoryFile || null);
      loadCombinedOutputs(
        currentGameProfile.memoryFile || undefined,
        currentGameProfile.messageFile || undefined,
        currentGameProfile
      );
      
      // Set original values for change detection
      setOriginalProfileValues({
        processName: currentGameProfile.processName || "",
        gameName: currentGameProfile.messageName || "",
        pollInterval: currentGameProfile.pollInterval || 100,
        isActive: currentGameProfile.isActive || false
      });
      
      // Clear any existing unsaved changes when loading a new profile
      clearUnsavedChanges();
    } else {
      setSelectedMemoryProfile(null);
      setMappings([]);
      setOriginalMappings([]);
      setOriginalProfileValues(null);
      clearUnsavedChanges();
    }
  }, [currentGameProfile, loadCombinedOutputs, clearUnsavedChanges]);

  // Load devices
  const loadDevices = useCallback(async () => {
    try {
      if (isElectron() && window.electron?.readDeviceStore) {
        const response = await window.electron.readDeviceStore();
        if (response && Array.isArray(response)) {
          setDevices(response);
        }
      }
    } catch (error) {
      console.error("Failed to load devices:", error);
    }
  }, []);

  // Load WLED profiles
  const loadWLEDProfiles = useCallback(async () => {
    try {
      if (isElectron() && window.electron?.listWLEDProfiles) {
        const response = await window.electron.listWLEDProfiles();
        if (response && Array.isArray(response)) {
          const profileObjects: WLEDOutputProfile[] = [];
          
          for (const profileName of response) {
            try {
              const profileContent = await window.electron.loadWLEDProfile?.(profileName);
              if (profileContent) {
                profileObjects.push(profileContent);
              }
            } catch (err) {
              console.error(`Failed to load WLED profile ${profileName}:`, err);
            }
          }
          
          setWledProfileObjects(profileObjects);
        }
      }
    } catch (error) {
      console.error("Failed to load WLED profiles:", error);
    }
  }, []);

  // Refresh game profiles list
  const refreshGameProfiles = useCallback(async () => {
    try {
      setIsLoading(true);
      if (isElectron() && window.electron?.getGameProfiles) {
        const result = await window.electron.getGameProfiles();
        if (Array.isArray(result)) {
          setGameProfiles(result);
        } else if (result && typeof result === 'object' && result !== null && 'profiles' in result) {
          const profilesResult = result as { profiles?: string[] };
          if (Array.isArray(profilesResult.profiles)) {
            setGameProfiles(profilesResult.profiles);
          }
        }
      } else {
        // Web mode - Use profileStorage
        const profiles = await profileStorage.listGameProfiles();
        setGameProfiles(profiles);
      }
    } catch (error) {
      console.error("Failed to load game profiles:", error);
      toast.error("Failed to load game profiles");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load a specific game profile
  const loadGameProfile = useCallback(async (profileName: string | null) => {
    if (!profileName) {
      setSelectedGameProfile(null);
      setCurrentGameProfile(null);
      return;
    }

    try {
      setIsLoading(true);
      setSelectedGameProfile(profileName);
      
      if (isElectron() && window.electron?.getGameProfile) {
        const result = await window.electron.getGameProfile(profileName);
        if (result?.success && result.profile) {
          setCurrentGameProfile(result.profile);
        } else {
          toast.error(`Failed to load profile: ${result?.error || "Unknown error"}`);
        }
      } else {
        // Web mode - Use profileStorage
        const profile = await profileStorage.getGameProfile(profileName);
        if (profile) {
          setCurrentGameProfile(profile);
        } else {
          toast.error("Failed to load game profile");
        }
      }
    } catch (error) {
      console.error("Failed to load game profile:", error);
      toast.error("Failed to load game profile");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete the current game profile
  const deleteGameProfile = useCallback(async () => {
    if (!selectedGameProfile) return;
    
    try {
      setIsLoading(true);
      
      if (isElectron() && window.electron?.removeGameProfile) {
        const response = await window.electron.removeGameProfile(selectedGameProfile);
        if (response && ((typeof response === 'object' && response.success) || response === true)) {
          toast.success(`Game profile "${selectedGameProfile}" deleted successfully`);
          setSelectedGameProfile(null);
          await refreshGameProfiles();
        } else {
          toast.error(`Failed to delete profile: ${typeof response === 'object' && response.error ? response.error : "Unknown error"}`);
        }
      } else {
        // Web mode - Use profileStorage
        const success = await profileStorage.deleteGameProfile(selectedGameProfile);
        if (success) {
          toast.success(`Game profile "${selectedGameProfile}" deleted successfully`);
          setSelectedGameProfile(null);
          await refreshGameProfiles();
        } else {
          toast.error("Failed to delete game profile");
        }
      }
    } catch (error) {
      console.error("Failed to delete game profile:", error);
      toast.error("Failed to delete game profile");
    } finally {
      setIsLoading(false);
    }
  }, [selectedGameProfile, refreshGameProfiles]);

  // Clear the current profile selection
  const clearProfile = useCallback(() => {
    setSelectedGameProfile(null);
    setCurrentGameProfile(null);
    setMappings([]);
    setOriginalMappings([]);
    setOriginalProfileValues(null);
    clearUnsavedChanges(); // Clear changes when clearing profile
  }, [clearUnsavedChanges]);

  // Update mapping function WITHOUT immediate change detection
  const updateMapping = useCallback((index: number, field: keyof OutputMapping, value: any) => {
    setMappings(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], [field]: value };
        
        // Reset dependent fields when device type changes
        if (field === "deviceType") {
          updated[index].targetDevice = "";
          updated[index].outputChannel = "";
        }
        
        // Reset output channel when target device changes
        if (field === "targetDevice") {
          updated[index].outputChannel = "";
        }
      }
      
      return updated;
    });
  }, []);

  // Get form values including message profile
  const getFormValues = useCallback(() => {
    const getFormValuesFunc = (window as any).getFormValues;
    if (typeof getFormValuesFunc === 'function') {
      return getFormValuesFunc();
    }
    return {
      processName: '',
      gameName: '',
      pollInterval: 100,
      isActive: false,
      memoryFile: '',
      messageFile: ''
    };
  }, []);

  // Set form values
  const setFormValues = useCallback((values: {
    processName?: string;
    pollInterval?: number;
    isActive?: boolean;
    memoryFile?: string;
    messageFile?: string;
  }) => {
    const setFormValuesFunc = (window as any).setFormValues;
    if (typeof setFormValuesFunc === 'function') {
      setFormValuesFunc(values);
    }
  }, []);

  // Check for profile changes
  const checkProfileChanges = useCallback(() => {
    if (!originalProfileValues) return;
    
    const currentValues = getFormValues();
    const hasChanges = 
      currentValues.processName !== originalProfileValues.processName ||
      currentValues.gameName !== originalProfileValues.gameName ||
      currentValues.pollInterval !== originalProfileValues.pollInterval ||
      currentValues.isActive !== originalProfileValues.isActive;
    
    if (hasChanges) {
      setHasUnsavedChanges(true, 'profile');
    }
  }, [originalProfileValues, getFormValues, setHasUnsavedChanges]);

  // Expose checkProfileChanges to window for form components to call
  useEffect(() => {
    (window as any).checkProfileChanges = checkProfileChanges;
    return () => {
      delete (window as any).checkProfileChanges;
    };
  }, [checkProfileChanges]);

  // Save current settings with enhanced support for both profile types and smart promotion logic
  const handleSaveSettings = useCallback(async (): Promise<boolean> => {
    if (!currentGameProfile || !selectedGameProfile) return false;
    
    try {
      setIsLoading(true);
      
      // Get the current form values using the context method instead of DOM queries
      const formValues = getFormValues();
      
      // Get the original values from ProfileSelectionForm
      const getOriginalProcessName = (window as any).getOriginalProcessName;
      const getOriginalPollInterval = (window as any).getOriginalPollInterval;
      const originalProcessName = getOriginalProcessName ? getOriginalProcessName() : currentGameProfile.processName;
      const originalPollInterval = getOriginalPollInterval ? getOriginalPollInterval() : currentGameProfile.pollInterval;
      
      // Check if there are any changes to save
      const hasProcessNameChange = formValues.processName !== originalProcessName;
      const hasPollIntervalChange = formValues.pollInterval !== originalPollInterval;
      const hasActiveChange = formValues.isActive !== currentGameProfile.isActive;
      const hasGameNameChange = (formValues.gameName || "") !== (currentGameProfile.messageName || "");
      
      // Get current mappings from the mapping table
      const getCurrentMappings = (window as any).getCurrentMappings;
      if (typeof getCurrentMappings !== 'function') {
        toast.error("Could not get current mappings");
        return false;
      }
      
      const currentMappings = getCurrentMappings();
      if (!Array.isArray(currentMappings)) {
        toast.error("Invalid mappings format");
        return false;
      }

      // **PHASE 4: Smart Sync Logic - Check if we need to promote non-user profiles**
      // Only promote when process name changes (not on every save)
      let profileToSave = currentGameProfile;
      let promotionMessage = "";

      if (hasProcessNameChange && gameProfileUsesNonUserProfiles(currentGameProfile)) {
        console.log("Process name changed and Game Profile uses non-user profiles, checking for promotion...");
        
        const promotionResult = await promoteGameProfileNonUserProfilesToUser(currentGameProfile);
        
        if (promotionResult.memoryPromoted || promotionResult.messagePromoted) {
          profileToSave = promotionResult.updatedProfile;
          
          const promotedItems = [];
          if (promotionResult.memoryPromoted) {
            const memoryType = currentGameProfile.memoryProfileType === 'default' ? 'default' : 'community';
            promotedItems.push(`${memoryType} memory profile`);
          }
          if (promotionResult.messagePromoted) {
            const messageType = currentGameProfile.messageProfileType === 'default' ? 'default' : 'community';
            promotedItems.push(`${messageType} message profile`);
          }
          
          promotionMessage = `${promotedItems.join(" and ")} promoted to user profile${promotedItems.length > 1 ? 's' : ''}. `;
          console.log(`Promotion completed: ${promotionMessage}`);
        }
      }
      
      // Transform mappings back to GameProfileOutput format
      const transformedOutputs = currentMappings.map((mapping) => {
        const { output, deviceType, targetDevice, outputChannel, active, source } = mapping;
        
        // For message outputs, extract the original key from the notes field
        let messageKey = undefined;
        if (source === 'message' && output.notes) {
          const match = output.notes.match(/Message output: (.+)/);
          if (match) {
            messageKey = match[1];
          }
        }
        
        // Start with all properties from the output
        const gameOutput = {
          label: output.label,
          type: output.type,
          address: source === 'memory' ? output.address : "", // Keep address for memory outputs, empty for message
          key: source === 'message' ? messageKey : undefined, // Set key for message outputs
          notes: output.notes,
          device: deviceType || "",
          channel: 0,
          invert: output.invert,
          format: output.format,
          script: output.script || "",
          useModuleOffset: output.useModuleOffset,
          moduleName: output.moduleName,
          offset: output.offset || "",
          offsets: output.offsets || [],
          bitmask: output.bitmask || "",
          bitwiseOp: output.bitwiseOp || "",
          bitfield: output.bitfield || false,
          isPointerChain: output.isPointerChain || false,
          isActive: active !== undefined ? active : true,
          targetDevice: targetDevice || "",
          wledProfileId: undefined,
        };
        
        // Handle channel/wledProfileId based on device type
        if (deviceType === "WLED" && outputChannel) {
          gameOutput.wledProfileId = outputChannel;
          gameOutput.channel = 0;
        } else if (outputChannel && !isNaN(parseInt(outputChannel))) {
          gameOutput.channel = parseInt(outputChannel);
        }
        
        return gameOutput;
      });
      
      // Check if process name changed and sync module if needed
      if (hasProcessNameChange) {
        // Manually sync module names before updating the profile
        const syncedOutputs = transformedOutputs.map(output => ({
          ...output,
          moduleName: output.moduleName === originalProcessName ? formValues.processName : output.moduleName
        }));
        
        // Create updated profile with form values and synced mapping data
        const updatedProfile = {
          ...profileToSave, // Use potentially promoted profile
          processName: formValues.processName,
          messageName: formValues.gameName || undefined,
          pollInterval: formValues.pollInterval,
          isActive: formValues.isActive,
          outputs: syncedOutputs,
          lastModified: Date.now()
        };
        
        // Save the game profile first
        let success = false;
        if (isElectron() && window.electron?.saveGameProfile) {
          const response = await window.electron.saveGameProfile(selectedGameProfile, updatedProfile);
          success = response?.success || false;
        } else {
          // Web mode - Use profileStorage
          success = await profileStorage.saveGameProfile(selectedGameProfile, updatedProfile);
        }
        
        if (success) {
          setCurrentGameProfile(updatedProfile);
          
          // Update original values after successful save
          setOriginalProfileValues({
            processName: formValues.processName,
            gameName: formValues.gameName,
            pollInterval: formValues.pollInterval,
            isActive: formValues.isActive
          });
          setOriginalMappings(JSON.parse(JSON.stringify(currentMappings)));
          clearUnsavedChanges(); // Clear unsaved changes after successful save
          
          // Enhanced success message with promotion info
          const baseMessage = "Profile updated successfully with module name sync";
          const finalMessage = promotionMessage ? promotionMessage + baseMessage : baseMessage;
          
          // Sync the associated memory profile if it exists and is now a user profile
          if (updatedProfile.memoryFile && updatedProfile.memoryProfileType === 'user' && window.electron?.getMemoryProfile && window.electron?.saveMemoryProfile) {
            try {
              console.log(`Syncing memory profile: ${updatedProfile.memoryFile}`);
              
              // Load the memory profile (now from user directory)
              const memoryResponse = await window.electron.getMemoryProfile(updatedProfile.memoryFile);
              
              if (memoryResponse && memoryResponse.success && memoryResponse.profile) {
                const memoryProfile = memoryResponse.profile;
                let hasMemoryChanges = false;
                
                // Update memory profile outputs where moduleName matches the original process name
                const updatedMemoryOutputs = memoryProfile.outputs.map((output: any) => {
                  if (output.moduleName === originalProcessName) {
                    hasMemoryChanges = true;
                    console.log(`Updating memory output '${output.label}' moduleName from '${originalProcessName}' to '${formValues.processName}'`);
                    return {
                      ...output,
                      moduleName: formValues.processName
                    };
                  }
                  return output;
                });
                
                if (hasMemoryChanges) {
                  // Update the memory profile content
                  const updatedMemoryProfile = {
                    ...memoryProfile,
                    process: formValues.processName, // Also update the main process field
                    outputs: updatedMemoryOutputs
                  };
                  
                  // Save the updated memory profile
                  const saveResponse = await window.electron.saveMemoryProfile(updatedProfile.memoryFile, updatedMemoryProfile);
                  
                  if (saveResponse && saveResponse.success) {
                    console.log(`Memory profile ${updatedProfile.memoryFile} synchronized successfully`);
                    toast.success(finalMessage);
                  } else {
                    console.error(`Failed to save memory profile: ${saveResponse?.error}`);
                    toast.warning(finalMessage + " but memory profile sync failed");
                  }
                } else {
                  console.log("No memory profile outputs needed updating");
                  toast.success(finalMessage);
                }
              } else {
                console.error(`Failed to load memory profile: ${memoryResponse?.error}`);
                toast.warning(finalMessage + " but memory profile could not be loaded for sync");
              }
            } catch (error) {
              console.error("Error syncing memory profile:", error);
              toast.warning(finalMessage + " but memory profile sync encountered an error");
            }
          } else {
            // No memory profile to sync or not in Electron environment
            toast.success(finalMessage);
          }
          
          // Refresh mappings after successful save
          await loadCombinedOutputs(
            updatedProfile.memoryFile || undefined,
            updatedProfile.messageFile || undefined,
            updatedProfile
          );
          
          return true;
        } else {
          toast.error("Failed to save profile");
          return false;
        }
      } else {
        // No process name change, just update normally without promotion
        const updatedProfile = {
          ...profileToSave, // Use current profile (no promotion needed)
          processName: formValues.processName,
          messageName: formValues.gameName || undefined,
          pollInterval: formValues.pollInterval,
          isActive: formValues.isActive,
          outputs: transformedOutputs,
          lastModified: Date.now()
        };
        
        let success = false;
        if (isElectron() && window.electron?.saveGameProfile) {
          const response = await window.electron.saveGameProfile(selectedGameProfile, updatedProfile);
          success = response?.success || false;
        } else {
          // Web mode - Use profileStorage
          success = await profileStorage.saveGameProfile(selectedGameProfile, updatedProfile);
        }
        
        if (success) {
          setCurrentGameProfile(updatedProfile);
          
          // Update original values after successful save
          setOriginalProfileValues({
            processName: formValues.processName,
            gameName: formValues.gameName,
            pollInterval: formValues.pollInterval,
            isActive: formValues.isActive
          });
          setOriginalMappings(JSON.parse(JSON.stringify(currentMappings)));
          clearUnsavedChanges(); // Clear unsaved changes after successful save
          
          // Success message without promotion info since no promotion occurred
          toast.success("Profile updated successfully");
          
          // Refresh mappings after successful save
          await loadCombinedOutputs(
            updatedProfile.memoryFile || undefined,
            updatedProfile.messageFile || undefined,
            updatedProfile
          );
          
          return true;
        } else {
          toast.error("Failed to save profile");
          return false;
        }
      }
    } catch (error) {
      console.error("Failed to save game profile:", error);
      toast.error("Failed to save game profile");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentGameProfile, selectedGameProfile, getFormValues, loadCombinedOutputs, clearUnsavedChanges]);

  // Create a new game profile with enhanced profile type detection
  const createGameProfile = useCallback(async (profile: GameProfile): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const fileName = `${profile.profileName}.json`;
      
      // **PHASE 4: Enhanced profile type detection during creation**
      const enhancedProfile = { ...profile };
      
      // Detect memory profile type if not already set
      if (enhancedProfile.memoryFile && !enhancedProfile.memoryProfileType) {
        try {
          const availableProfiles = await profileManager.listMemoryProfiles();
          const profileWithType = availableProfiles.find(p => p.fileName === enhancedProfile.memoryFile);
          enhancedProfile.memoryProfileType = profileWithType?.type || 'user';
          console.log(`Detected memory profile type: ${enhancedProfile.memoryProfileType} for ${enhancedProfile.memoryFile}`);
        } catch (error) {
          console.error("Error detecting memory profile type:", error);
          enhancedProfile.memoryProfileType = 'user'; // Default fallback
        }
      }
      
      // Detect message profile type if not already set
      if (enhancedProfile.messageFile && !enhancedProfile.messageProfileType) {
        try {
          const availableProfiles = await profileManager.listMessageProfiles();
          const profileWithType = availableProfiles.find(p => p.fileName === enhancedProfile.messageFile);
          enhancedProfile.messageProfileType = profileWithType?.type || 'user';
          console.log(`Detected message profile type: ${enhancedProfile.messageProfileType} for ${enhancedProfile.messageFile}`);
        } catch (error) {
          console.error("Error detecting message profile type:", error);
          enhancedProfile.messageProfileType = 'user'; // Default fallback
        }
      }
      
      if (isElectron() && window.electron?.saveGameProfile) {
        const response = await window.electron.saveGameProfile(fileName, enhancedProfile);
        if (response?.success) {
          await refreshGameProfiles();
          setSelectedGameProfile(fileName);
          return true;
        } else {
          toast.error(`Failed to create profile: ${response?.error || "Unknown error"}`);
          return false;
        }
      } else {
        // Web mode - Use profileStorage
        const success = await profileStorage.saveGameProfile(fileName, enhancedProfile);
        if (success) {
          await refreshGameProfiles();
          setSelectedGameProfile(fileName);
          return true;
        } else {
          toast.error("Failed to create game profile");
          return false;
        }
      }
    } catch (error) {
      console.error("Failed to create game profile:", error);
      toast.error("Failed to create game profile");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshGameProfiles]);

  // Update game profile including message file
  const updateGameProfile = useCallback(async (updatedProfile: GameProfile): Promise<boolean> => {
    if (!selectedGameProfile) return false;
    
    try {
      setIsLoading(true);
      
      if (isElectron() && window.electron?.saveGameProfile) {
        const response = await window.electron.saveGameProfile(selectedGameProfile, updatedProfile);
        if (response?.success) {
          setCurrentGameProfile(updatedProfile);
          await refreshGameProfiles();
          return true;
        } else {
          toast.error(`Failed to update profile: ${response?.error || "Unknown error"}`);
          return false;
        }
      } else {
        // Web mode - Use profileStorage
        const success = await profileStorage.saveGameProfile(selectedGameProfile, updatedProfile);
        if (success) {
          setCurrentGameProfile(updatedProfile);
          await refreshGameProfiles();
          return true;
        } else {
          toast.error("Failed to update game profile");
          return false;
        }
      }
    } catch (error) {
      console.error("Failed to update game profile:", error);
      toast.error("Failed to update game profile");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [selectedGameProfile, refreshGameProfiles]);

  // Context value
  const contextValue: GameManagerContextType = {
    gameProfiles,
    selectedGameProfile,
    currentGameProfile,
    isLoading,
    setSelectedGameProfile,
    loadGameProfile,
    refreshGameProfiles,
    deleteGameProfile,
    clearProfile,
    handleSaveSettings,
    createGameProfile,
    updateGameProfile,
    getFormValues,
    setFormValues,
    selectedMemoryProfile,
    mappings,
    devices,
    wledProfileObjects,
    updateMapping
  };

  return (
    <GameManagerContext.Provider value={contextValue}>
      {children}
    </GameManagerContext.Provider>
  );
};

// Custom hook to use the context
export const useGameManager = () => {
  const context = useContext(GameManagerContext);
  if (context === undefined) {
    throw new Error("useGameManager must be used within a GameManagerProvider");
  }
  return context;
};
