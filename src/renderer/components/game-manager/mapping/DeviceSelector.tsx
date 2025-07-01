
import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Device } from "@/types/devices";
import { useGameManager } from "../context/GameManagerContext";

interface DeviceSelectorProps {
  index: number;
  deviceType: string;
  value: string;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({ 
  index, 
  deviceType, 
  value 
}) => {
  const { updateMapping } = useGameManager();
  const [devices, setDevices] = useState<Device[]>([]);
  
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
  
  // Filter devices by type
  const getDevicesByType = (type: string): Device[] => {
    return devices.filter(device => device.type === type);
  };
  
  const handleChange = (newValue: string) => {
    updateMapping(index, "targetDevice", newValue);
  };
  
  return (
    <Select 
      value={value}
      onValueChange={handleChange}
      disabled={!deviceType}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={deviceType ? "Select device" : "Select type first"} />
      </SelectTrigger>
      <SelectContent>
        {deviceType ? (
          getDevicesByType(deviceType).map(device => (
            <SelectItem key={device.id} value={device.id}>
              {device.name}
            </SelectItem>
          ))
        ) : (
          <SelectItem value="placeholder" disabled>
            Select device type first
          </SelectItem>
        )}
        {deviceType && getDevicesByType(deviceType).length === 0 && (
          <SelectItem value="none" disabled>
            No {deviceType} devices available
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
};
