import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Scan, Edit, Trash2, Zap, Loader2, Search, Usb, Bug, ChevronDown, HardDrive, HelpCircle } from "lucide-react";
import { deviceStore } from "@/lib/deviceStore";
import { PacDriveDevice, HidDeviceInfo, ArduinoDevice, Device, WLEDDevice } from "@/types/devices.d";
import { isPacDriveDevice, isArduinoDevice, isWLEDDevice, extractDeviceIndex, scanForDevices, listHidDevices } from "@/utils/deviceUtils";
import { DeviceFormDialog } from "../components/device-manager/DeviceFormDialog";
import { ArduinoFormDialog } from "../components/device-manager/ArduinoFormDialog";
import { WLEDFormDialog } from "@/components/device-manager/WLEDFormDialog";
import { DeviceManagerHelpDialog } from "../components/DeviceManagerHelpDialog";
import { AlertDialogWrapper } from "@/components/ui/alert-dialog-wrapper";
import { useToast } from "@/hooks/use-toast";
import { TestPacDriveDialog } from "@/components/ui/TestPacDriveDialog";
import { TestArduinoDialog } from "@/components/device-manager/TestArduinoDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { HidDeviceList } from "@/components/ui/HidDeviceList";
import { PacDriveStatus } from "@/components/ui/PacDriveStatus";
import { DeviceDiagnostic } from "@/components/ui/DeviceDiagnostic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DeviceManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceType, setDeviceType] = useState<"All" | "PacDrive" | "Arduino" | "WLED">("All");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isArduinoFormOpen, setIsArduinoFormOpen] = useState(false);
  const [isWLEDFormOpen, setIsWLEDFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<PacDriveDevice | null>(null);
  const [editingArduinoDevice, setEditingArduinoDevice] = useState<ArduinoDevice | null>(null);
  const [editingWLEDDevice, setEditingWLEDDevice] = useState<WLEDDevice | null>(null);
  const [testingDevice, setTestingDevice] = useState<PacDriveDevice | null>(null);
  const [testingArduinoDevice, setTestingArduinoDevice] = useState<ArduinoDevice | null>(null);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [isArduinoTestDialogOpen, setIsArduinoTestDialogOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [foundDevices, setFoundDevices] = useState<number[]>([]);
  const [isScanDialogOpen, setIsScanDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("devices");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [selectedHidDevice, setSelectedHidDevice] = useState<HidDeviceInfo | null>(null);
  const [isConnectedDevicesOpen, setIsConnectedDevicesOpen] = useState(true);
  const [deviceAlreadyAddedState, setDeviceAlreadyAddedState] = useState<Record<number, boolean>>({});
  const [connectionStates, setConnectionStates] = useState<Record<string, boolean>>({});
  const [pacDriveConnectionStates, setPacDriveConnectionStates] = useState<Record<string, boolean>>({});
  const [isCheckingConnections, setIsCheckingConnections] = useState(false);
  const [hasCheckedPacDriveConnections, setHasCheckedPacDriveConnections] = useState(false);
  const [connectionChecksInProgress, setConnectionChecksInProgress] = useState({
    pacdrive: false,
    arduino: false,
    wled: false
  });
  const { toast } = useToast();

  // Load devices on mount
  useEffect(() => {
    const initializeDevices = async () => {
      const allDevices = await loadDevices();

      // Initially show browser tab if no devices exist
      if (allDevices.length === 0) {
        setActiveTab("browser");
      }

      // Set default collapsed state for connected devices section
      // Default to expanded if only 1 device, collapsed if 2+ devices
      setIsConnectedDevicesOpen(allDevices.length <= 1);

      // Check connections for all device types when the page loads
      // Only if there are devices to check
      if (allDevices.length > 0) {
        handleCheckAllConnections();
      }
    };
    initializeDevices();
  }, []);

  // Check PacDrive connection states
  const checkPacDriveConnectionStates = async (allDevices: Device[]): Promise<void> => {
    // Extract all PacDrive devices
    const pacDriveDevices = allDevices.filter(isPacDriveDevice) as PacDriveDevice[];
    if (pacDriveDevices.length === 0) {
      return;
    }
    
    // Set the specific check in progress
    setConnectionChecksInProgress(prev => ({ ...prev, pacdrive: true }));
    
    try {
      // Format devices for the check - get device IDs only
      const deviceIds = pacDriveDevices.map(device => parseInt(device.usbPath));

      // Test each device connection
      const statusesRecord: Record<string, boolean> = {};
      
      // Simple approach - test each device individually
      for (const device of pacDriveDevices) {
        try {
          const deviceId = parseInt(device.usbPath);
          const isConnected = await window.electron.testPacDriveDevice(deviceId);
          statusesRecord[device.id] = isConnected;
        } catch (error) {
          statusesRecord[device.id] = false;
        }
      }
      
      // Update the connection states
      setPacDriveConnectionStates(statusesRecord);
      
      // Mark as checked so we don't check again on initial load
      setHasCheckedPacDriveConnections(true);
    } catch (error) {
      // Silent error handling
    } finally {
      // Always reset the check status when done, regardless of errors
      setConnectionChecksInProgress(prev => ({ ...prev, pacdrive: false }));
      
      // Check if this was the last connection check in progress
      updateOverallCheckingState();
    }
  };

  // Check Arduino connection states
  const checkArduinoConnectionStates = async (allDevices: Device[]): Promise<void> => {
    // Extract all Arduino devices
    const arduinoDevices = allDevices.filter(isArduinoDevice) as ArduinoDevice[];
    if (arduinoDevices.length === 0) {
      return;
    }
    
    // Set the specific check in progress
    setConnectionChecksInProgress(prev => ({ ...prev, arduino: true }));
    
    try {
      // Format devices for the IPC call
      const deviceList = arduinoDevices.map(device => ({
        comPort: device.comPort,
        baudRate: device.baudRate
      }));

      // Get connection states from electron
      const states = await window.electron.getArduinoConnectionStates(deviceList);

      // Convert to a record for easier lookup
      const connectionStateRecord: Record<string, boolean> = {};
      states.forEach(state => {
        connectionStateRecord[state.comPort] = state.connected;
      });
      setConnectionStates(connectionStateRecord);
    } catch (error) {
      toast({
        title: "Connection Check Error",
        description: `Failed to check Arduino connection status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      // Always reset the check status when done, regardless of errors
      setConnectionChecksInProgress(prev => ({ ...prev, arduino: false }));
      
      // Check if this was the last connection check in progress
      updateOverallCheckingState();
    }
  };

  // Check WLED connection states
  const checkWLEDConnectionStates = async (allDevices: Device[]): Promise<void> => {
    // Extract all WLED devices
    const wledDevices = allDevices.filter(isWLEDDevice) as WLEDDevice[];
    if (wledDevices.length === 0) {
      return;
    }

    // Set the specific check in progress
    setConnectionChecksInProgress(prev => ({ ...prev, wled: true }));
    
    try {
      // Check each WLED device connection by pinging the IP address
      const statusUpdates: Record<string, boolean> = {};

      for (const device of wledDevices) {
        try {
          // Attempt to get device info which will throw if device is unreachable
          const deviceInfo = await window.electron.getWLEDDeviceInfo(device.ipAddress);
          statusUpdates[device.id] = true;
        } catch (error) {
          statusUpdates[device.id] = false;
        }
      }

      // Update device connection states in store
      for (const [id, connected] of Object.entries(statusUpdates)) {
        await deviceStore.updateDeviceConnectionState(id, connected);
      }

      // Reload devices to reflect connection status changes
      await loadDevices();
    } catch (error) {
      toast({
        title: "Connection Check Error",
        description: `Failed to check WLED connection status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      // Always reset the check status when done, regardless of errors
      setConnectionChecksInProgress(prev => ({ ...prev, wled: false }));
      
      // Check if this was the last connection check in progress
      updateOverallCheckingState();
    }
  };
  
  // Helper function to update the overall checking state
  const updateOverallCheckingState = () => {
    // If any check is still in progress, keep the overall state as checking
    setIsCheckingConnections(
      connectionChecksInProgress.pacdrive || 
      connectionChecksInProgress.arduino || 
      connectionChecksInProgress.wled
    );
  };

  // Load all device types
  const loadDevices = async () => {
    const allDevices = await deviceStore.getDevices();
    setDevices(allDevices);
    return allDevices;
  };

  // Combined connection check for all device types
  const handleCheckAllConnections = async () => {
    // Ensure we're not already checking connections
    if (isCheckingConnections) {
      return;
    }
    
    // Set the main checking state to true
    setIsCheckingConnections(true);
    
    try {
      const allDevices = await loadDevices();
      
      // Start all connection checks in parallel
      const promises = [];
      
      // Only check device types that exist in the device list
      if (allDevices.some(isPacDriveDevice)) {
        promises.push(checkPacDriveConnectionStates(allDevices));
      }
      
      if (allDevices.some(isArduinoDevice)) {
        promises.push(checkArduinoConnectionStates(allDevices));
      }
      
      if (allDevices.some(isWLEDDevice)) {
        promises.push(checkWLEDConnectionStates(allDevices));
      }
      
      // Wait for all checks to complete
      await Promise.all(promises);
      
      // Reload devices to reflect all connection status changes
      await loadDevices();
      
      // Only show toast if this was a manual check (not on page load)
      if (document.visibilityState === 'visible') {
        toast({
          title: "Connection check complete",
          description: "All device connection statuses have been updated."
        });
      }
    } catch (error) {
      toast({
        title: "Connection Check Error",
        description: `Failed to check device connections: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      // The individual connection check functions will handle resetting their own states
      // The overall state will be updated via updateOverallCheckingState
    }
  };

  // Filter devices based on selected type
  const filteredDevices = devices.filter(device => {
    if (deviceType === "All") return true;
    if (deviceType === "PacDrive") return isPacDriveDevice(device);
    if (deviceType === "Arduino") return isArduinoDevice(device);
    if (deviceType === "WLED") return isWLEDDevice(device);
    return true;
  });

  // Group devices by type
  const groupedDevices = filteredDevices.reduce<Record<string, Device[]>>((acc, device) => {
    const type = device.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(device);
    return acc;
  }, {});
  
  const handleAddDevice = (type: "PacDrive" | "Arduino" | "WLED") => {
    if (type === "PacDrive") {
      setEditingDevice(null);
      setIsFormOpen(true);
    } else if (type === "Arduino") {
      setEditingArduinoDevice(null);
      setIsArduinoFormOpen(true);
    } else if (type === "WLED") {
      setEditingWLEDDevice(null);
      setIsWLEDFormOpen(true);
    }
  };
  
  const handleEditDevice = (device: Device) => {
    if (isPacDriveDevice(device)) {
      setEditingDevice(device);
      setIsFormOpen(true);
    } else if (isArduinoDevice(device)) {
      setEditingArduinoDevice(device);
      setIsArduinoFormOpen(true);
    } else if (isWLEDDevice(device)) {
      setEditingWLEDDevice(device);
      setIsWLEDFormOpen(true);
    }
  };
  
  const handleTestDevice = (device: PacDriveDevice) => {
    setTestingDevice(device);
    setIsTestDialogOpen(true);
  };
  
  const handleTestArduinoDevice = (device: ArduinoDevice) => {
    setTestingArduinoDevice(device);
    setIsArduinoTestDialogOpen(true);
  };
  
  const handleDeleteDevice = async (id: string) => {
    const success = await deviceStore.removeDevice(id);
    if (success) {
      toast({
        title: "Device deleted",
        description: "The device has been successfully removed."
      });
      loadDevices();
    } else {
      toast({
        title: "Error",
        description: "Failed to delete the device.",
        variant: "destructive"
      });
    }
  };

  // Check if device already exists in the list
  const isDeviceAlreadyAdded = async (deviceIndex: number): Promise<boolean> => {
    const currentDevices = await deviceStore.getDevices();
    return currentDevices.some(device => {
      // Only check usbPath for devices that should have this property
      if (isPacDriveDevice(device) || isArduinoDevice(device)) {
        return extractDeviceIndex(device.usbPath) === deviceIndex;
      }
      return false;
    });
  };

  // Update the device already added state for all found devices
  useEffect(() => {
    const updateDeviceAddedState = async () => {
      const newState: Record<number, boolean> = {};
      for (const index of foundDevices) {
        newState[index] = await isDeviceAlreadyAdded(index);
      }
      setDeviceAlreadyAddedState(newState);
    };
    if (foundDevices.length > 0) {
      updateDeviceAddedState();
    }
  }, [foundDevices]);

  const handleScanDevices = async () => {
    setIsScanning(true);
    setFoundDevices([]);
    try {
      // We'll scan both PacDrive indices and HID devices
      const pacDriveIndices = await scanForDevices();
      if (pacDriveIndices.length > 0) {
        setFoundDevices(pacDriveIndices);
        setIsScanDialogOpen(true);
        toast({
          title: "Scan complete",
          description: `Found ${pacDriveIndices.length} PacDrive device(s).`
        });
      } else {
        // Try to list HID devices instead and show those
        const hidDevices = await listHidDevices();
        if (hidDevices.length > 0) {
          toast({
            title: "No PacDrive devices found",
            description: `Found ${hidDevices.length} HID devices but none identified as PacDrive. Check Device Browser tab.`,
            variant: "destructive"
          });
          // Switch to HID browser tab
          setActiveTab("browser");
        } else {
          toast({
            title: "No devices found",
            description: "No PacDrive or HID devices were detected. Make sure devices are connected properly.",
            variant: "destructive"
          });
          // Show diagnostics when no devices are found
          setShowDiagnostics(true);
        }
      }
    } catch (error) {
      toast({
        title: "Scan failed",
        description: `Failed to scan for PacDrive devices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
      setShowDiagnostics(true);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle checking Arduino connection states
  const handleCheckArduinoConnections = async () => {
    await checkArduinoConnectionStates(devices);
  };

  const handleAddFoundDevice = async (deviceIndex: number) => {
    const deviceName = `PacDrive ${deviceIndex}`;
    const newDevice: PacDriveDevice = {
      id: "",
      name: deviceName,
      type: "PacDrive",
      connected: true,
      usbPath: deviceIndex.toString(),
      deviceId: deviceIndex,
      channels: 16 // Using channels instead of outputCount
    };
    await deviceStore.addDevice(newDevice);
    await loadDevices();

    // Update the device already added state
    setDeviceAlreadyAddedState(prev => ({
      ...prev,
      [deviceIndex]: true
    }));
    toast({
      title: "Device added",
      description: `${deviceName} has been added successfully.`
    });
  };

  const handleAddAllFoundDevices = async () => {
    for (const deviceIndex of foundDevices) {
      // Check if a device with this index already exists
      const currentDevices = await deviceStore.getDevices();
      const indexExists = currentDevices.some(dev => {
        // Only check usbPath for devices that should have this property
        if (isPacDriveDevice(dev) || isArduinoDevice(dev)) {
          return extractDeviceIndex(dev.usbPath) === deviceIndex;
        }
        return false;
      });
      
      if (!indexExists) {
        await handleAddFoundDevice(deviceIndex);
      }
    }
    setIsScanDialogOpen(false);
  };

  const handleDeviceSaved = async () => {
    setIsFormOpen(false);
    setIsArduinoFormOpen(false);
    setIsWLEDFormOpen(false);
    const updatedDevices = await loadDevices();
    await checkArduinoConnectionStates(updatedDevices);
  };

  const handleHidDeviceSelected = (device: HidDeviceInfo) => {
    setSelectedHidDevice(device);

    // If it's a PacDrive device, open the add device dialog automatically
    if ((device.vendorId === 0xD209 || device.vendorId === 53769) && (device.productId === 0x1500 || device.productId === 0x1501 || device.productId === 5376)) {
      setEditingDevice(null);
      setIsFormOpen(true);
    } else {
      toast({
        description: "Selected device doesn't appear to be a PacDrive. Click 'Add Device' to configure it manually."
      });
    }
  };

  // Get a display-friendly device path
  const getDevicePathDisplay = (path: string): string => {
    const index = extractDeviceIndex(path);
    if (index >= 0) {
      return `${path} (Index: ${index})`;
    }
    return path;
  };

  // Get connection status for a device
  const getDeviceConnectionStatus = (device: Device): boolean => {
    if (isPacDriveDevice(device)) {
      // For PacDrive devices, use the connection status from our one-time check
      return pacDriveConnectionStates[device.id] ?? device.connected;
    } else if (isArduinoDevice(device)) {
      // For Arduino devices, use the connection state from our check
      return connectionStates[device.comPort] ?? device.connected;
    }
    // For other device types, just use the stored connected property
    return device.connected;
  };

  // Render device-specific details based on device type
  const renderDeviceDetails = (device: Device) => {
    if (isPacDriveDevice(device)) {
      return <>
          <td className="px-4 py-3 text-sm">{getDevicePathDisplay(device.usbPath)}</td>
          <td className="px-4 py-3 text-sm">
            {device.vendorId && device.productId && <Badge variant="outline">
                {device.vendorId}:{device.productId}
              </Badge>}
            {(isPacDriveDevice(device) && device.manufacturer) && <div className="text-xs text-muted-foreground mt-1">{device.manufacturer}</div>}
          </td>
        </>;
    } else if (isArduinoDevice(device)) {
      return <>
          <td className="px-4 py-3 text-sm">{device.comPort}</td>
          <td className="px-4 py-3 text-sm">
            <Badge variant="outline">{device.baudRate} baud</Badge>
          </td>
        </>;
    } else if (isWLEDDevice(device)) {
      return <>
          <td className="px-4 py-3 text-sm">{device.ipAddress}</td>
          <td className="px-4 py-3 text-sm">
            <Badge variant="outline">{device.segmentCount} segments</Badge>
            <div className="text-xs text-muted-foreground mt-1">{device.totalLEDs} LEDs total</div>
          </td>
        </>;
    }
    return <>
        <td className="px-4 py-3 text-sm">-</td>
        <td className="px-4 py-3 text-sm">-</td>
      </>;
  };

  // Render device-specific action buttons
  const renderDeviceActions = (device: Device) => {
    const commonActions = <>
        <Button variant="ghost" size="sm" onClick={() => handleEditDevice(device)}>
          <Edit className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Button>

        <AlertDialogWrapper title="Delete Device" description={`Are you sure you want to delete ${device.name}? This action cannot be undone.`} confirmText="Delete" cancelText="Cancel" destructive onConfirm={() => handleDeleteDevice(device.id)} trigger={<Button variant="ghost" size="sm">
              <Trash2 className="h-4 w-4 text-destructive" />
              <span className="sr-only">Delete</span>
            </Button>} />
      </>;
    if (isPacDriveDevice(device)) {
      return <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => handleTestDevice(device as PacDriveDevice)}>
            <Zap className="h-4 w-4" />
            <span className="sr-only">Test</span>
          </Button>
          {commonActions}
        </div>;
    }
    if (isArduinoDevice(device)) {
      return <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => handleTestArduinoDevice(device as ArduinoDevice)}>
            <Zap className="h-4 w-4" />
            <span className="sr-only">Test</span>
          </Button>
          {commonActions}
        </div>;
    }
    return <div className="flex justify-end gap-2">
        {commonActions}
      </div>;
  };

  return (
    <div className="container py-6">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-6 w-6" />
            <h1 className="text-2xl font-bold tracking-tight">Device Manager</h1>
          </div>
          
          <div className="flex gap-2">
            <div className="flex items-center gap-2">
              <DeviceManagerHelpDialog 
                trigger={
                  <Button variant="ghost" className="p-1 w-auto h-auto min-h-0 icon-large-override">
                    <HelpCircle className="h-5 w-5 text-blue-600" />
                  </Button>
                }
              />
              <Select value={deviceType} onValueChange={(value: "All" | "PacDrive" | "Arduino" | "WLED") => setDeviceType(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Devices</SelectItem>
                  <SelectItem value="PacDrive">PacDrive</SelectItem>
                  <SelectItem value="Arduino">Serial</SelectItem>
                  <SelectItem value="WLED">WLED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="ml-2">
              <Button onClick={() => {
              const menu = document.getElementById("addDeviceMenu");
              if (menu) {
                menu.classList.toggle("hidden");
              }
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Device
            </Button>
            <div id="addDeviceMenu" className="hidden absolute z-10 mt-1 w-48 rounded-md bg-white shadow-lg border">
              <div className="py-1">
                <button onClick={() => {
                handleAddDevice("PacDrive");
                const menu = document.getElementById("addDeviceMenu");
                if (menu) {
                  menu.classList.add("hidden");
                }
              }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100">
                  PacDrive
                </button>
                <button onClick={() => {
                handleAddDevice("Arduino");
                const menu = document.getElementById("addDeviceMenu");
                if (menu) {
                  menu.classList.add("hidden");
                }
              }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100">
                  Serial
                </button>
                <button onClick={() => {
                handleAddDevice("WLED");
                const menu = document.getElementById("addDeviceMenu");
                if (menu) {
                  menu.classList.add("hidden");
                }
              }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100">
                  WLED
                </button>
              </div>
            </div>
            </div>
            <Button variant="outline" onClick={handleScanDevices} disabled={isScanning}>
              {isScanning ? <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </> : <>
                  <Scan className="mr-2 h-4 w-4" />
                  Scan PacDrive Devices
                </>}
            </Button>
            <Button variant="outline" onClick={handleCheckAllConnections} disabled={isCheckingConnections}>
              {isCheckingConnections ? <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </> : <>
                  <Scan className="mr-2 h-4 w-4" />
                  Check All Connections
                </>}
            </Button>
            <Button variant="outline" onClick={() => setShowDiagnostics(!showDiagnostics)}>
              <Bug className="mr-2 h-4 w-4" />
              {showDiagnostics ? "Hide Diagnostics" : "Diagnostics"}
            </Button>
          </div>
        </div>
        
        <p className="text-muted-foreground mt-1 mb-6">
          Configure and manage hardware devices including PacDrive, Serial, and WLED controllers
        </p>
      </div>

      {/* Collapsible connected devices section */}
      <Collapsible open={isConnectedDevicesOpen} onOpenChange={setIsConnectedDevicesOpen} className="mb-6 border rounded-md bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-medium">Connected Devices</h2>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isConnectedDevicesOpen ? "" : "-rotate-90"}`} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="p-4">
            <PacDriveStatus showDetails={true} />
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      {showDiagnostics && <DeviceDiagnostic className="mb-6" />}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="devices">Device List</TabsTrigger>
          <TabsTrigger value="browser">HID Device Browser</TabsTrigger>
        </TabsList>
        
        <TabsContent value="devices" className="py-4">
          {filteredDevices.length === 0 ? <div className="text-center py-12 bg-muted/20 rounded-lg">
              <p className="text-muted-foreground">
                {deviceType === "All" ? "No devices found." : `No ${deviceType === "Arduino" ? "Serial" : deviceType} devices found.`}
              </p>
              <div className="mt-4 space-x-2">
                {deviceType === "All" || deviceType === "PacDrive" ? <Button onClick={() => handleAddDevice("PacDrive")} variant="outline" className="mr-2">
                    <Plus className="mr-2 h-4 w-4" />
                    Add PacDrive device
                  </Button> : null}
                {deviceType === "All" || deviceType === "Arduino" ? <Button onClick={() => handleAddDevice("Arduino")} variant="outline" className="mr-2">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Serial device
                  </Button> : null}
                {deviceType === "All" || deviceType === "WLED" ? <Button onClick={() => handleAddDevice("WLED")} variant="outline" className="mr-2">
                    <Plus className="mr-2 h-4 w-4" />
                    Add WLED device
                  </Button> : null}
                {deviceType === "All" || deviceType === "PacDrive" ? <Button onClick={handleScanDevices} disabled={isScanning}>
                    {isScanning ? <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Scanning...
                      </> : <>
                        <Scan className="mr-2 h-4 w-4" />
                        Scan for devices
                      </>}
                  </Button> : null}
              </div>
              <Button variant="link" onClick={() => setActiveTab("browser")} className="mt-2">
                Browse all HID devices
              </Button>
            </div> : <div className="space-y-8">
              {Object.entries(groupedDevices).map(([type, typeDevices]) => <div key={type} className="rounded-md border">
                  <div className="bg-muted/20 px-4 py-2 border-b">
                    <h3 className="font-medium">{type === "Arduino" ? "Serial" : type} Devices ({typeDevices.length})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Device Type</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">
                            {type === "PacDrive" ? "Device Path" : 
                             type === "Arduino" ? "COM Port" : 
                             type === "WLED" ? "IP Address" : "Path/ID"}
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium">
                            {type === "PacDrive" ? "Details" : 
                             type === "Arduino" ? "Baud Rate" : 
                             type === "WLED" ? "Segment Info" : "Details"}
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {typeDevices.map(device => <tr key={device.id} className="border-b last:border-0">
                            <td className="px-4 py-3 text-sm">{device.name}</td>
                            <td className="px-4 py-3 text-sm">
                              <Badge variant="outline" className="font-normal">
                                {device.type === "Arduino" ? "Serial" : device.type || "Unknown"}
                              </Badge>
                            </td>
                            {renderDeviceDetails(device)}
                            <td className="px-4 py-3 text-sm">
                              {getDeviceConnectionStatus(device) ? <div className="flex items-center">
                                  <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                                  Connected
                                </div> : <div className="flex items-center">
                                  <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                                  Disconnected
                                </div>}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {renderDeviceActions(device)}
                            </td>
                          </tr>)}
                      </tbody>
                    </table>
                  </div>
                </div>)}
            </div>}
        </TabsContent>
        
        <TabsContent value="browser" className="py-4">
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Usb className="h-5 w-5" />
                HID Device Browser
              </h3>
              <div className="flex gap-2">
                <Button onClick={() => handleAddDevice("PacDrive")} disabled={isFormOpen} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add PacDrive
                </Button>
                <Button onClick={() => handleAddDevice("Arduino")} disabled={isArduinoFormOpen} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Serial
                </Button>
                <Button onClick={() => handleAddDevice("WLED")} disabled={isWLEDFormOpen} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add WLED
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Browse all HID devices connected to your system. Select a device to add it to your configuration.
              Devices that appear to be PacDrive compatible will be highlighted.
            </p>
            <HidDeviceList onSelectDevice={handleHidDeviceSelected} showControls={true} maxHeight="500px" />
          </div>
        </TabsContent>
      </Tabs>

      <DeviceFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} initialDevice={editingDevice} onSave={handleDeviceSaved} />
      
      <ArduinoFormDialog open={isArduinoFormOpen} onOpenChange={setIsArduinoFormOpen} initialDevice={editingArduinoDevice} onSave={handleDeviceSaved} />
      
      <WLEDFormDialog open={isWLEDFormOpen} onOpenChange={setIsWLEDFormOpen} initialDevice={editingWLEDDevice} onSave={handleDeviceSaved} />
      
      {testingDevice && <TestPacDriveDialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen} deviceId={testingDevice.usbPath} deviceName={testingDevice.name} />}
      
      {testingArduinoDevice && <TestArduinoDialog open={isArduinoTestDialogOpen} onOpenChange={setIsArduinoTestDialogOpen} device={testingArduinoDevice} />}
      
      {/* Device Scan Results Dialog */}
      <Dialog open={isScanDialogOpen} onOpenChange={setIsScanDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discovered PacDrive Devices</DialogTitle>
            <DialogDescription>
              The following PacDrive devices were found. Select devices to add to your configuration.
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[300px] overflow-y-auto py-4">
            <div className="space-y-2">
              {foundDevices.length > 0 ? foundDevices.map(deviceIndex => {
              const alreadyAdded = deviceAlreadyAddedState[deviceIndex];
              return <div key={deviceIndex} className="flex items-center justify-between p-2 border rounded-md">
                      <div>
                        <p className="font-medium">Device Index: {deviceIndex}</p>
                        <p className="text-sm text-muted-foreground">
                          {alreadyAdded ? "Already in your device list" : "Available to add"}
                        </p>
                      </div>
                      <Button onClick={() => handleAddFoundDevice(deviceIndex)} disabled={alreadyAdded} size="sm">
                        {alreadyAdded ? "Added" : "Add Device"}
                      </Button>
                    </div>;
            }) : <p className="text-center py-4 text-muted-foreground">No devices found</p>}
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsScanDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handleAddAllFoundDevices} disabled={foundDevices.length === 0 || foundDevices.every(index => deviceAlreadyAddedState[index])}>
              Add All New Devices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
