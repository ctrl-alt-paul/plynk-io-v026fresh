import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleNameInput } from "@/renderer/components/ModuleNameInput";
import { useGameManager } from "../context/GameManagerContext";
import { isElectron } from "@/utils/isElectron";
import { profileManager, ProfileWithType } from "@/lib/profileManager";
import { toast } from "sonner";

// Custom component to display profile with badge
const ProfileDisplay: React.FC<{ compositeValue: string, profilesWithType: ProfileWithType[] }> = ({ compositeValue, profilesWithType }) => {
  if (!compositeValue) return <span className="text-muted-foreground">No profile selected</span>;
  
  const [type, fileName] = compositeValue.split(':');
  const profile = profilesWithType.find(p => p.type === type && p.fileName === fileName);
  
  if (profile) {
    const displayName = fileName.replace('.json', '');
    const badgeClasses = type === 'default' 
      ? 'text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded' 
      : type === 'community'
      ? 'text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded'
      : 'text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded';
    const badgeText = type === 'default' ? 'Default' : type === 'community' ? 'Community' : 'User';
    
    return (
      <div className="flex items-center gap-2">
        <span>{displayName}</span>
        <span className={badgeClasses}>
          {badgeText}
        </span>
      </div>
    );
  }
  return <span>{compositeValue}</span>;
};

export const ProfileSelectionForm: React.FC = () => {
  const {
    currentGameProfile,
    updateGameProfile,
    getFormValues,
    setFormValues
  } = useGameManager();
  
  const [memoryProfilesWithType, setMemoryProfilesWithType] = useState<ProfileWithType[]>([]);
  const [messageProfilesWithType, setMessageProfilesWithType] = useState<ProfileWithType[]>([]);
  const [processName, setProcessName] = useState("");
  const [gameName, setGameName] = useState("");
  const [pollInterval, setPollInterval] = useState(100);
  const [isActive, setIsActive] = useState(false);
  const [selectedMemoryProfile, setSelectedMemoryProfile] = useState<string>("");
  const [selectedMessageProfile, setSelectedMessageProfile] = useState<string>("");

  // Store original values for change detection
  const [originalProcessName, setOriginalProcessName] = useState("");
  const [originalPollInterval, setOriginalPollInterval] = useState(100);

  // Load memory profiles with type information
  useEffect(() => {
    const fetchMemoryProfiles = async () => {
      try {
        const profiles = await profileManager.listMemoryProfiles();
        setMemoryProfilesWithType(profiles);
      } catch (error) {
        console.error("Failed to load memory profiles:", error);
        toast.error("Failed to load memory profiles");
      }
    };
    fetchMemoryProfiles();
  }, []);

  // Load message profiles with type information
  useEffect(() => {
    const fetchMessageProfiles = async () => {
      try {
        const profiles = await profileManager.listMessageProfiles();
        setMessageProfilesWithType(profiles);
      } catch (error) {
        console.error("Failed to load message profiles:", error);
        toast.error("Failed to load message profiles");
      }
    };
    fetchMessageProfiles();
  }, []);

  // Update form when current game profile changes
  useEffect(() => {
    if (currentGameProfile) {
      setProcessName(currentGameProfile.processName || "");
      setGameName(currentGameProfile.messageName || "");
      setPollInterval(currentGameProfile.pollInterval || 100);
      setIsActive(currentGameProfile.isActive || false);
      
      // Set composite values for dropdowns
      const memoryComposite = currentGameProfile.memoryFile && currentGameProfile.memoryProfileType ? 
        `${currentGameProfile.memoryProfileType}:${currentGameProfile.memoryFile}` : "";
      const messageComposite = currentGameProfile.messageFile && currentGameProfile.messageProfileType ? 
        `${currentGameProfile.messageProfileType}:${currentGameProfile.messageFile}` : "";
      
      setSelectedMemoryProfile(memoryComposite);
      setSelectedMessageProfile(messageComposite);
      
      // Store original values for change detection
      setOriginalProcessName(currentGameProfile.processName || "");
      setOriginalPollInterval(currentGameProfile.pollInterval || 100);
    } else {
      // Clear form
      setProcessName("");
      setGameName("");
      setPollInterval(100);
      setIsActive(false);
      setSelectedMemoryProfile("");
      setSelectedMessageProfile("");
      setOriginalProcessName("");
      setOriginalPollInterval(100);
    }
  }, [currentGameProfile]);

  // Handle process name change with change detection
  const handleProcessNameChange = (value: string) => {
    setProcessName(value);
    // Trigger change detection after state update
    setTimeout(() => {
      const checkProfileChanges = (window as any).checkProfileChanges;
      if (typeof checkProfileChanges === 'function') {
        checkProfileChanges();
      }
    }, 0);
  };

  // Handle poll interval change with change detection
  const handlePollIntervalChange = (value: number) => {
    setPollInterval(value);
    // Trigger change detection after state update
    setTimeout(() => {
      const checkProfileChanges = (window as any).checkProfileChanges;
      if (typeof checkProfileChanges === 'function') {
        checkProfileChanges();
      }
    }, 0);
  };

  // Handle active change with change detection
  const handleActiveChange = (value: boolean) => {
    setIsActive(value);
    // Trigger change detection after state update
    setTimeout(() => {
      const checkProfileChanges = (window as any).checkProfileChanges;
      if (typeof checkProfileChanges === 'function') {
        checkProfileChanges();
      }
    }, 0);
  };

  // Handle game name change with change detection
  const handleGameNameChange = (value: string) => {
    setGameName(value);
    // Trigger change detection after state update
    setTimeout(() => {
      const checkProfileChanges = (window as any).checkProfileChanges;
      if (typeof checkProfileChanges === 'function') {
        checkProfileChanges();
      }
    }, 0);
  };

  // Register form value getter on window for external access
  useEffect(() => {
    (window as any).getFormValues = () => {
      // Parse composite values to extract fileName and type
      const memoryFile = selectedMemoryProfile ? selectedMemoryProfile.split(':')[1] : "";
      const messageFile = selectedMessageProfile ? selectedMessageProfile.split(':')[1] : "";
      
      return {
        processName,
        gameName,
        pollInterval,
        isActive,
        memoryFile,
        messageFile
      };
    };

    (window as any).getOriginalProcessName = () => originalProcessName;
    (window as any).getOriginalPollInterval = () => originalPollInterval;

    return () => {
      delete (window as any).getFormValues;
      delete (window as any).getOriginalProcessName;
      delete (window as any).getOriginalPollInterval;
    };
  }, [processName, gameName, pollInterval, isActive, selectedMemoryProfile, selectedMessageProfile, originalProcessName, originalPollInterval]);

  // Listen for clear events
  useEffect(() => {
    const handleClear = () => {
      setProcessName("");
      setGameName("");
      setPollInterval(100);
      setIsActive(false);
      setSelectedMemoryProfile("");
      setSelectedMessageProfile("");
      setOriginalProcessName("");
      setOriginalPollInterval(100);
    };

    const clearButton = document.getElementById("clearButton");
    if (clearButton) {
      clearButton.addEventListener("click", handleClear);
      return () => clearButton.removeEventListener("click", handleClear);
    }
  }, []);

  // Listen for profile saved events to reset change tracking
  useEffect(() => {
    const handleProfileSaved = () => {
      setOriginalProcessName(processName);
    };

    window.addEventListener('profileSaved', handleProfileSaved);
    return () => window.removeEventListener('profileSaved', handleProfileSaved);
  }, [processName]);

  return (
    <div className="space-y-6">
      {/* 3 columns, 2 rows layout */}
      <div className="grid grid-cols-10 gap-6">
        {/* Column 1: Profile selections as read-only textboxes with proper formatting */}
        <div className="col-span-4 space-y-4">
          <div className="space-y-3">
            <Label htmlFor="memoryProfile" className="text-sm font-medium">Memory Profile</Label>
            <div className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background flex items-center md:text-sm">
              <ProfileDisplay 
                compositeValue={selectedMemoryProfile} 
                profilesWithType={memoryProfilesWithType} 
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="messageProfile" className="text-sm font-medium">Message Profile</Label>
            <div className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background flex items-center md:text-sm">
              <ProfileDisplay 
                compositeValue={selectedMessageProfile} 
                profilesWithType={messageProfilesWithType} 
              />
            </div>
          </div>
        </div>

        {/* Column 2: Process settings (40% - 4 columns) */}
        <div className="col-span-4 space-y-4">
          <div className="space-y-3">
            <Label htmlFor="processName" className="text-sm font-medium">Process Name</Label>
            <ModuleNameInput
              id="processName"
              value={processName}
              onChange={(value) => handleProcessNameChange(value)}
              placeholder="Process name"
              className="h-11"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="gameName" className="text-sm font-medium">Message Game Name</Label>
            <Input
              id="gameName"
              value={gameName}
              onChange={(e) => handleGameNameChange(e.target.value)}
              placeholder="Game name"
              className="h-11"
            />
          </div>
        </div>

        {/* Column 3: Poll interval and active switch (20% - 2 columns) */}
        <div className="col-span-2 space-y-4">
          <div className="space-y-3">
            <Label htmlFor="pollInterval" className="text-sm font-medium">Poll Interval (ms)</Label>
            <Input
              id="pollInterval"
              type="number"
              value={pollInterval}
              onChange={(e) => handlePollIntervalChange(Number(e.target.value))}
              placeholder="Poll interval"
              className="h-11"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="isActive" className="text-sm font-medium">Profile Active</Label>
            <div className="h-11 flex items-center">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={handleActiveChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
