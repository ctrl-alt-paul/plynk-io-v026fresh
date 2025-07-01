import React, { useState, useEffect } from "react";
import { v4 as uuid } from "uuid";
import { ArduinoDevice } from "@/types/devices.d";
import { deviceStore } from "@/lib/deviceStore";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 250000, 500000];

interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  vendorId?: string;
  productId?: string;
  serialNumber?: string;
}

interface ArduinoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDevice: ArduinoDevice | null;
  onSave: (device: ArduinoDevice) => void;
}

export function ArduinoFormDialog({
  open,
  onOpenChange,
  initialDevice,
  onSave,
}: ArduinoFormDialogProps) {
  const [name, setName] = useState("");
  const [comPort, setComPort] = useState("");
  const [baudRate, setBaudRate] = useState<number>(9600);
  const [connected, setConnected] = useState(false);
  const [comPortError, setComPortError] = useState("");
  const [serialPorts, setSerialPorts] = useState<SerialPortInfo[]>([]);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [customPortEntry, setCustomPortEntry] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  
  const isEditing = !!initialDevice;
  const { toast } = useToast();

  // Reset form when dialog opens and automatically scan for ports
  useEffect(() => {
    if (open) {
      if (initialDevice) {
        setName(initialDevice.name);
        setComPort(initialDevice.comPort);
        setBaudRate(initialDevice.baudRate);
        setConnected(initialDevice.connected);
      } else {
        setName("");
        setComPort("");
        setBaudRate(9600);
        setConnected(false);
      }
      setComPortError("");
      setCustomPortEntry(false);
      setScanError(null);
      
      // Auto-scan for ports when dialog opens
      scanForPorts();
    }
  }, [open, initialDevice]);

  // Scan for available serial ports
  const scanForPorts = async () => {
    setLoadingPorts(true);
    setScanError(null);
    
    try {
      const ports = await window.electron.listSerialPorts();
      setSerialPorts(ports);
      
      if (ports.length === 0) {
        setScanError("No serial ports found. Make sure your Serial device is connected and drivers are installed.");
      }
    } catch (error) {
      setScanError(`Failed to scan serial ports: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSerialPorts([]);
    } finally {
      setLoadingPorts(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Device name is required",
        variant: "destructive",
      });
      return;
    }

    if (!comPort.trim()) {
      setComPortError("COM port is required");
      return;
    }

    // Clear any existing error
    setComPortError("");

    const deviceData: ArduinoDevice = {
      id: initialDevice?.id || uuid(),
      name: name.trim(),
      type: "Arduino",
      comPort: comPort.trim(),
      baudRate,
      protocol: "Serial",
      connected,
      usbPath: comPort.trim(),
    };

    try {
      if (isEditing && initialDevice) {
        await deviceStore.editDevice(initialDevice.id, deviceData);
        toast({
          title: "Device Updated",
          description: `${name} has been updated successfully.`,
        });
      } else {
        await deviceStore.addDevice(deviceData);
        toast({
          title: "Device Added",
          description: `${name} has been added successfully.`,
        });
      }

      onSave(deviceData);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? "update" : "add"} device: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Serial Device" : "Add New Serial Device"}
          </DialogTitle>
          <DialogDescription>
            Configure your Serial device settings. Make sure your device is connected before scanning for ports.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {scanError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Port Scan Error</AlertTitle>
              <AlertDescription>{scanError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Serial Device"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="comPort" className="text-right">
              COM Port
            </Label>
            <div className="col-span-3 space-y-2">
              <div className="flex gap-2">
                {!customPortEntry ? (
                  <Select
                    value={comPort}
                    onValueChange={setComPort}
                    disabled={loadingPorts}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={loadingPorts ? "Scanning..." : "Select COM port"} />
                    </SelectTrigger>
                    <SelectContent>
                      {serialPorts.map((port) => (
                        <SelectItem key={port.path} value={port.path}>
                          {port.path} {port.manufacturer && `(${port.manufacturer})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={comPort}
                    onChange={(e) => setComPort(e.target.value)}
                    placeholder="e.g., COM3 or /dev/ttyUSB0"
                    className="flex-1"
                  />
                )}
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={scanForPorts}
                  disabled={loadingPorts}
                  className="whitespace-nowrap"
                >
                  {loadingPorts ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setCustomPortEntry(!customPortEntry)}
                >
                  {customPortEntry ? "Use dropdown" : "Enter manually"}
                </Button>
              </div>
              
              {comPortError && (
                <p className="text-sm text-red-500">{comPortError}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="baudRate" className="text-right">
              Baud Rate
            </Label>
            <Select
              value={baudRate.toString()}
              onValueChange={(value) => setBaudRate(parseInt(value))}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BAUD_RATES.map((rate) => (
                  <SelectItem key={rate} value={rate.toString()}>
                    {rate.toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing ? "Update Device" : "Add Device"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
