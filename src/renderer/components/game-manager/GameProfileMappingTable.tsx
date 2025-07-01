import React, { useState, useEffect } from "react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  TableCompact,
  TableCompactHeader,
  TableCompactBody,
  TableCompactRow,
  TableCompactHead,
  TableCompactCell
} from "@/components/ui/table-compact";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MemoryProfile, MemoryProfileOutput } from "@/types/memoryProfiles";
import { Device, PacDriveDevice, WLEDDevice } from "@/types/devices";
import { toast } from "sonner";
import { formatMemoryAddress } from "@/renderer/utils/formatters";
import { WLEDOutputProfile } from "@/lib/wledProfiles";
import { GameProfile } from "@/types/profiles";
import { profileStorage } from "@/lib/profileStorage";
import { isElectron } from "@/utils/isElectron";
import { Save } from "lucide-react";

interface GameProfileMappingTableProps {
  selectedMemoryProfile: string | null;
  selectedGameProfile: string | null;
  onSaveSettings?: () => Promise<void>; 
}

export const GameProfileMappingTable: React.FC<GameProfileMappingTableProps> = ({
  selectedMemoryProfile,
  selectedGameProfile,
  onSaveSettings,
}) => {
  const [memoryProfile, setMemoryProfile] = useState<MemoryProfile | null>(null);
  const [gameProfile, setGameProfile] = useState<GameProfile | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [wledProfiles, setWledProfiles] = useState<string[]>([]);
  const [wledProfileObjects, setWledProfileObjects] = useState<WLEDOutputProfile[]>([]);
  const [mappings, setMappings] = useState<{
    output: MemoryProfileOutput;
    deviceType: string;
    targetDevice: string;
    outputChannel: string;
    active: boolean;
  }[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Subscribe to memory profile change events from GameProfileForm
  useEffect(() => {
    const handleMemoryProfileChange = (event: CustomEvent) => {
      if (event.detail && Array.isArray(event.detail)) {
        const outputs = event.detail;
        // Initialize mappings based on memory outputs
        const newMappings = outputs.map(output => ({
          output,
          deviceType: "",
          targetDevice: "",
          outputChannel: "",
          active: true
        }));
        setMappings(newMappings);
      }
    };

    // Register event listener
    window.addEventListener('memoryProfileChanged', handleMemoryProfileChange as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('memoryProfileChanged', handleMemoryProfileChange as EventListener);
    };
  }, []);

  // Load memory profile details
  useEffect(() => {
    if (!selectedMemoryProfile) {
      setMemoryProfile(null);
      
      // If no memory profile but game profile exists, don't clear mappings
      // as they might be loaded from the game profile
      if (!selectedGameProfile) {
        setMappings([]);
      }
      return;
    }

    const loadMemoryProfile = async () => {
      try {
        const response = await window.electron.getMemoryProfile?.(selectedMemoryProfile);
        
        if (response?.success && response.profile) {
          setMemoryProfile(response.profile);
          
          // Initialize mappings for each output if we don't have any
          if (!selectedGameProfile && response.profile.outputs && Array.isArray(response.profile.outputs)) {
            const initialMappings = response.profile.outputs.map((output) => ({
              output,
              deviceType: "",
              targetDevice: "",
              outputChannel: "",
              active: true,
            }));
            setMappings(initialMappings);
            
            // Share this data with GameProfileForm
            if (window) {
              (window as any).currentMemoryOutputs = response.profile.outputs;
            }
          }
        } else {
          //console.error("Failed to load memory profile:", response?.error || "Unknown error");
        }
      } catch (error) {
        //console.error("Failed to load memory profile:", error);
      }
    };

    loadMemoryProfile();
  }, [selectedMemoryProfile, selectedGameProfile]);

  // Load game profile
  useEffect(() => {
    if (!selectedGameProfile) {
      setGameProfile(null);
      return;
    }

    const loadGameProfile = async () => {
      try {
        let profile: GameProfile | null = null;

        if (isElectron()) {
          const response = await window.electron.getGameProfile?.(selectedGameProfile);
          if (response?.success && response.profile) {
            profile = response.profile;
          }
        } else {
          profile = await profileStorage.getGameProfile(selectedGameProfile);
        }

        if (profile) {
          setGameProfile(profile);

          // Map the game profile outputs to our mapping format
          if (profile.outputs && Array.isArray(profile.outputs)) {
            // First, we need to load memory profile to get output details
            if (profile.memoryFile && selectedMemoryProfile === profile.memoryFile) {
              const memResponse = await window.electron.getMemoryProfile?.(profile.memoryFile);
              
              if (memResponse?.success && memResponse.profile && memResponse.profile.outputs) {
                const memOutputs = memResponse.profile.outputs;
                
                // Share this data with GameProfileForm
                if (window) {
                  (window as any).currentMemoryOutputs = memResponse.profile.outputs;
                }

                // Create mappings by merging memory profile outputs with game profile output settings
                const profileMappings = profile.outputs.map(gameOutput => {
                  // Find corresponding memory output
                  const memOutput = memOutputs.find(mo => mo.label === gameOutput.label);
                  
                  // Determine output channel value based on device type
                  let outputChannelValue = "";
                  if (gameOutput.device === "WLED" && gameOutput.wledProfileId) {
                    // For WLED devices, use wledProfileId
                    outputChannelValue = gameOutput.wledProfileId;
                    //console.log(`Found WLED profile ID in game output: ${outputChannelValue}`);
                  } else if (gameOutput.channel) {
                    // For other devices, use channel
                    outputChannelValue = gameOutput.channel.toString();
                  }
                  
                  // Use targetDevice from profile if available, otherwise empty string
                  const targetDeviceValue = gameOutput.targetDevice || "";
                  
                  return {
                    // Use memory output as base or fallback to game output details
                    output: memOutput || {
                      label: gameOutput.label,
                      type: gameOutput.type,
                      address: gameOutput.address,
                      notes: gameOutput.notes,
                      invert: gameOutput.invert,
                      format: gameOutput.format,
                      script: gameOutput.script || "",
                      useModuleOffset: gameOutput.useModuleOffset,
                      moduleName: gameOutput.moduleName,
                      offsets: gameOutput.offsets || [],
                      bitmask: gameOutput.bitmask || "",
                      bitwiseOp: gameOutput.bitwiseOp || "",
                      bitfield: gameOutput.bitfield || false,
                      isPointerChain: gameOutput.isPointerChain || false
                    },
                    deviceType: gameOutput.device || "",
                    targetDevice: targetDeviceValue,
                    outputChannel: outputChannelValue,
                    active: gameOutput.isActive !== undefined ? gameOutput.isActive : true
                  };
                });

                setMappings(profileMappings);
              }
            }
          }
        }
      } catch (error) {
        //console.error("Failed to load game profile:", error);
        toast.error("Failed to load game profile");
      }
    };

    loadGameProfile();
  }, [selectedGameProfile, selectedMemoryProfile]);

  // Load devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        const response = await window.electron.readDeviceStore?.();
        if (response && Array.isArray(response)) {
          setDevices(response);
        } else {
          //console.error("Failed to load devices: Invalid response format");
        }
      } catch (error) {
        //console.error("Failed to load devices:", error);
        toast.error("Failed to load devices");
      }
    };

    loadDevices();
  }, []);

  // Load WLED profiles with full content
  useEffect(() => {
    const loadWLEDProfiles = async () => {
      try {
        // Get profile file names
        const response = await window.electron.listWLEDProfiles?.();
        if (response && Array.isArray(response)) {
          setWledProfiles(response);
          
          // Load full profile content for each profile
          const profileObjects: WLEDOutputProfile[] = [];
          
          for (const profileName of response) {
            try {
              const profileContent = await window.electron.loadWLEDProfile?.(profileName);
              if (profileContent) {
                profileObjects.push(profileContent);
              }
            } catch (err) {
              //console.error(`Failed to load WLED profile ${profileName}:`, err);
            }
          }
          
          setWledProfileObjects(profileObjects);
        } else {
          //console.error("Failed to load WLED profiles:", "Invalid response format");
        }
      } catch (error) {
        //console.error("Failed to load WLED profiles:", error);
      }
    };

    loadWLEDProfiles();
  }, []);

  // Update mapping for a specific output
  const updateMapping = (index: number, field: keyof typeof mappings[0], value: any) => {
    const updatedMappings = [...mappings];
    
    // Handle special case for "None" selection in deviceType
    if (field === "deviceType" && value === "None") {
      // Set deviceType to empty string to return to "Select type" placeholder
      updatedMappings[index] = { 
        ...updatedMappings[index], 
        deviceType: "", 
        targetDevice: "",
        outputChannel: "" 
      };
    } else {
      // Normal case - update the field with the provided value
      updatedMappings[index] = { ...updatedMappings[index], [field]: value };
      
      // Reset dependent fields when device type changes
      if (field === "deviceType") {
        updatedMappings[index].targetDevice = "";
        updatedMappings[index].outputChannel = "";
      }
      
      // Reset output channel when target device changes
      if (field === "targetDevice") {
        updatedMappings[index].outputChannel = "";
      }
    }
    
    setMappings(updatedMappings);
  };

  // Get current mappings - used by parent components
  const getCurrentMappings = () => {
    return mappings;
  };

  // Share mapping data with other components
  useEffect(() => {
    // Make getCurrentMappings available to other components
    (window as any).getCurrentMappings = getCurrentMappings;
    (window as any).updateMappingsFromTable = (mappings: any[]) => {
      setMappings(mappings);
    };
    
    // Return as cleanup function
    return () => {
      delete (window as any).getCurrentMappings;
      delete (window as any).updateMappingsFromTable;
    };
  }, [mappings]);

  // Filter devices by type
  const getDevicesByType = (type: string): Device[] => {
    return devices.filter(device => device.type === type);
  };

  // Get output channels options based on device type and target device
  const getOutputChannelOptions = (deviceType: string, targetDeviceId: string): number[] | WLEDOutputProfile[] => {
    if (deviceType === "PacDrive") {
      // For PacDrive, find the device and return numeric channels based on outputCount or channels
      const device = devices.find(d => d.id === targetDeviceId) as PacDriveDevice | undefined;
      
      if (device) {
        // Use outputCount if available, otherwise fall back to channels
        const channelCount = device.outputCount || device.channels || 0;
        return Array.from({ length: channelCount }, (_, i) => i + 1);
      }
      return [];
    } else if (deviceType === "WLED") {
      // For WLED, return WLED profiles that match the selected device IP
      const device = devices.find(d => d.id === targetDeviceId) as WLEDDevice | undefined;
      if (device && device.ipAddress) {
        // Filter profiles by device IP address
        const matchingProfiles = wledProfileObjects.filter(
          profile => profile.deviceIP === device.ipAddress
        );
        
        // Return matching profiles
        return matchingProfiles;
      }
      return [];
    }
    
    return [];
  };

  // Render PacDrive channel options
  const renderPacDriveOptions = (targetDeviceId: string) => {
    const options = getOutputChannelOptions("PacDrive", targetDeviceId) as number[];
    return options.map((option) => (
      <SelectItem key={option.toString()} value={option.toString()}>
        Channel {option}
      </SelectItem>
    ));
  };

  // Render WLED profile options
  const renderWLEDOptions = (targetDeviceId: string) => {
    const options = getOutputChannelOptions("WLED", targetDeviceId) as WLEDOutputProfile[];
    return options.map((profile) => (
      <SelectItem key={profile.id} value={profile.id}>
        {profile.name || "Unnamed Profile"}
      </SelectItem>
    ));
  };

  // Save mappings to the game profile
  const handleSaveSettings = async () => {
    if (!selectedGameProfile) {
      toast.error("No game profile selected");
      return;
    }

    try {
      setIsSaving(true);

      // First, sync the current mappings with the form component
      const formUpdateMappingsFunc = (window as any).updateMappingsFromForm;
      if (typeof formUpdateMappingsFunc === 'function') {
        formUpdateMappingsFunc(mappings);
        
        // Add a short delay to ensure state updates are completed before proceeding
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Call the parent's onSaveSettings function directly
      if (onSaveSettings && typeof onSaveSettings === 'function') {
        await onSaveSettings();
        // Note: We don't show toast here, letting the parent handle it
      } else {
        // Fallback approach if onSaveSettings wasn't provided
        const updateButton = document.getElementById("updateProfileButton");
        if (updateButton) {
          updateButton.click();
        } else {
          toast.error("Could not find update button");
        }
      }
    } catch (error) {
      toast.error("Failed to save output mappings");
    } finally {
      // Short delay before setting saving to false to ensure UI updates properly
      setTimeout(() => {
        setIsSaving(false);
      }, 500);
    }
  };

  if (!selectedMemoryProfile && !selectedGameProfile) {
    return (
      <Card className="mt-8">
        <CardContent className="pt-6">
          <div className="text-center text-gray-500 py-8">
            Select a memory profile or game profile to view mapping options.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Output Mapping Table</CardTitle>
        <Button 
          onClick={handleSaveSettings}
          disabled={isSaving || !selectedGameProfile}
          size="sm"
        >
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </Button>
      </CardHeader>
      <CardContent>
        <TableCompact>
          <TableCompactHeader>
            <TableCompactRow>
              <TableCompactHead>Memory Output</TableCompactHead>
              <TableCompactHead>Address</TableCompactHead>
              <TableCompactHead>Device Type</TableCompactHead>
              <TableCompactHead>Target Device</TableCompactHead>
              <TableCompactHead>Channel/Profile</TableCompactHead>
              <TableCompactHead>Active</TableCompactHead>
            </TableCompactRow>
          </TableCompactHeader>
          <TableCompactBody>
            {mappings.map((mapping, index) => (
              <TableCompactRow key={`mapping-${index}`}>
                <TableCompactCell>{mapping.output.label}</TableCompactCell>
                <TableCompactCell className="font-mono text-sm">
                  {formatMemoryAddress(mapping.output)}
                </TableCompactCell>
                <TableCompactCell>
                  <Select 
                    value={mapping.deviceType} 
                    onValueChange={(value) => updateMapping(index, "deviceType", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">None</SelectItem>
                      <SelectItem value="Arduino">Arduino</SelectItem>
                      <SelectItem value="PacDrive">PacDrive</SelectItem>
                      <SelectItem value="WLED">WLED</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCompactCell>
                <TableCompactCell>
                  <Select 
                    value={mapping.targetDevice}
                    onValueChange={(value) => updateMapping(index, "targetDevice", value)}
                    disabled={!mapping.deviceType}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={mapping.deviceType ? "Select device" : "Select type first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {mapping.deviceType ? (
                        getDevicesByType(mapping.deviceType).map(device => (
                          <SelectItem key={device.id} value={device.id}>
                            {device.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="placeholder" disabled>
                          Select device type first
                        </SelectItem>
                      )}
                      {mapping.deviceType && getDevicesByType(mapping.deviceType).length === 0 && (
                        <SelectItem value="none" disabled>
                          No {mapping.deviceType} devices available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </TableCompactCell>
                <TableCompactCell>
                  {(mapping.deviceType === "PacDrive" || mapping.deviceType === "WLED") && mapping.targetDevice ? (
                    <Select 
                      value={mapping.outputChannel}
                      onValueChange={(value) => updateMapping(index, "outputChannel", value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={
                          mapping.deviceType === "PacDrive" 
                            ? "Select channel" 
                            : "Select profile"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {mapping.deviceType === "PacDrive" && renderPacDriveOptions(mapping.targetDevice)}
                        {mapping.deviceType === "WLED" && renderWLEDOptions(mapping.targetDevice)}
                        
                        {(mapping.deviceType === "PacDrive" || mapping.deviceType === "WLED") && 
                         getOutputChannelOptions(mapping.deviceType, mapping.targetDevice).length === 0 && (
                          <SelectItem value="none" disabled>
                            {mapping.deviceType === "PacDrive" 
                              ? "No channels available" 
                              : "No profiles for this device"}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-gray-400 text-sm">
                      {mapping.deviceType === "Arduino" 
                        ? "N/A for Arduino" 
                        : mapping.deviceType === "" 
                          ? "N/A for None"
                          : "Select device type and target"}
                    </div>
                  )}
                </TableCompactCell>
                <TableCompactCell>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id={`active-${index}`} 
                      checked={mapping.active}
                      onCheckedChange={(checked) => updateMapping(index, "active", checked)}
                    />
                    <Label htmlFor={`active-${index}`} className="sr-only">
                      Active
                    </Label>
                  </div>
                </TableCompactCell>
              </TableCompactRow>
            ))}
            {mappings.length === 0 && (
              <TableCompactRow>
                <TableCompactCell colSpan={6} className="text-center py-8">
                  No outputs found in the selected memory profile.
                </TableCompactCell>
              </TableCompactRow>
            )}
          </TableCompactBody>
        </TableCompact>

        {/* Hidden button for parent components to fetch mappings */}
        <div className="hidden">
          <Button id="getMappingsButton" onClick={() => {
            // Update form component with current mappings
            const formUpdateMappingsFunc = (window as any).updateMappingsFromForm;
            if (typeof formUpdateMappingsFunc === 'function') {
              formUpdateMappingsFunc(mappings);
            }
          }}>
            Get Mappings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
