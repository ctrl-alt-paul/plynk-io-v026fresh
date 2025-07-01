import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGameManager } from "../context/GameManagerContext";
import { isElectron } from "@/utils/isElectron";
import { profileManager } from "@/lib/profileManager";
import { toast } from "sonner";
import { GameProfile, GameProfileOutput } from "@/types/profiles";
import { v4 as uuidv4 } from "uuid";

interface CreateProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProfileOption {
  fileName: string;
  type: 'default' | 'user' | 'community';
  displayName: string;
}

export const CreateProfileDialog: React.FC<CreateProfileDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { createGameProfile, isLoading } = useGameManager();
  const [profileName, setProfileName] = useState("");
  const [processName, setProcessName] = useState("");
  const [gameName, setGameName] = useState("");
  const [selectedMemoryProfile, setSelectedMemoryProfile] = useState<string>("");
  const [selectedMessageProfile, setSelectedMessageProfile] = useState<string>("");
  const [memoryProfiles, setMemoryProfiles] = useState<ProfileOption[]>([]);
  const [messageProfiles, setMessageProfiles] = useState<ProfileOption[]>([]);

  // Load profiles when dialog opens
  useEffect(() => {
    if (open) {
      loadMemoryProfiles();
      loadMessageProfiles();
    }
  }, [open]);

  const loadMemoryProfiles = async () => {
    try {
      const profiles = await profileManager.listMemoryProfiles();
      const profileOptions: ProfileOption[] = profiles.map(p => ({
        fileName: p.fileName,
        type: p.type,
        displayName: p.fileName.replace('.json', '')
      }));
      setMemoryProfiles(profileOptions);
    } catch (error) {
      console.error("Failed to load memory profiles:", error);
    }
  };

  const loadMessageProfiles = async () => {
    try {
      const profiles = await profileManager.listMessageProfiles();
      const profileOptions: ProfileOption[] = profiles.map(p => ({
        fileName: p.fileName,
        type: p.type,
        displayName: p.fileName.replace('.json', '')
      }));
      setMessageProfiles(profileOptions);
    } catch (error) {
      console.error("Failed to load message profiles:", error);
    }
  };

  const handleMemoryProfileChange = async (compositeValue: string) => {
    setSelectedMemoryProfile(compositeValue);
    
    // Parse composite value to get type and fileName
    const [type, fileName] = compositeValue.split(':');
    const profileType = type as 'default' | 'user' | 'community';
    
    // Auto-populate process name when memory profile is selected
    try {
      const memoryProfile = await profileManager.getMemoryProfile(fileName, profileType);
      if (memoryProfile?.process) {
        setProcessName(memoryProfile.process);
      }
    } catch (error) {
      console.error("Failed to load memory profile:", error);
    }
  };

  const handleMessageProfileChange = async (compositeValue: string) => {
    setSelectedMessageProfile(compositeValue);
    
    // Parse composite value to get type and fileName
    const [type, fileName] = compositeValue.split(':');
    const profileType = type as 'default' | 'user' | 'community';
    
    // Auto-populate game name when message profile is selected
    try {
      const messageProfile = await profileManager.getMessageProfile(fileName, profileType);
      if (messageProfile?.outputs) {
        // Look for the __GAME_NAME__ key
        const gameNameOutput = messageProfile.outputs.find(output => output.key === '__GAME_NAME__');
        if (gameNameOutput && gameNameOutput.label) {
          setGameName(gameNameOutput.label);
        }
      }
    } catch (error) {
      console.error("Failed to load message profile:", error);
    }
  };

  // Helper function to load memory profile outputs
  const loadMemoryOutputs = async (memoryProfileName: string, profileType: 'default' | 'user' | 'community'): Promise<any[]> => {
    try {
      const profile = await profileManager.getMemoryProfile(memoryProfileName, profileType);
      if (profile?.outputs) {
        return profile.outputs;
      }
    } catch (error) {
      console.error("Failed to load memory profile outputs:", error);
    }
    return [];
  };

  // Helper function to load message profile outputs
  const loadMessageOutputs = async (messageProfileName: string, profileType: 'default' | 'user' | 'community'): Promise<any[]> => {
    try {
      const profile = await profileManager.getMessageProfile(messageProfileName, profileType);
      if (profile?.outputs) {
        return profile.outputs;
      }
    } catch (error) {
      console.error("Failed to load message profile outputs:", error);
    }
    return [];
  };

  // Convert message output to memory format (same logic as in GameManagerContext)
  const convertMessageOutputToMemoryFormat = (messageOutput: any) => {
    return {
      label: messageOutput.label || messageOutput.key || "",
      type: "Message",
      address: "", // Message outputs don't have addresses
      key: messageOutput.key, // Store the message key
      notes: `Message output: ${messageOutput.key}`,
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

  // Convert outputs to GameProfileOutput format
  const convertToGameProfileOutput = (output: any, isMessageOutput: boolean = false): GameProfileOutput => {
    return {
      label: output.label || "",
      type: output.type || "Int32",
      address: output.address || "",
      key: isMessageOutput ? output.key : undefined,
      notes: output.notes || "",
      device: "", // Default empty, user can set later
      channel: 0,
      invert: output.invert || false,
      format: output.format || "{value}",
      script: output.script || "",
      useModuleOffset: output.useModuleOffset || false,
      moduleName: output.moduleName || "",
      offset: output.offset || "",
      offsets: output.offsets || [],
      bitmask: output.bitmask || "",
      bitwiseOp: output.bitwiseOp || "",
      bitfield: output.bitfield || false,
      isPointerChain: output.isPointerChain || false,
      isActive: true, // Set to active by default
      targetDevice: "" // Default empty
    };
  };

  const handleCreate = async () => {
    if (!profileName.trim()) {
      toast.error("Profile name is required");
      return;
    }

    if (!selectedMemoryProfile && !selectedMessageProfile) {
      toast.error("At least one profile (memory or message) must be selected");
      return;
    }

    try {
      // Load outputs from selected profiles
      const allOutputs: GameProfileOutput[] = [];

      // Load memory profile outputs
      if (selectedMemoryProfile) {
        const [memoryType, memoryFileName] = selectedMemoryProfile.split(':');
        const memoryProfileType = memoryType as 'default' | 'user' | 'community';
        const memoryOutputs = await loadMemoryOutputs(memoryFileName, memoryProfileType);
        const convertedMemoryOutputs = memoryOutputs.map(output => convertToGameProfileOutput(output, false));
        allOutputs.push(...convertedMemoryOutputs);
      }

      // Load message profile outputs
      if (selectedMessageProfile) {
        const [messageType, messageFileName] = selectedMessageProfile.split(':');
        const messageProfileType = messageType as 'default' | 'user' | 'community';
        const messageOutputs = await loadMessageOutputs(messageFileName, messageProfileType);
        const convertedMessageOutputs = messageOutputs.map(output => {
          const memoryFormatOutput = convertMessageOutputToMemoryFormat(output);
          return convertToGameProfileOutput(memoryFormatOutput, true);
        });
        allOutputs.push(...convertedMessageOutputs);
      }

      // Parse composite values to get fileName and type
      const memoryFileWithExtension = selectedMemoryProfile ? 
        (() => {
          const [, fileName] = selectedMemoryProfile.split(':');
          return fileName.endsWith('.json') ? fileName : `${fileName}.json`;
        })() : 
        undefined;
      
      const messageFileWithExtension = selectedMessageProfile ? 
        (() => {
          const [, fileName] = selectedMessageProfile.split(':');
          return fileName.endsWith('.json') ? fileName : `${fileName}.json`;
        })() : 
        undefined;

      const memoryProfileType = selectedMemoryProfile ? selectedMemoryProfile.split(':')[0] as 'default' | 'user' | 'community' : undefined;
      const messageProfileType = selectedMessageProfile ? selectedMessageProfile.split(':')[0] as 'default' | 'user' | 'community' : undefined;

      const newProfile: GameProfile = {
        id: uuidv4(),
        profileName: profileName.trim(),
        processName: processName.trim(),
        memoryFile: memoryFileWithExtension,
        messageFile: messageFileWithExtension,
        messageName: gameName.trim() || undefined,
        pollInterval: 16, // Changed from 100 to 16ms
        outputs: allOutputs, // Now includes all loaded outputs
        isActive: true,
        lastModified: Date.now(),
        memoryProfileType,
        messageProfileType
      };

      const success = await createGameProfile(newProfile);
      if (success) {
        toast.success(`Game profile "${profileName}" created successfully with ${allOutputs.length} outputs`);
        handleClose();
      }
    } catch (error) {
      console.error("Failed to create profile:", error);
      toast.error("Failed to create game profile");
    }
  };

  const handleClose = () => {
    setProfileName("");
    setProcessName("");
    setGameName("");
    setSelectedMemoryProfile("");
    setSelectedMessageProfile("");
    onOpenChange(false);
  };

  // Group profiles by type for rendering
  const defaultMemoryProfiles = memoryProfiles.filter(p => p.type === 'default');
  const communityMemoryProfiles = memoryProfiles.filter(p => p.type === 'community');
  const userMemoryProfiles = memoryProfiles.filter(p => p.type === 'user');
  const defaultMessageProfiles = messageProfiles.filter(p => p.type === 'default');
  const communityMessageProfiles = messageProfiles.filter(p => p.type === 'community');
  const userMessageProfiles = messageProfiles.filter(p => p.type === 'user');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Game Profile</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="profileName" className="text-right">
              Profile Name
            </Label>
            <Input
              id="profileName"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="col-span-3"
              placeholder="Enter profile name"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="processName" className="text-right">
              Process Name
            </Label>
            <Input
              id="processName"
              value={processName}
              readOnly
              className="col-span-3 bg-muted"
              placeholder="Auto-populated from memory profile"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="gameName" className="text-right">
              Message Game Name
            </Label>
            <Input
              id="gameName"
              value={gameName}
              readOnly
              className="col-span-3 bg-muted"
              placeholder="Auto-populated from message profile"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="memoryProfile" className="text-right">
              Memory Profile
            </Label>
            <div className="col-span-3">
              <Select
                value={selectedMemoryProfile}
                onValueChange={handleMemoryProfileChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select memory profile (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {defaultMemoryProfiles.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Default Profiles</SelectLabel>
                      {defaultMemoryProfiles.map((profile) => (
                        <SelectItem key={`default-${profile.fileName}`} value={`default:${profile.fileName}`}>
                          <div className="flex items-center gap-2">
                            <span>{profile.displayName}</span>
                            <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                              Default
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {(defaultMemoryProfiles.length > 0 && communityMemoryProfiles.length > 0) && <SelectSeparator />}
                  {communityMemoryProfiles.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Community Profiles</SelectLabel>
                      {communityMemoryProfiles.map((profile) => (
                        <SelectItem key={`community-${profile.fileName}`} value={`community:${profile.fileName}`}>
                          <div className="flex items-center gap-2">
                            <span>{profile.displayName}</span>
                            <span className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">
                              Community
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {((defaultMemoryProfiles.length > 0 || communityMemoryProfiles.length > 0) && userMemoryProfiles.length > 0) && <SelectSeparator />}
                  {userMemoryProfiles.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>User Profiles</SelectLabel>
                      {userMemoryProfiles.map((profile) => (
                        <SelectItem key={`user-${profile.fileName}`} value={`user:${profile.fileName}`}>
                          <div className="flex items-center gap-2">
                            <span>{profile.displayName}</span>
                            <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                              User
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="messageProfile" className="text-right">
              Message Profile
            </Label>
            <div className="col-span-3">
              <Select
                value={selectedMessageProfile}
                onValueChange={handleMessageProfileChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select message profile (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {defaultMessageProfiles.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Default Profiles</SelectLabel>
                      {defaultMessageProfiles.map((profile) => (
                        <SelectItem key={`default-${profile.fileName}`} value={`default:${profile.fileName}`}>
                          <div className="flex items-center gap-2">
                            <span>{profile.displayName}</span>
                            <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                              Default
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {(defaultMessageProfiles.length > 0 && communityMessageProfiles.length > 0) && <SelectSeparator />}
                  {communityMessageProfiles.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Community Profiles</SelectLabel>
                      {communityMessageProfiles.map((profile) => (
                        <SelectItem key={`community-${profile.fileName}`} value={`community:${profile.fileName}`}>
                          <div className="flex items-center gap-2">
                            <span>{profile.displayName}</span>
                            <span className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">
                              Community
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {((defaultMessageProfiles.length > 0 || communityMessageProfiles.length > 0) && userMessageProfiles.length > 0) && <SelectSeparator />}
                  {userMessageProfiles.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>User Profiles</SelectLabel>
                      {userMessageProfiles.map((profile) => (
                        <SelectItem key={`user-${profile.fileName}`} value={`user:${profile.fileName}`}>
                          <div className="flex items-center gap-2">
                            <span>{profile.displayName}</span>
                            <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                              User
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            Create Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
