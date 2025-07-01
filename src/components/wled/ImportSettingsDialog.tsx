import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader, AlertTriangle, CheckCircle, ArrowDownToLine } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { WLEDDevice } from '@/types/devices';
import { getWLEDDevices, deviceStore } from '@/lib/deviceStore';
import { useWLEDDeviceConnection } from '@/hooks/useWLEDDeviceConnection';

interface ImportSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (ipAddress: string) => void;
}

// Define form schema
const importFormSchema = z.object({
  deviceIP: z.string().min(7, "Please select a WLED device"),
});

type ImportFormValues = z.infer<typeof importFormSchema>;

export const ImportSettingsDialog: React.FC<ImportSettingsDialogProps> = ({
  open,
  onOpenChange,
  onImport,
}) => {
  const { toast } = useToast();
  const [wledDevices, setWledDevices] = useState<WLEDDevice[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIpAddress, setSelectedIpAddress] = useState<string>('');
  const [connectionAttempted, setConnectionAttempted] = useState(false);
  
  // Use the WLED device connection hook
  const {
    ipAddress,
    isConnected,
    isLoading: isFetchingData,
    effects: availableEffects,
    availableSegments,
    connectToDevice,
    isConnectedTo,
  } = useWLEDDeviceConnection();
  
  const form = useForm<ImportFormValues>({
    resolver: zodResolver(importFormSchema),
    defaultValues: {
      deviceIP: "",
    },
  });
  
  // Load devices from device store when dialog opens
  useEffect(() => {
    if (open) {
      loadDevices();
      // Reset connection attempted flag when dialog opens
      setConnectionAttempted(false);
      setSelectedIpAddress('');
    }
  }, [open]);
  
  const loadDevices = async () => {
    try {
      await deviceStore.loadDevices();
      const devices = getWLEDDevices();
      setWledDevices(devices);
      
      // Reset form when dialog opens
      form.reset({
        deviceIP: "",
      });
    } catch (error) {
      //console.error('Error loading devices:', error);
      toast({
        title: 'Error',
        description: 'Failed to load WLED devices',
        variant: 'destructive',
      });
    }
  };
  
  // Handle device selection
  const handleDeviceSelect = useCallback(async (ipAddress: string) => {
    //console.log("Selected device IP:", ipAddress);
    setSelectedIpAddress(ipAddress);
    setConnectionAttempted(true);
    
    const success = await connectToDevice(ipAddress);
    //console.log("Connection success:", success);
    
  }, [connectToDevice]);
  
  // Calculate if button should be enabled - using useMemo to avoid recalculation on every render
  const isImportButtonEnabled = useMemo(() => {
    const isConnectedToSelected = isConnectedTo(selectedIpAddress);
    const formIsValid = form.formState.isValid;
    return !isProcessing && formIsValid && ((isConnected && ipAddress === selectedIpAddress) || isConnectedToSelected);
  }, [isProcessing, form.formState.isValid, isConnected, ipAddress, selectedIpAddress, isConnectedTo]);
  
  // Handle form submission
  const onSubmit = async (data: ImportFormValues) => {
    try {
      setIsProcessing(true);
      //console.log("Importing from device:", data.deviceIP);
      
      // Make sure we're still connected
      if (!isConnected && !isConnectedTo(data.deviceIP)) {
        //console.log("Not connected, attempting to connect...");
        const connected = await connectToDevice(data.deviceIP);
        if (!connected) {
          throw new Error("Failed to connect to WLED device");
        }
      }
      
      //console.log("Calling onImport with IP address:", data.deviceIP);
      // Call onImport with the selected device IP
      onImport(data.deviceIP);
      
      // Close the dialog
      onOpenChange(false);
    } catch (error) {
      //console.error('Error importing settings:', error);
      toast({
        title: 'Import Failed',
        description: 'Could not import settings from the WLED device',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Only render the internal content when dialog is open
  if (!open) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          {/* Placeholder to maintain dialog mounting */}
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import WLED Settings</DialogTitle>
          <DialogDescription>
            Import your WLED device's current settings as a profile
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="deviceIP"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WLED Device</FormLabel>
                  <div className="flex gap-2">
                    <FormControl className="flex-1">
                      <Select 
                        value={field.value} 
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleDeviceSelect(value);
                        }}
                        disabled={isFetchingData || isProcessing}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a WLED device" />
                        </SelectTrigger>
                        <SelectContent>
                          {wledDevices.length === 0 ? (
                            <SelectItem value="no-devices" disabled>
                              No WLED devices found
                            </SelectItem>
                          ) : (
                            wledDevices.map((device) => (
                              <SelectItem 
                                key={`import-device-${device.id}`} 
                                value={device.ipAddress}
                              >
                                {device.ipAddress} – {device.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </div>
                  <FormDescription className="flex items-center gap-1 mt-1">
                    {isConnectedTo(field.value) ? (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Connected: {availableEffects.length} effects, {availableSegments.length} segments</span>
                      </>
                    ) : field.value ? (
                      <>
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        <span>{isFetchingData ? "Connecting..." : "Not connected. Try selecting again."}</span>
                      </>
                    ) : (
                      "Select a WLED device to import from"
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={!isImportButtonEnabled}
              >
                {isProcessing ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Import Settings
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
