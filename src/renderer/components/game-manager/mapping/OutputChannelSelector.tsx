
import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGameManager } from "../context/GameManagerContext";
import { WLEDOutputProfile } from "@/lib/wledProfiles";
import { Device, PacDriveDevice, WLEDDevice } from "@/types/devices";

interface OutputChannelSelectorProps {
  index: number;
  deviceType: string;
  targetDevice: string;
  value: string | number;
}

export const OutputChannelSelector: React.FC<OutputChannelSelectorProps> = ({ 
  index, 
  deviceType, 
  targetDevice, 
  value 
}) => {
  const { updateMapping } = useGameManager();
  const [devices, setDevices] = useState<Device[]>([]);
  const [wledProfiles, setWledProfiles] = useState<string[]>([]);
  const [wledProfileObjects, setWledProfileObjects] = useState<WLEDOutputProfile[]>([]);
  
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
      }
    };

    loadDevices();
  }, []);
  
  // Load WLED profiles
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
  
  const handleChange = (newValue: string) => {
    // For PacDrive, convert string channel to number before storing
    if (deviceType === "PacDrive") {
      const numericValue = Number(newValue);
      if (!isNaN(numericValue)) {
        updateMapping(index, "outputChannel", numericValue);
        return;
      }
    }
    // For other device types or if conversion fails, store as string
    updateMapping(index, "outputChannel", newValue);
  };
  
  if (!(deviceType === "PacDrive" || deviceType === "WLED") || !targetDevice) {
    return (
      <div className="text-gray-400 text-sm">
        {deviceType === "Arduino" 
          ? "N/A for Arduino" 
          : deviceType === "" 
            ? "N/A for None"
            : "Select device type and target"}
      </div>
    );
  }
  
  return (
    <Select 
      value={value !== undefined ? value.toString() : ""}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={
          deviceType === "PacDrive" 
            ? "Select channel" 
            : "Select profile"
        } />
      </SelectTrigger>
      <SelectContent>
        {deviceType === "PacDrive" && renderPacDriveOptions(targetDevice)}
        {deviceType === "WLED" && renderWLEDOptions(targetDevice)}
        
        {(deviceType === "PacDrive" || deviceType === "WLED") && 
          getOutputChannelOptions(deviceType, targetDevice).length === 0 && (
          <SelectItem value="none" disabled>
            {deviceType === "PacDrive" 
              ? "No channels available" 
              : "No profiles for this device"}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
};
