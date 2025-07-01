
import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGameManager } from "../context/GameManagerContext";

interface DeviceTypeSelectorProps {
  index: number;
  value: string;
}

export const DeviceTypeSelector: React.FC<DeviceTypeSelectorProps> = ({ index, value }) => {
  const { updateMapping } = useGameManager();
  
  const handleChange = (newValue: string) => {
    // First, update the device type
    updateMapping(index, "deviceType", newValue);
    
    // Then reset dependent fields
    updateMapping(index, "outputChannel", "");
    updateMapping(index, "targetDevice", "");
  };
  
  return (
    <Select 
      value={value} 
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="None">None</SelectItem>
        <SelectItem value="Serial">Serial</SelectItem>
        <SelectItem value="PacDrive">PacDrive</SelectItem>
        <SelectItem value="WLED">WLED</SelectItem>
      </SelectContent>
    </Select>
  );
};
