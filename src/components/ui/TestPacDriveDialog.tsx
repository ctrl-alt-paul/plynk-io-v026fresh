
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { extractDeviceIndex, checkDeviceAvailability } from "@/utils/deviceUtils";
import { Loader, AlertCircle } from "lucide-react";
import { PacDriveStatus } from "./PacDriveStatus";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface TestPacDriveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceId: string;
  deviceName: string;
}

export function TestPacDriveDialog({
  open,
  onOpenChange,
  deviceId,
  deviceName,
}: TestPacDriveDialogProps) {
  // Internal channel uses 0-15, display uses 1-16
  const [channel, setChannel] = useState<number>(0);
  const [value, setValue] = useState<number>(0);
  const [isSending, setIsSending] = useState(false);
  const [deviceIndex, setDeviceIndex] = useState<number>(0);
  const [isDeviceResponsive, setIsDeviceResponsive] = useState<boolean | null>(null);
  const [isCheckingDevice, setIsCheckingDevice] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  // Display channel is internal channel + 1 (for UI)
  const displayChannel = channel + 1;
  
  // Extract device index from the deviceId when the dialog opens
  useEffect(() => {
    if (open) {
      const extractedIndex = extractDeviceIndex(deviceId);
      setDeviceIndex(extractedIndex >= 0 ? extractedIndex : 0);
      
      // Check if the device is responsive
      checkDeviceStatus(extractedIndex >= 0 ? extractedIndex : 0);
      
      // Clear any previous error
      setLastError(null);
    } else {
      // Reset state when dialog closes
      setIsDeviceResponsive(null);
      setLastError(null);
    }
  }, [open, deviceId]);

  // Check if the device is responsive
  const checkDeviceStatus = async (index: number) => {
    setIsCheckingDevice(true);
    setIsDeviceResponsive(null);
    setLastError(null);
    
    try {
      const isAvailable = await checkDeviceAvailability(index);
      setIsDeviceResponsive(isAvailable);
      
      if (!isAvailable) {
        const errorMsg = `Device ${index} does not appear to be responsive. Test signals may not work.`;
        setLastError(errorMsg);
        toast({
          title: "Device Check",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error) {
      setIsDeviceResponsive(false);
      
      const errorMsg = `Failed to verify device ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setLastError(errorMsg);
      toast({
        title: "Device Check Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsCheckingDevice(false);
    }
  };

  // Handle channel input change - convert from display (1-16) to internal (0-15)
  const handleChannelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const displayVal = parseInt(e.target.value);
    
    // Validate input range (1-16) for display
    if (isNaN(displayVal)) {
      setChannel(0); // Default to 0 internally (1 in UI)
    } else if (displayVal < 1) {
      setChannel(0); // Minimum is 0 internally (1 in UI)
    } else if (displayVal > 16) {
      setChannel(15); // Maximum is 15 internally (16 in UI)
    } else {
      setChannel(displayVal - 1); // Convert display value to internal value
    }
  };

  // Handle device index change
  const handleDeviceIndexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    
    if (isNaN(val)) {
      setDeviceIndex(0);
    } else if (val < 0) {
      setDeviceIndex(0);
    } else if (val > 15) {
      setDeviceIndex(15);
    } else {
      setDeviceIndex(val);
      checkDeviceStatus(val);
    }
  };

  // Handle sending test signal - UPDATED to use test-output-dispatch
  const handleSendTest = async () => {
    setIsSending(true);
    setLastError(null);
    
    try {
      // Create output object similar to what the game profile uses
      const testOutput = {
        label: `Test Channel ${displayChannel}`, // Human readable label
        device: "PacDrive",                      // Use exact device type name
        targetDevice: deviceIndex,               // Target device index
        channel: displayChannel,                 // Use UI channel number (1-16) - gameProfileDispatcher will convert to internal (0-15)
        value: value.toString(),                 // Value as string ("0" or "1")
        isActive: true                           // Must be active for test dispatch to work
      };
      
      // Use the unified test dispatch endpoint that works with the game manager
      const result = await window.electron?.testOutputDispatch(testOutput);
      
      if (!result) {
        throw new Error("No response received from testOutputDispatch");
      }
      
      if (result.success) {
        toast({
          title: "Test signal sent",
          description: `Channel ${displayChannel} set to ${value ? "ON" : "OFF"}`,
        });
      } else {
        const errorMsg = result.error || `There was an error communicating with the device. Device Index: ${deviceIndex}`;
        setLastError(errorMsg);
        toast({
          title: "Failed to send test signal",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMsg = `Failed to send test signal: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setLastError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test PacDrive Device: {deviceName}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Add PacDrive Status Component at the top */}
          <PacDriveStatus showDetails={false} />
          
          {/* Display last error, if any */}
          {lastError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{lastError}</AlertDescription>
            </Alert>
          )}
          
          {/* The Scan for Devices feature is intentionally excluded from this modal to prevent accidental reassignment */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="deviceIndex" className="text-right">
              Device Index
            </Label>
            <div className="col-span-3 flex items-center gap-2">
              <Input
                id="deviceIndex"
                type="number"
                min={0}
                max={15}
                value={deviceIndex}
                onChange={handleDeviceIndexChange}
                className="flex-1"
              />
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => checkDeviceStatus(deviceIndex)}
                disabled={isCheckingDevice}
                className="whitespace-nowrap"
              >
                {isCheckingDevice ? "Checking..." : "Check Device"}
              </Button>
            </div>
          </div>
          
          {isDeviceResponsive !== null && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Status</Label>
              <div className="col-span-3 flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${isDeviceResponsive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>{isDeviceResponsive ? "Device responding" : "Device not responding"}</span>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="channel" className="text-right">
              Output Channel
            </Label>
            <Input
              id="channel"
              type="number"
              min={1}
              max={16}
              value={displayChannel}
              onChange={handleChannelChange}
              className="col-span-3"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="value" className="text-right">
              Value
            </Label>
            <Select
              value={value.toString()}
              onValueChange={(val) => setValue(parseInt(val))}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">OFF (0)</SelectItem>
                <SelectItem value="1">ON (1)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendTest} 
            disabled={isSending || isCheckingDevice || (isDeviceResponsive === false)}
          >
            {isSending ? "Sending..." : "Send Test Signal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
