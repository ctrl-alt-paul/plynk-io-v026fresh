import React, { useEffect, useState, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MemoryProfile } from "@/types/memoryProfiles";
import { GameProfile, GameProfileOutput } from "@/types/profiles";
import { profileStorage } from "@/lib/profileStorage";
import { isElectron } from "@/utils/isElectron";
import { v4 as uuidv4 } from "uuid";

// Add a type definition for the mapping format
interface MappingTableRow {
  output: any;
  deviceType: string;
  targetDevice: string;
  outputChannel: string;
  active: boolean;
}

interface GameProfileFormProps {
  onProfileSelectionChange?: (gameProfile: string | null, memoryProfile: string | null) => void;
  initialMemoryProfile?: string | null;
  refreshTrigger?: number;
  selectedGameProfile?: string | null;
  refreshProfiles?: () => Promise<void>; // Add new prop for refreshing profiles
}

export const GameProfileForm: React.FC<GameProfileFormProps> = ({ 
  onProfileSelectionChange, 
  initialMemoryProfile = null,
  refreshTrigger = 0,
  selectedGameProfile = null,
  refreshProfiles  // Add new prop
}) => {
  const [gameProfiles, setGameProfiles] = useState<string[]>([]);
  const [memoryProfiles, setMemoryProfiles] = useState<string[]>([]);
  const [internalSelectedGameProfile, setInternalSelectedGameProfile] = useState<string | null>(selectedGameProfile);
  const [selectedMemoryProfile, setSelectedMemoryProfile] = useState<string | null>(initialMemoryProfile);
  const [processName, setProcessName] = useState<string>("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newMemoryProfile, setNewMemoryProfile] = useState<string | null>(null);
  const [newProcessName, setNewProcessName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentMemoryOutputs, setCurrentMemoryOutputs] = useState<any[]>([]);
  
  // Add state to store mappings from the mapping table
  const [currentMappings, setCurrentMappings] = useState<MappingTableRow[]>([]);
  
  // Add state to store the loaded profile including its ID
  const [loadedProfile, setLoadedProfile] = useState<GameProfile | null>(null);

  // Update internal state when selectedGameProfile prop changes
  useEffect(() => {
    if (selectedGameProfile !== internalSelectedGameProfile) {
      setInternalSelectedGameProfile(selectedGameProfile);
      
      // If selectedGameProfile is not null, load the profile details
      if (selectedGameProfile) {
        handleGameProfileChange(selectedGameProfile);
      }
    }
  }, [selectedGameProfile]);

  // Initialize with initialMemoryProfile if provided
  useEffect(() => {
    if (initialMemoryProfile) {
      setSelectedMemoryProfile(initialMemoryProfile);
    }
  }, [initialMemoryProfile]);

  // Register the updateMappingsFromForm function on the window object
  useEffect(() => {
    const updateMappingsFromForm = (mappings: MappingTableRow[]) => {
      //console.log("Received mappings in GameProfileForm:", mappings);
      setCurrentMappings(mappings);
    };
    
    // Register the function on the window object
    (window as any).updateMappingsFromForm = updateMappingsFromForm;
    
    // Clean up function when component unmounts
    return () => {
      delete (window as any).updateMappingsFromForm;
    };
  }, []);

  // Load memory profiles
  useEffect(() => {
    const fetchMemoryProfiles = async () => {
      try {
        const response = await window.electron.listMemoryProfiles();
        if (response && response.success && Array.isArray(response.profiles)) {
          setMemoryProfiles(response.profiles);
        } else {
          //console.error("Failed to load memory profiles:", response?.error || "Unknown error");
          toast.error("Failed to load memory profiles");
        }
      } catch (error) {
        //console.error("Failed to load memory profiles:", error);
        toast.error("Failed to load memory profiles");
      }
    };

    fetchMemoryProfiles();
  }, []);

  // Load game profiles - Modified to respond to refreshTrigger
  useEffect(() => {
    const fetchGameProfiles = async () => {
      try {
        if (isElectron()) {
          // Use Electron IPC
          const result = await window.electron.getGameProfiles?.();
          
          // Type guard to ensure we're working with the expected data structure
          if (result && typeof result === 'object') {
            if ('success' in result && 'profiles' in result && Array.isArray(result.profiles)) {
              setGameProfiles(result.profiles);
            } else if (Array.isArray(result)) {
              setGameProfiles(result);
            } else {
              //console.error("Failed to load game profiles: Unexpected response format");
              toast.error("Failed to load game profiles");
            }
          } else if (Array.isArray(result)) {
            setGameProfiles(result);
          } else {
            //console.error("Failed to load game profiles: Invalid response");
            toast.error("Failed to load game profiles");
          }
        } else {
          // Web mode - Use profileStorage
          const profiles = await profileStorage.listGameProfiles();
          setGameProfiles(profiles);
        }
      } catch (error) {
        //console.error("Failed to load game profiles:", error);
        toast.error("Failed to load game profiles");
      }
    };

    fetchGameProfiles();
  }, [refreshTrigger]); // Add refreshTrigger to dependencies array

  // Handle memory profile selection
  const handleMemoryProfileChange = async (value: string) => {
    setSelectedMemoryProfile(value);
    //console.log(`GameProfileForm: Memory profile changed to ${value}`);
    
    try {
      // Load memory profile details
      const response = await window.electron.getMemoryProfile?.(value);
      if (response?.success && response?.profile && typeof response.profile === 'object' && 'process' in response.profile) {
        setProcessName(response.profile.process);
        
        // Store memory outputs for later use
        if (response.profile.outputs && Array.isArray(response.profile.outputs)) {
          setCurrentMemoryOutputs(response.profile.outputs);
          
          // Update window property to share data with GameProfileMappingTable
          if (window) {
            (window as any).currentMemoryOutputs = response.profile.outputs;
            
            // Trigger mapping table update if it exists
            const event = new CustomEvent('memoryProfileChanged', { detail: response.profile.outputs });
            window.dispatchEvent(event);
          }
        }
      }
      
      // Notify parent component about selection change
      if (onProfileSelectionChange) {
        onProfileSelectionChange(internalSelectedGameProfile, value);
      }
    } catch (error) {
      //console.error("Failed to load memory profile:", error);
      toast.error("Failed to load memory profile details");
    }
  };

  // Handle game profile selection - Updated to preserve messageFile
  const handleGameProfileChange = async (value: string) => {
    setInternalSelectedGameProfile(value);
    //console.log(`GameProfileForm: Game profile changed to ${value}`);
    
    // Load the game profile
    try {
      if (isElectron() && window.electron) {
        const response = await window.electron.getGameProfile(value);
        
        if (response?.success && response?.profile) {
          const loadedProfile = response.profile;
          
          // Store the full profile object including ID and messageFile for later use
          setLoadedProfile({
            ...loadedProfile,
            messageFile: loadedProfile.messageFile || undefined // Safely handle missing field
          });
          
          // Set memory profile based on the game profile
          const memoryFile = loadedProfile.memoryFile;
          setSelectedMemoryProfile(memoryFile);
          setProcessName(loadedProfile.processName || "");
          
          // Load the referenced memory profile to update the process name and outputs
          if (memoryFile && window.electron) {
            const memResponse = await window.electron.getMemoryProfile(memoryFile);
            if (memResponse?.success && memResponse?.profile && typeof memResponse.profile === 'object') {
              if ('process' in memResponse.profile) {
                setProcessName(memResponse.profile.process);
              }
              
              // Store memory outputs for later use
              if (memResponse.profile.outputs && Array.isArray(memResponse.profile.outputs)) {
                setCurrentMemoryOutputs(memResponse.profile.outputs);
                
                // Update window property to share data with GameProfileMappingTable
                if (window) {
                  (window as any).currentMemoryOutputs = memResponse.profile.outputs;
                  
                  // Trigger mapping table update
                  const event = new CustomEvent('memoryProfileChanged', { detail: memResponse.profile.outputs });
                  window.dispatchEvent(event);
                }
              }
            }
          }
          
          // Notify parent component about both profile changes
          if (onProfileSelectionChange) {
            onProfileSelectionChange(value, memoryFile);
          }
        } else {
          //console.error("Failed to load game profile:", response?.error || "Unknown error");
          toast.error(`Failed to load game profile: ${response?.error || "Unknown error"}`);
        }
      } else {
        // Web mode - Use profileStorage
        const profile = await profileStorage.getGameProfile(value);
        if (profile) {
          // Store the full profile object including ID and messageFile for later use
          setLoadedProfile({
            ...profile,
            messageFile: profile.messageFile || undefined // Safely handle missing field
          });
          
          // Set memory profile based on the game profile
          setSelectedMemoryProfile(profile.memoryFile);
          setProcessName(profile.processName || "");
          
          // Notify parent component about both profile changes
          if (onProfileSelectionChange) {
            onProfileSelectionChange(value, profile.memoryFile);
          }
          
          // Load the memory profile data
          if (profile.memoryFile) {
            const memProfile = await profileStorage.getMemoryProfile(profile.memoryFile);
            if (memProfile && memProfile.outputs && Array.isArray(memProfile.outputs)) {
              setCurrentMemoryOutputs(memProfile.outputs);
              
              // Update window property to share data with GameProfileMappingTable
              if (window) {
                (window as any).currentMemoryOutputs = memProfile.outputs;
                
                // Trigger mapping table update
                const event = new CustomEvent('memoryProfileChanged', { detail: memProfile.outputs });
                window.dispatchEvent(event);
              }
            }
          }
        }
      }
    } catch (error) {
      //console.error("Failed to load game profile:", error);
      toast.error("Failed to load game profile");
    }
  };

  // Handle new memory profile selection in dialog
  const handleNewMemoryProfileChange = async (value: string) => {
    setNewMemoryProfile(value);
    //console.log(`GameProfileForm: New memory profile set to ${value}`);
    
    try {
      // Load memory profile details
      const response = await window.electron.getMemoryProfile?.(value);
      if (response?.success && response?.profile && typeof response.profile === 'object') {
        if ('process' in response.profile) {
          setNewProcessName(response.profile.process);
        }
        
        // Store memory outputs for later use
        if (response.profile.outputs && Array.isArray(response.profile.outputs)) {
          setCurrentMemoryOutputs(response.profile.outputs);
          
          // Update window property to share data with GameProfileMappingTable
          if (window) {
            (window as any).currentMemoryOutputs = response.profile.outputs;
            
            // Trigger mapping table update
            const event = new CustomEvent('memoryProfileChanged', { detail: response.profile.outputs });
            window.dispatchEvent(event);
          }
        }
      }
    } catch (error) {
      //console.error("Failed to load memory profile:", error);
    }
  };

  // Reset form
  const handleClear = () => {
    setInternalSelectedGameProfile(null);
    setSelectedMemoryProfile(null);
    setProcessName("");
    setCurrentMemoryOutputs([]);
    
    // Notify parent component about cleared selection
    if (onProfileSelectionChange) {
      onProfileSelectionChange(null, null);
    }
    
    // Clear window property
    if (window) {
      (window as any).currentMemoryOutputs = [];
    }
    
    // Also clear the loaded profile
    setLoadedProfile(null);
  };

  // Open create dialog
  const handleOpenCreateDialog = () => {
    setNewProfileName("");
    setNewMemoryProfile(selectedMemoryProfile); // Use current memory profile as default
    setNewProcessName(processName);  // Use current process name as default
    setIsCreateDialogOpen(true);
    
    // If a memory profile is already selected, load its outputs
    if (selectedMemoryProfile) {
      handleNewMemoryProfileChange(selectedMemoryProfile);
    }
  };

  // Handle create new game profile - Updated to preserve messageFile if present
  const handleCreateProfile = async () => {
    if (!newProfileName || !newMemoryProfile) {
      toast.error("Profile name and memory profile are required");
      return;
    }

    try {
      setIsLoading(true);
      
      // Get memory profile outputs - this is crucial for creating a meaningful game profile
      let memoryOutputs: any[] = currentMemoryOutputs;
      
      // If we don't have outputs yet, load them from the selected memory profile
      if (!memoryOutputs.length && newMemoryProfile) {
        try {
          const memResponse = await window.electron.getMemoryProfile?.(newMemoryProfile);
          if (memResponse?.success && memResponse.profile && memResponse.profile.outputs) {
            memoryOutputs = memResponse.profile.outputs;
          }
        } catch (err) {
          //console.error("Failed to load memory profile outputs:", err);
        }
      }
      
      // Now get the current mappings from the mapping table component
      let mappings: any[] = [];
      if (memoryOutputs.length > 0) {
        // Initialize default mappings from memory outputs if no mappings exist
        mappings = memoryOutputs.map(output => ({
          output,
          deviceType: "",
          targetDevice: "",
          outputChannel: "",
          active: true
        }));
      }

      // Create the profile object - preserve messageFile if it exists in the current context
      const fileName = `${newProfileName}.json`;
      const profile: GameProfile = {
        id: uuidv4(),
        profileName: newProfileName,
        memoryFile: newMemoryProfile,
        messageFile: undefined, // Will be set in future phases
        processName: newProcessName,
        pollInterval: 100, // Default poll interval
        outputs: mappings.map(mapping => {
          // Base output structure
          const baseOutput: GameProfileOutput = {
            label: mapping.output.label || "",
            type: mapping.output.type || "Int32",
            address: mapping.output.address || "",
            notes: mapping.output.notes || "",
            device: mapping.deviceType || "",
            channel: 0, // Default value, will be updated for non-WLED devices
            invert: mapping.output.invert !== undefined ? mapping.output.invert : false,
            format: mapping.output.format || "{value}",
            script: mapping.output.script || "",
            useModuleOffset: mapping.output.useModuleOffset || false,
            moduleName: mapping.output.moduleName || "",
            offset: mapping.output.offset || "",
            offsets: mapping.output.offsets || [],
            bitmask: mapping.output.bitmask || "",
            bitwiseOp: mapping.output.bitwiseOp || "",
            bitfield: mapping.output.bitfield || false,
            isPointerChain: mapping.output.isPointerChain || false,
            isActive: mapping.active !== undefined ? mapping.active : true,
            targetDevice: mapping.targetDevice || "" // Store the targetDevice ID
          };
          
          // Handle device-specific settings
          if (mapping.deviceType === "WLED" && mapping.outputChannel) {
            //console.log(`Creating profile with WLED output: ${mapping.outputChannel}`);
            baseOutput.wledProfileId = mapping.outputChannel;
          } else if (mapping.outputChannel) {
            // For non-WLED devices, parse as number
            baseOutput.channel = parseInt(mapping.outputChannel) || 0;
          }
          
          return baseOutput;
        }),
        isActive: false,
        lastModified: Date.now()
      };

      //console.log("Creating game profile with outputs:", profile.outputs.length);

      // Save the profile
      if (isElectron()) {
        const response = await window.electron.saveGameProfile?.(fileName, profile);
        if (response?.success) {
          toast.success(`Game profile created: ${newProfileName}`);
          
          // Refresh the game profiles list
          const updatedProfiles = [...gameProfiles];
          if (!updatedProfiles.includes(fileName)) {
            updatedProfiles.push(fileName);
            setGameProfiles(updatedProfiles);
          }
          
          // Important: Set both values before calling the callback
          setInternalSelectedGameProfile(fileName);
          setSelectedMemoryProfile(newMemoryProfile);
          setProcessName(newProcessName);
          setIsCreateDialogOpen(false);
          
          // Now notify parent component about both selections
          //console.log(`GameProfileForm: Notifying parent with game=${fileName}, memory=${newMemoryProfile}`);
          if (onProfileSelectionChange) {
            onProfileSelectionChange(fileName, newMemoryProfile);
          }

          // Refresh profiles in the parent component to update the dropdown
          if (refreshProfiles) {
            await refreshProfiles();
          }
        } else {
          toast.error(`Failed to create profile: ${response?.error || "Unknown error"}`);
        }
      } else {
        // Web mode - Use profileStorage
        const success = await profileStorage.saveGameProfile(fileName, profile);
        if (success) {
          toast.success(`Game profile created: ${newProfileName}`);
          
          // Refresh the game profiles list
          const updatedProfiles = [...gameProfiles];
          if (!updatedProfiles.includes(fileName)) {
            updatedProfiles.push(fileName);
            setGameProfiles(updatedProfiles);
          }
          
          // Important: Set both values before calling the callback
          setInternalSelectedGameProfile(fileName);
          setSelectedMemoryProfile(newMemoryProfile);
          setProcessName(newProcessName);
          setIsCreateDialogOpen(false);
          
          // Now notify parent component about both selections
          //console.log(`GameProfileForm: Notifying parent with game=${fileName}, memory=${newMemoryProfile}`);
          if (onProfileSelectionChange) {
            onProfileSelectionChange(fileName, newMemoryProfile);
          }

          // Refresh profiles in the parent component to update the dropdown
          if (refreshProfiles) {
            await refreshProfiles();
          }
        } else {
          toast.error("Failed to create game profile");
        }
      }
    } catch (error) {
      //console.error("Failed to create game profile:", error);
      toast.error("Failed to create game profile");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to update the current game profile - Modified to preserve messageFile
  const handleUpdateCurrentProfile = async () => {
    if (!internalSelectedGameProfile || !selectedMemoryProfile) {
      toast.error("Game profile and memory profile are required");
      return;
    }

    try {
      setIsLoading(true);

      // Use mappings from the mapping table if available
      let mappings: MappingTableRow[] = currentMappings;
      
      // If no mappings are available from the table, initialize from memory outputs
      if (!mappings || mappings.length === 0) {
        let memoryOutputs: any[] = currentMemoryOutputs;
        
        // If we don't have outputs yet, load them from the selected memory profile
        if (!memoryOutputs.length && selectedMemoryProfile) {
          try {
            const memResponse = await window.electron.getMemoryProfile?.(selectedMemoryProfile);
            if (memResponse?.success && memResponse.profile && memResponse.profile.outputs) {
              memoryOutputs = memResponse.profile.outputs;
            }
          } catch (err) {
            //console.error("Failed to load memory profile outputs:", err);
          }
        }
        
        // Initialize default mappings from memory outputs if no mappings exist
        if (memoryOutputs.length > 0) {
          mappings = memoryOutputs.map(output => ({
            output,
            deviceType: "",
            targetDevice: "",
            outputChannel: "",
            active: true
          }));
        }
      } else {
        //console.log("Using mappings from the mapping table:", mappings);
      }

      // Create the updated profile object
      // IMPORTANT: Use the existing ID and preserve messageFile from the loaded profile
      const profile: GameProfile = {
        id: loadedProfile?.id || uuidv4(), // Use existing ID if available, otherwise generate new one
        profileName: internalSelectedGameProfile.replace(".json", ""),
        memoryFile: selectedMemoryProfile,
        messageFile: loadedProfile?.messageFile || undefined, // Preserve existing messageFile
        processName: processName,
        pollInterval: loadedProfile?.pollInterval || 100, // Use existing poll interval if available
        outputs: mappings.map(mapping => {
          // Base output structure
          const baseOutput: GameProfileOutput = {
            label: mapping.output.label || "",
            type: mapping.output.type || "Int32",
            address: mapping.output.address || "",
            notes: mapping.output.notes || "",
            device: mapping.deviceType || "",
            channel: 0, // Default value, will be updated for non-WLED devices
            invert: mapping.output.invert !== undefined ? mapping.output.invert : false,
            format: mapping.output.format || "{value}",
            script: mapping.output.script || "",
            useModuleOffset: mapping.output.useModuleOffset || false,
            moduleName: mapping.output.moduleName || "",
            offset: mapping.output.offset || "",
            offsets: mapping.output.offsets || [],
            bitmask: mapping.output.bitmask || "",
            bitwiseOp: mapping.output.bitwiseOp || "",
            bitfield: mapping.output.bitfield || false,
            isPointerChain: mapping.output.isPointerChain || false,
            isActive: mapping.active !== undefined ? mapping.active : true,
            targetDevice: mapping.targetDevice || "" // Store the targetDevice ID
          };
          
          // Handle device-specific settings
          if (mapping.deviceType === "WLED" && mapping.outputChannel) {
            //console.log(`Updating profile with WLED output: ${mapping.outputChannel}`);
            baseOutput.wledProfileId = mapping.outputChannel;
          } else if (mapping.outputChannel) {
            // For non-WLED devices, parse as number
            baseOutput.channel = parseInt(mapping.outputChannel) || 0;
          }
          
          return baseOutput;
        }),
        isActive: loadedProfile?.isActive || false, // Preserve isActive state
        lastModified: Date.now()
      };

      //console.log("Updating game profile with outputs:", profile.outputs.length);
      //console.log("Using profile ID:", profile.id);
      //console.log("Preserving messageFile:", profile.messageFile);

      // Save the updated profile
      if (isElectron()) {
        const response = await window.electron.saveGameProfile?.(internalSelectedGameProfile, profile);
        if (response?.success) {
          toast.success(`Game profile updated: ${internalSelectedGameProfile}`);
        } else {
          toast.error(`Failed to update profile: ${response?.error || "Unknown error"}`);
        }
      } else {
        // Web mode - Use profileStorage
        const success = await profileStorage.saveGameProfile(internalSelectedGameProfile, profile);
        if (success) {
          toast.success(`Game profile updated: ${internalSelectedGameProfile}`);
        } else {
          toast.error("Failed to update game profile");
        }
      }
    } catch (error) {
      //console.error("Failed to update game profile:", error);
      toast.error("Failed to update game profile");
    } finally {
      setIsLoading(false);
    }
  };

  // Render the more compact form with only memory profile and process name
  return (
    <>
      {/* Form fields - more compact layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="memoryProfile">Memory Profile</Label>
          <Select
            value={selectedMemoryProfile || ""}
            onValueChange={handleMemoryProfileChange}
          >
            <SelectTrigger id="memoryProfile">
              <SelectValue placeholder="Select memory profile" />
            </SelectTrigger>
            <SelectContent>
              {memoryProfiles.map((profile) => (
                <SelectItem key={profile} value={profile}>
                  {profile.replace(".json", "")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="processName">Process Name</Label>
          <Input
            id="processName"
            value={processName}
            onChange={(e) => setProcessName(e.target.value)}
            placeholder="Process name"
          />
        </div>
      </div>

      {/* Create Profile Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Game Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newProfileName" className="text-right">
                Profile Name
              </Label>
              <Input
                id="newProfileName"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newMemoryProfile" className="text-right">
                Memory Profile
              </Label>
              <div className="col-span-3">
                <Select
                  value={newMemoryProfile || ""}
                  onValueChange={handleNewMemoryProfileChange}
                >
                  <SelectTrigger id="newMemoryProfile">
                    <SelectValue placeholder="Select memory profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {memoryProfiles.map((profile) => (
                      <SelectItem key={profile} value={profile}>
                        {profile.replace(".json", "")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newProcessName" className="text-right">
                Process Name
              </Label>
              <Input
                id="newProcessName"
                value={newProcessName}
                onChange={(e) => setNewProcessName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              onClick={handleCreateProfile} 
              disabled={!newProfileName || !newMemoryProfile || isLoading}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Hidden buttons for other components to interact with */}
      <div className="hidden">
        <Button onClick={handleOpenCreateDialog} id="createProfileButton">Create Profile</Button>
        <Button onClick={handleClear} id="clearButton">Clear</Button>
        <Button onClick={handleUpdateCurrentProfile} id="updateProfileButton">Update Profile</Button>
        <Button 
          onClick={(e) => {
            const profileName = (e.currentTarget as HTMLElement).getAttribute('data-profile');
            if (profileName) {
              handleGameProfileChange(profileName);
            }
          }} 
          id="loadGameProfileButton"
        >
          Load Profile
        </Button>
      </div>
    </>
  );
};
