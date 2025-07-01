import React from "react";
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
import { Input } from "@/components/ui/input";
import { TableCompactCell, TableCompactRow } from "@/components/ui/table-compact";
import { Device, PacDriveDevice, WLEDDevice } from "@/types/devices";
import { WLEDOutputProfile } from "@/lib/wledProfiles";
import { formatMemoryAddress } from "@/renderer/utils/formatters";
import { MemoryProfileOutput } from "@/types/memoryProfiles";
import { MessageProfileOutput } from "@/types/messageProfiles";
import { Play } from "lucide-react";

interface OutputMapping {
  output: MemoryProfileOutput | MessageProfileOutput;
  deviceType: string;
  targetDevice: string;
  outputChannel: string;
  active: boolean;
  source: 'memory' | 'message';
}

interface MappingTableRowProps {
  mapping: OutputMapping;
  index: number;
  devices: Device[];
  wledProfileObjects: WLEDOutputProfile[];
  updateMapping: (index: number, field: string, value: any) => void;
  testValue: string;
  onTestValueChange: (value: string) => void;
  onTestDispatch: () => void;
  isTestLoading: boolean;
}

// Type guard to check if output is MemoryProfileOutput
const isMemoryOutput = (output: MemoryProfileOutput | MessageProfileOutput): output is MemoryProfileOutput => {
  return 'address' in output && 'type' in output;
};

export const MappingTableRow: React.FC<MappingTableRowProps> = ({
  mapping,
  index,
  devices,
  wledProfileObjects,
  updateMapping,
  testValue,
  onTestValueChange,
  onTestDispatch,
  isTestLoading
}) => {
  // Filter devices by type
  const getDevicesByType = (type: string): Device[] => {
    return devices.filter(device => device.type === type);
  };

  // Get output channels options based on device type and target device
  const getOutputChannelOptions = (deviceType: string, targetDeviceId: string): number[] | WLEDOutputProfile[] => {
    if (deviceType === "PacDrive") {
      const device = devices.find(d => d.id === targetDeviceId) as PacDriveDevice | undefined;
      
      if (device) {
        const channelCount = device.outputCount || device.channels || 0;
        return Array.from({ length: channelCount }, (_, i) => i + 1);
      }
      return [];
    } else if (deviceType === "WLED") {
      const device = devices.find(d => d.id === targetDeviceId) as WLEDDevice | undefined;
      if (device && device.ipAddress) {
        const matchingProfiles = wledProfileObjects.filter(
          profile => profile.deviceIP === device.ipAddress
        );
        return matchingProfiles;
      }
      return [];
    }
    
    return [];
  };

  // Render address information based on output type
  const renderAddressInfo = () => {
    if (mapping.source === 'message') {
      // For message outputs, show the key instead of formatted address
      const messageOutput = mapping.output as MessageProfileOutput;
      return (
        <span className="font-mono text-sm text-blue-600">
          {messageOutput.key || 'N/A'}
        </span>
      );
    } else {
      // For memory outputs, show formatted address
      const memoryOutput = mapping.output as MemoryProfileOutput;
      return (
        <span className="font-mono text-sm">
          {formatMemoryAddress(memoryOutput)}
        </span>
      );
    }
  };

  // Render source indicator
  const renderSourceIndicator = () => {
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${
        mapping.source === 'memory' 
          ? 'bg-green-100 text-green-800' 
          : 'bg-blue-100 text-blue-800'
      }`}>
        {mapping.source === 'memory' ? 'MEM' : 'MSG'}
      </span>
    );
  };

  return (
    <TableCompactRow>
      <TableCompactCell>
        <div className="flex items-center gap-2">
          <span>{mapping.output.label}</span>
          {renderSourceIndicator()}
        </div>
      </TableCompactCell>
      <TableCompactCell>
        {renderAddressInfo()}
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
            <SelectItem value="Arduino">Serial</SelectItem>
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
              {mapping.deviceType === "PacDrive" && 
                (getOutputChannelOptions(mapping.deviceType, mapping.targetDevice) as number[]).map((option) => (
                  <SelectItem key={option.toString()} value={option.toString()}>
                    Channel {option}
                  </SelectItem>
                ))
              }
              {mapping.deviceType === "WLED" && 
                (getOutputChannelOptions(mapping.deviceType, mapping.targetDevice) as WLEDOutputProfile[]).map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name || "Unnamed Profile"}
                  </SelectItem>
                ))
              }
              
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
              ? "N/A for Serial" 
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
      <TableCompactCell>
        <Input
          type="text"
          value={testValue}
          onChange={(e) => onTestValueChange(e.target.value)}
          placeholder={mapping.deviceType === "PacDrive" ? "0 or 1" : "Enter value"}
          className="w-24"
          disabled={!mapping.active || !mapping.deviceType || mapping.deviceType === "None"}
        />
      </TableCompactCell>
      <TableCompactCell>
        <Button
          size="sm"
          variant="outline"
          onClick={onTestDispatch}
          disabled={isTestLoading || !testValue || !mapping.active || !mapping.deviceType || mapping.deviceType === "None"}
          className="px-2"
        >
          <Play className="h-3 w-3" />
        </Button>
      </TableCompactCell>
    </TableCompactRow>
  );
};
