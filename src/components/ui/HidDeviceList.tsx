
import React, { useState, useEffect } from "react";
import { listHidDevices, filterPacDriveDevices, getDevicePathDebugInfo } from "@/utils/deviceUtils";
import { HidDeviceInfo } from "@/types/devices";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader, Usb, CheckCircle2, XCircle, Info, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface HidDeviceListProps {
  onSelectDevice?: (device: HidDeviceInfo) => void;
  onlyPacDrive?: boolean;
  showControls?: boolean;
  maxHeight?: string;
  className?: string;
  autoScan?: boolean; // New prop to control automatic scanning
  selectedDevicePath?: string; // New prop to highlight selected device
}

export function HidDeviceList({
  onSelectDevice,
  onlyPacDrive = false,
  showControls = true,
  maxHeight = "400px",
  className = "",
  autoScan = false, // Default to false to prevent automatic scanning
  selectedDevicePath
}: HidDeviceListProps) {
  const [devices, setDevices] = useState<HidDeviceInfo[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<HidDeviceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllDevices, setShowAllDevices] = useState(!onlyPacDrive);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticMode, setDiagnosticMode] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();
  
  // Add the handleRetry function that's missing
  const handleRetry = () => {
    setRetryCount(0); // Reset retry count
    loadDevices(); // Call the load devices function
  };
  
  const loadDevices = async () => {
    setIsLoading(true);
    setError(null);
    
    // Check if Electron API is available
    if (typeof window.electron === 'undefined') {
      setError("Electron API is not available. Device detection requires Electron environment.");
      setIsLoading(false);
      return;
    }
    
    // Check if the listHidDevices function exists
    if (!window.electron.listHidDevices) {
      setError("HID device listing function is not available in this environment.");
      setIsLoading(false);
      return;
    }
    
    try {
      console.log("HidDeviceList: Requesting HID devices...");
      const allDevices = await window.electron.listHidDevices();
      console.log(`HidDeviceList: Received ${allDevices ? allDevices.length : 'undefined'} devices response`);
      
      // Verify we got a valid array response
      if (!Array.isArray(allDevices)) {
        setError(`Invalid response from HID device listing: expected array but got ${typeof allDevices}`);
        setDevices([]);
        setFilteredDevices([]);
        setIsLoading(false);
        return;
      }
      
      console.log(`HidDeviceList: Processing ${allDevices.length} devices`);
      
      // Check if we have any devices with console.log for debugging
      if (allDevices.length > 0) {
        console.log("HidDeviceList: Example device:", allDevices[0]);
      } else {
        console.log("HidDeviceList: No devices found");
      }
      
      setDevices(allDevices);
      
      if (onlyPacDrive || !showAllDevices) {
        console.log("HidDeviceList: Filtering for PacDrive devices");
        const pacDriveDevices = filterPacDriveDevices(allDevices);
        console.log(`HidDeviceList: Found ${pacDriveDevices.length} potential PacDrive devices`);
        setFilteredDevices(pacDriveDevices);
        
        if (pacDriveDevices.length === 0 && allDevices.length > 0) {
          console.log("HidDeviceList: Found devices but none match PacDrive criteria");
          toast({
            title: "No PacDrive HID devices found",
            description: "Found other HID devices but none matching PacDrive vendor/product IDs.",
          });
        }
      } else {
        setFilteredDevices(allDevices);
      }
    } catch (error) {
      console.error("HidDeviceList error:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(errorMessage);
      
      // Display the error in toast notification
      toast({
        title: "Error listing HID devices",
        description: errorMessage,
        variant: "destructive",
      });
      
      // If first attempt failed, retry once more
      if (retryCount === 0) {
        console.log("HidDeviceList: First attempt failed, retrying once...");
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          loadDevices();
        }, 1000); // Wait 1 second before retrying
        return;
      } else {
        console.log("HidDeviceList: Retry also failed");
        setFilteredDevices([]);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Only load devices on initial mount if autoScan is true
  useEffect(() => {
    if (autoScan) {
      loadDevices();
    }
    // Reset retry count when component mounts
    setRetryCount(0);
  }, [autoScan]);
  
  // Update filtered devices when the filter toggle changes
  useEffect(() => {
    if (showAllDevices) {
      setFilteredDevices(devices);
    } else {
      setFilteredDevices(filterPacDriveDevices(devices));
    }
  }, [showAllDevices, devices]);
  
  const isPacDriveDevice = (device: HidDeviceInfo): boolean => {
    return (
      (device.vendorId === 0xD209 || device.vendorId === 53769 || 
       String(device.vendorId) === "0xD209" || String(device.vendorId) === "53769") &&
      (device.productId === 0x1500 || device.productId === 0x1501 || device.productId === 5376 ||
       String(device.productId) === "0x1500" || String(device.productId) === "0x1501" || String(device.productId) === "5376")
    );
  };
  
  const formatHexId = (id: number | string): string => {
    const numValue = typeof id === 'string' ? parseInt(id, 16) : id;
    return `0x${numValue.toString(16).toUpperCase().padStart(4, '0')}`;
  };
  
  const pathOrFallback = (device: HidDeviceInfo): string => {
    return device.path || `vendor:${formatHexId(device.vendorId)}&product:${formatHexId(device.productId)}`;
  };
  
  // Check if a device is selected (matching the selectedDevicePath)
  const isDeviceSelected = (device: HidDeviceInfo): boolean => {
    return !!selectedDevicePath && selectedDevicePath === device.path;
  };
  
  return (
    <div className={className}>
      {showControls && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">HID Devices</h3>
          <div className="flex gap-2">
            {devices.length === 0 && !isLoading && (
              <Button 
                variant="outline"
                size="sm"
                onClick={loadDevices} 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Usb className="mr-2 h-4 w-4" />
                    Scan for Devices
                  </>
                )}
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowAllDevices(!showAllDevices)}
              disabled={onlyPacDrive}
            >
              {showAllDevices ? "Show PacDrive Only" : "Show All Devices"}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setDiagnosticMode(!diagnosticMode)}
            >
              {diagnosticMode ? "Hide Diagnostics" : "Show Diagnostics"}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>
      )}
      
      {error && (
        <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
          <XCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
          <p className="font-medium">Error loading HID devices</p>
          <p className="text-sm mt-1">{error}</p>
          <div className="mt-3 space-y-2">
            <Button 
              variant="outline" 
              onClick={handleRetry}
            >
              Try Again
            </Button>
            <div className="text-xs mt-2">
              <p>If the error persists, try the following:</p>
              <ul className="list-disc pl-5 text-left mt-1">
                <li>Restart the application</li>
                <li>Check that devices are properly connected</li>
                <li>Verify that device drivers are installed</li>
                <li>Run as administrator (Windows) or with appropriate permissions</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2">Scanning for HID devices...</span>
        </div>
      ) : (devices.length === 0 && !error) ? (
        <div className="text-center p-8 bg-muted/20 rounded-lg">
          <Usb className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No HID devices found</p>
          <Button 
            variant="outline"
            className="mt-4" 
            onClick={loadDevices}
          >
            <Usb className="mr-2 h-4 w-4" />
            Scan for Devices
          </Button>
          <div className="mt-4 text-sm">
            <p>Troubleshooting tips:</p>
            <ul className="text-left list-disc pl-6 mt-2 text-muted-foreground">
              <li>Make sure your devices are properly connected</li>
              <li>Try disconnecting and reconnecting devices</li>
              <li>Restart the application to refresh device detection</li>
              <li>Check if device drivers are installed properly</li>
              <li>Run the application with appropriate permissions</li>
              <li>Some devices may require elevated permissions to access</li>
            </ul>
          </div>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="text-center p-8 bg-muted/20 rounded-lg">
          <Usb className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No matching HID devices found</p>
          {!showAllDevices && devices.length > 0 && (
            <Button 
              variant="link" 
              className="mt-2"
              onClick={() => setShowAllDevices(true)}
            >
              Show all {devices.length} HID devices
            </Button>
          )}
          <div className="mt-4 text-sm">
            <p>Troubleshooting tips:</p>
            <ul className="text-left list-disc pl-6 mt-2 text-muted-foreground">
              <li>Make sure your devices are properly connected</li>
              <li>Try disconnecting and reconnecting devices</li>
              <li>Restart the application to refresh device detection</li>
              <li>Check if device drivers are installed properly</li>
              <li>Run the application with appropriate permissions</li>
              <li>Some devices may require elevated permissions to access</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4" style={{ maxHeight, overflowY: "auto" }}>
          {filteredDevices.map((device, index) => (
            <Card 
              key={`${pathOrFallback(device)}-${index}`} 
              className={`${isPacDriveDevice(device) ? "border-primary/50" : ""} ${
                isDeviceSelected(device) ? "ring-2 ring-primary" : ""
              }`}
            >
              <CardHeader className="p-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base flex items-center gap-2">
                    {isPacDriveDevice(device) && (
                      <Badge variant="default" className="bg-primary text-primary-foreground">
                        PacDrive
                      </Badge>
                    )}
                    {isDeviceSelected(device) && (
                      <Badge variant="default" className="bg-green-500 text-white">
                        Selected
                      </Badge>
                    )}
                    {device.product || `Device ${index + 1}`}
                  </CardTitle>
                  <Badge variant="outline">
                    {device.interface !== undefined ? `Interface ${device.interface}` : "HID Device"}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {device.manufacturer || "Unknown Manufacturer"}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div className="text-muted-foreground">Vendor ID:</div>
                  <div>{formatHexId(device.vendorId)}</div>
                  
                  <div className="text-muted-foreground">Product ID:</div>
                  <div>{formatHexId(device.productId)}</div>
                  
                  {device.serialNumber && (
                    <>
                      <div className="text-muted-foreground">Serial:</div>
                      <div className="truncate">{device.serialNumber}</div>
                    </>
                  )}
                  
                  <div className="text-muted-foreground">Path:</div>
                  <div className="truncate text-xs">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help border-b border-dotted border-muted-foreground">
                            {device.path || "No path available"}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[300px] break-all">
                          <p>{device.path || "Device path information not available"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                
                {device.path && diagnosticMode && (
                  <Accordion type="single" collapsible className="mt-3 border-t pt-2">
                    <AccordionItem value="diagnostics">
                      <AccordionTrigger className="text-xs py-1">
                        Path Parsing Diagnostics
                      </AccordionTrigger>
                      <AccordionContent className="text-xs">
                        <div className="bg-muted/30 p-2 rounded">
                          {(() => {
                            const debugInfo = getDevicePathDebugInfo(device.path);
                            return (
                              <div className="grid grid-cols-1 gap-y-1">
                                <div className="font-semibold">Parsed Index: {debugInfo.result}</div>
                                <div>Format Match:</div>
                                <ul className="list-disc pl-5">
                                  {Object.entries(debugInfo.formats).map(([format, matches]) => (
                                    <li key={format} className={matches ? "text-green-600" : "text-gray-500"}>
                                      {format}: {matches ? "✓" : "✗"}
                                    </li>
                                  ))}
                                </ul>
                                <div>Extracted Values:</div>
                                <ul className="list-disc pl-5">
                                  {Object.entries(debugInfo.matches).map(([format, value]) => (
                                    <li key={format} className={value ? "text-green-600" : "text-gray-500"}>
                                      {format}: {value ?? "no match"}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })()}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </CardContent>
              {onSelectDevice && (
                <CardFooter className="px-4 pt-0 pb-4">
                  <Button 
                    variant={isDeviceSelected(device) ? "default" : "secondary"}
                    className="w-full"
                    onClick={() => onSelectDevice(device)}
                  >
                    {isDeviceSelected(device) ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Selected
                      </>
                    ) : (
                      "Select Device"
                    )}
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
