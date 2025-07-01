
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WLEDDevice } from "@/types/devices.d";
import { deviceStore } from "@/lib/deviceStore";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";

// Form validation schema
const formSchema = z.object({
  ipAddress: z.string().min(1, "IP address is required").regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Invalid IP address format")
});

type FormValues = z.infer<typeof formSchema>;

interface WLEDFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDevice: WLEDDevice | null;
  onSave: () => void;
}

export function WLEDFormDialog({ open, onOpenChange, initialDevice, onSave }: WLEDFormDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ipAddress: initialDevice?.ipAddress || ""
    }
  });

  // Fetch WLED device information using the Electron backend
  const fetchWLEDInfo = async (ipAddress: string) => {
    setIsConnecting(true);
    try {
      // Use our new backend function instead of direct fetch
      const data = await window.electron.getWLEDDeviceInfo(ipAddress);
      return data;
    } catch (error) {
      throw new Error(`Could not connect to WLED device at ${ipAddress}: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSaving(true);
      
      // Try to connect and get device info using our backend function
      const wledInfo = await fetchWLEDInfo(data.ipAddress);
      
      // Get device state if needed for segments
      let segmentCount = 0;
      let totalLEDs = wledInfo.leds?.count || 0;
      let ledsPerSegment: number[] = [];
      
      try {
        // Use our backend function to fetch state
        const wledState = await window.electron.getWLEDDeviceState(data.ipAddress);
        segmentCount = wledState.seg?.length || 0;
        ledsPerSegment = wledInfo.leds?.seglens || [];
      } catch (stateError) {
        // Continue with default values if state fetch fails
      }
      
      // Extract device details from the response
      const deviceName = wledInfo.name || `WLED at ${data.ipAddress}`;
      
      // Create or update the device
      const deviceData: WLEDDevice = {
        id: initialDevice?.id || "", // Will be set by deviceStore if new
        name: deviceName,
        type: "WLED",
        connected: true,
        ipAddress: data.ipAddress,
        segmentCount,
        totalLEDs,
        ledsPerSegment
      };
      
      // Add or edit device
      if (initialDevice) {
        await deviceStore.editDevice(initialDevice.id, deviceData);
        toast({
          title: "Device updated",
          description: `${deviceName} has been updated successfully.`
        });
      } else {
        await deviceStore.addDevice(deviceData);
        toast({
          title: "Device added",
          description: `${deviceName} has been added successfully.`
        });
      }
      
      // Close dialog and refresh device list
      onOpenChange(false);
      onSave();
      
    } catch (error) {
      toast({
        title: "Connection error",
        description: error instanceof Error ? error.message : "Failed to connect to WLED device",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {initialDevice ? "Edit WLED Device" : "Add WLED Device"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="ipAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IP Address</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. 192.168.1.150" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving || isConnecting}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isSaving || isConnecting}
              >
                {(isSaving || isConnecting) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isConnecting ? "Connecting..." : "Saving..."}
                  </>
                ) : (
                  initialDevice ? "Update" : "Add Device"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
