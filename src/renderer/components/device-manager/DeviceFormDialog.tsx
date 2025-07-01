import React, { useState, useEffect } from "react";
import { v4 as uuid } from "uuid";
import { PacDriveDevice, HidDeviceInfo } from "@/types/devices.d";
import { deviceStore } from "@/lib/deviceStore";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  isValidPacDrivePath, 
  getDevicePathHelpText, 
  getDevicePathExample,
  extractDeviceIndex 
} from "@/utils/deviceUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HidDeviceList } from "@/components/ui/HidDeviceList";
import { PacDriveStatus } from "@/components/ui/PacDriveStatus";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Usb, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";

interface DeviceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDevice: PacDriveDevice | null;
  onSave: (device: PacDriveDevice) => void;
}

export function DeviceFormDialog({
  open,
  onOpenChange,
  initialDevice,
  onSave,
}: DeviceFormDialogProps) {
  const [name, setName] = useState("");
  const [usbPath, setUsbPath] = useState("");
  const [connected, setConnected] = useState(true);
  const [pathError, setPathError] = useState("");
  const [activeTab, setActiveTab] = useState<string>("manual");
  const [selectedHidDevice, setSelectedHidDevice] = useState<HidDeviceInfo | null>(null);
  const [pathValidationStatus, setPathValidationStatus] = useState<'none' | 'valid' | 'invalid'>('none');
  const [isValidating, setIsValidating] = useState(false);
  const [pacDriveStatus, setPacDriveStatus] = useState<any>(null);
  const [noMatchWarning, setNoMatchWarning] = useState<string | null>(null);
  const [userHasEditedPath, setUserHasEditedPath] = useState(false);
  
  const isEditing = !!initialDevice;
  const platform = window.electron?.platform || "unknown";
  const { toast } = useToast();

  // Fetch PacDrive status on dialog open
  useEffect(() => {
    if (open) {
      fetchPacDriveStatus();
    }
  }, [open]);

  // Fetch PacDrive status information
  const fetchPacDriveStatus = async () => {
    if (window.electron?.getPacDriveStatus) {
      try {
        const status = await window.electron.getPacDriveStatus();
        setPacDriveStatus(status);
      } catch (error) {
        //console.error("Error fetching PacDrive status:", error);
      }
    }
  };

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (initialDevice) {
        setName(initialDevice.name);
        setUsbPath(initialDevice.usbPath);
        setConnected(initialDevice.connected);
        setActiveTab("manual"); // Default to manual tab when editing
        setUserHasEditedPath(false);
      } else {
        setName("");
        // Set appropriate default path based on platform
        if (platform === 'win32') {
          setUsbPath("0");
        } else if (platform === 'linux') {
          setUsbPath("/dev/usb/hiddev0");
        } else {
          setUsbPath("0");
        }
        setConnected(true);
        setActiveTab("scan"); // Default to scan tab when adding new
        setUserHasEditedPath(false);
      }
      setPathError("");
      setNoMatchWarning(null);
      setSelectedHidDevice(null);
      setPathValidationStatus('none');
    }
  }, [open, initialDevice, platform]);

  // Match selected HID device to a PacDrive device in connected devices list
  const findMatchingPacDriveIndex = (hidDevice: HidDeviceInfo): number | null => {
    if (!pacDriveStatus || !pacDriveStatus.deviceDetails || !pacDriveStatus.deviceDetails.length) {
      return null;
    }
    
    // Convert hex strings to numbers for comparison
    const hidVendorId = hidDevice.vendorId;
    const hidProductId = hidDevice.productId;
    
    // Look for a match in the connected PacDrive devices
    for (const device of pacDriveStatus.deviceDetails) {
      const deviceVendorId = parseInt(device.vendorId?.replace("0x", ""), 16);
      const deviceProductId = parseInt(device.productId?.replace("0x", ""), 16);
      
      if (deviceVendorId === hidVendorId && deviceProductId === hidProductId && device.responsive) {
        return device.deviceId; // This is the correct PacDrive index for this device
      }
    }
    
    return null; // No match found
  };

  const isPacDriveDevice = (device: HidDeviceInfo): boolean => {
    return (
      (device.vendorId === 0xD209 || Number(device.vendorId) === 0xD209 || device.vendorId === 53769 || Number(device.vendorId) === 53769) &&
      (device.productId === 0x1500 || Number(device.productId) === 0x1500 || device.productId === 0x1501 || Number(device.productId) === 0x1501 || device.productId === 5376 || Number(device.productId) === 5376)
    );
  };

  // Update path when a HID device is selected
  useEffect(() => {
    if (selectedHidDevice && !userHasEditedPath) {
      // First, try to find a matching PacDrive device index
      const pacDriveIndex = findMatchingPacDriveIndex(selectedHidDevice);
      
      if (pacDriveIndex !== null) {
        // If we found a matching PacDrive device, use its index
        setUsbPath(pacDriveIndex.toString());
        setNoMatchWarning(null);
        
        // Validate the path automatically
        validatePath(pacDriveIndex.toString());
      } else {
        // If no match found, extract index from path but show a warning
        const extractedIndex = extractDeviceIndex(selectedHidDevice.path);
        setNoMatchWarning(
          "No matching PacDrive device found in connected devices. " +
          "The extracted index may not work correctly."
        );
        
        // Still set a value, but we've shown a warning
        if (extractedIndex >= 0) {
          setUsbPath(extractedIndex.toString());
        } else {
          // If we can't extract a valid index, leave it empty
          setUsbPath("");
        }
      }
      
      // Generate a name if none exists yet
      if (!name) {
        const deviceName = selectedHidDevice.product || 
          `PacDrive (${selectedHidDevice.vendorId.toString(16)}:${selectedHidDevice.productId.toString(16)})`;
        setName(deviceName);
      }
      
      // Switch to manual tab to show the device details
      setActiveTab("manual");
    }
  }, [selectedHidDevice, pacDriveStatus, userHasEditedPath, name]);

  // Validate USB path
  const validatePath = (path: string): boolean => {
    setPathValidationStatus('none');
    
    if (!path) {
      setPathError("Device path is required");
      return false;
    }

    if (!isValidPacDrivePath(path)) {
      setPathError("Invalid device path format");
      return false;
    }

    setPathError("");
    return true;
  };

  // Test if the path is actually valid by trying to connect to the device
  const testDeviceConnection = async () => {
    if (!validatePath(usbPath)) {
      return;
    }

    setIsValidating(true);
    setPathValidationStatus('none');

    try {
      // Try to extract a numeric index
      const deviceIndex = extractDeviceIndex(usbPath);
      
      if (deviceIndex >= 0) {
        // If we have a valid index, try to test the device
        if (window.electron?.testPacDriveDevice) {
          const isValid = await window.electron.testPacDriveDevice(deviceIndex);
          
          if (isValid) {
            setPathValidationStatus('valid');
            toast({
              description: `Successfully connected to PacDrive at index ${deviceIndex}`,
            });
          } else {
            setPathValidationStatus('invalid');
            toast({
              title: "Connection Failed",
              description: `Could not connect to PacDrive at index ${deviceIndex}. Make sure the device is properly connected.`,
              variant: "destructive",
            });
          }
        } else {
          // Fallback to just checking format validity
          setPathValidationStatus('valid');
          toast({
            description: "Device path format is valid, but connection test is not available.",
          });
        }
      } else {
        // If we couldn't extract an index, just validate the format
        setPathValidationStatus('valid');
        toast({
          description: "Device path format is valid, but couldn't test actual connection.",
        });
      }
    } catch (error) {
      //console.error("Error testing device connection:", error);
      setPathValidationStatus('invalid');
      toast({
        title: "Connection Test Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred while testing connection",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Use default name if none is provided
    const deviceName = name || "PacDrive Device";
    
    if (!validatePath(usbPath)) {
      return;
    }
    
    try {
      const deviceData: PacDriveDevice = {
        id: initialDevice?.id || uuid(),
        name: deviceName, // Use the deviceName variable which has the default if needed
        type: "PacDrive",
        usbPath,
        connected,
        deviceId: extractDeviceIndex(usbPath),
        channels: 16,
        // Add HID device details if available
        ...(selectedHidDevice && {
          vendorId: `0x${selectedHidDevice.vendorId.toString(16).toUpperCase()}`,
          productId: `0x${selectedHidDevice.productId.toString(16).toUpperCase()}`,
          manufacturer: selectedHidDevice.manufacturer,
          product: selectedHidDevice.product,
          serialNumber: selectedHidDevice.serialNumber,
          hidPath: selectedHidDevice.path
        })
      };

      let savedDevice;
      if (isEditing) {
        savedDevice = deviceStore.editDevice(deviceData.id, deviceData);
        toast({
          title: "Device Updated",
          description: `${deviceName} has been updated successfully.`,
        });
      } else {
        savedDevice = deviceStore.addDevice(deviceData);
        toast({
          title: "Device Added",
          description: `${deviceName} has been added successfully.`,
        });
      }

      if (savedDevice) {
        onSave(deviceData);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? "update" : "add"} device.`,
        variant: "destructive",
      });
    }
  };

  const handleHidDeviceSelected = (device: HidDeviceInfo) => {
    setSelectedHidDevice(device);
    setUserHasEditedPath(false); // Reset the flag when a new device is selected
    // Tab change will happen in the useEffect that watches selectedHidDevice
  };

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsbPath(e.target.value);
    setUserHasEditedPath(true); // Mark that the user has manually edited the path
    validatePath(e.target.value);
    // Reset validation status when path changes
    setPathValidationStatus('none');
  };

  const helpText = getDevicePathHelpText(platform);
  const examplePath = getDevicePathExample(platform);

  // Render a UI card showing the selected device details
  const renderSelectedDeviceCard = () => {
    if (!selectedHidDevice) return null;

    // Determine if there's a matching PacDrive device
    const pacDriveIndex = findMatchingPacDriveIndex(selectedHidDevice);
    const extractedHidIndex = extractDeviceIndex(selectedHidDevice.path);
    const isPacDriveCompatible = selectedHidDevice.vendorId === 0xD209 || selectedHidDevice.vendorId === 53769;

    return (
      <Card className="p-4 mb-4 bg-primary/10 border-primary/30 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Usb className="h-5 w-5 text-primary" />
          <h4 className="font-medium text-base">Selected HID Device</h4>
          <Badge variant={isPacDriveCompatible ? "default" : "outline"}>
            {isPacDriveCompatible ? "PacDrive Compatible" : "Custom HID Device"}
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-y-2 text-sm mt-3">
          <div className="text-muted-foreground">Manufacturer:</div>
          <div className="font-medium">{selectedHidDevice.manufacturer || "Unknown"}</div>
          
          <div className="text-muted-foreground">Product:</div>
          <div className="font-medium">{selectedHidDevice.product || "Unknown"}</div>
          
          <div className="text-muted-foreground">Vendor ID:</div>
          <div className="font-medium">0x{selectedHidDevice.vendorId.toString(16).toUpperCase()}</div>
          
          <div className="text-muted-foreground">Product ID:</div>
          <div className="font-medium">0x{selectedHidDevice.productId.toString(16).toUpperCase()}</div>
          
          {selectedHidDevice.serialNumber && (
            <>
              <div className="text-muted-foreground">Serial:</div>
              <div className="font-medium">{selectedHidDevice.serialNumber}</div>
            </>
          )}
          
          <div className="text-muted-foreground">Path:</div>
          <div className="truncate font-medium">{selectedHidDevice.path}</div>
          
          <div className="text-muted-foreground">HID Path Extracted Index:</div>
          <div className="font-medium">{extractedHidIndex}</div>
          
          {pacDriveIndex !== null && (
            <>
              <div className="text-muted-foreground">PacDrive Device Index:</div>
              <div className="font-medium font-bold text-green-600">{pacDriveIndex}</div>
            </>
          )}
        </div>
        
        {noMatchWarning && (
          <div className="mt-3 bg-amber-50 p-2 rounded border border-amber-200 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-amber-700">{noMatchWarning}</p>
          </div>
        )}
        
        <div className="mt-3 bg-primary/5 p-2 rounded border border-primary/10 text-xs">
          <p className="text-muted-foreground">
            This device has been selected and its information has been automatically populated into the form fields. 
            {pacDriveIndex !== null 
              ? " The Device Path has been set to the correct PacDrive index for optimal compatibility." 
              : " No matching PacDrive device was found - you may need to adjust the Device Path manually."}
          </p>
        </div>
      </Card>
    );
  };

  const getValidationIcon = () => {
    if (pathValidationStatus === 'valid') {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    } else if (pathValidationStatus === 'invalid') {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit PacDrive Device" : "Add PacDrive Device"}
            </DialogTitle>
            <DialogDescription>
              Configure your PacDrive device connection settings.
            </DialogDescription>
          </DialogHeader>
          
          <PacDriveStatus className="my-4" />
          
          <Tabs 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="mt-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Manual Configuration</TabsTrigger>
              <TabsTrigger value="scan">Scan for Devices</TabsTrigger>
            </TabsList>
            
            <TabsContent value="manual" className="py-4">
              {renderSelectedDeviceCard()}
              
              <div className="grid gap-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="col-span-3"
                    placeholder="PacDrive Device"
                    required
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="usbPath" className="text-right">
                    Device Path
                  </Label>
                  <div className="col-span-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      <Input
                        id="usbPath"
                        value={usbPath}
                        onChange={handlePathChange}
                        className={pathError ? "border-destructive" : ""}
                        placeholder={examplePath}
                        required
                      />
                      <div className="flex-shrink-0">
                        {getValidationIcon()}
                      </div>
                    </div>
                    {pathError ? (
                      <p className="text-sm text-destructive">{pathError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{helpText}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Example: {examplePath}</p>
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={testDeviceConnection}
                      disabled={!usbPath || isValidating}
                      className="mt-2"
                    >
                      {isValidating ? "Testing..." : "Test Connection"}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="outputCount" className="text-right">
                    Output Count
                  </Label>
                  <Input
                    id="outputCount"
                    value="16"
                    className="col-span-3"
                    disabled
                    title="Output count is fixed at 16 for PacDrive devices"
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="scan" className="py-4">
              <div className="mb-4">
                <Button
                  type="button"
                  onClick={() => {
                    const hidDeviceListElement = document.getElementById('hidDeviceList');
                    if (hidDeviceListElement) {
                      hidDeviceListElement.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="w-full"
                >
                  <Usb className="mr-2 h-4 w-4" />
                  Scan for HID Devices
                </Button>
              </div>
              
              <div id="hidDeviceList">
                <HidDeviceList 
                  onlyPacDrive={false} 
                  onSelectDevice={handleHidDeviceSelected}
                  maxHeight="300px"
                  autoScan={false} // Don't auto scan
                  selectedDevicePath={selectedHidDevice?.path}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {isEditing ? "Save Changes" : "Add Device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
