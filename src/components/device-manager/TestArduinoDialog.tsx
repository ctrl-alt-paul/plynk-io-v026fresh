
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ArduinoDevice } from "@/types/devices.d";
import { dispatchToArduino } from "@/dispatchers/arduinoDispatcher";
import { Loader2 } from "lucide-react";

interface TestArduinoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: ArduinoDevice;
}

export function TestArduinoDialog({
  open,
  onOpenChange,
  device,
}: TestArduinoDialogProps) {
  const [value, setValue] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const { comPort, baudRate } = device;

  const handleSendTest = async () => {
    if (!value.trim()) {
      toast({
        title: "Value required",
        description: "Please enter a value to send to the Serial device.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    
    try {
      await dispatchToArduino(comPort, baudRate, value);
      
      toast({
        title: "Test signal sent",
        description: `Value "${value}" was sent to ${device.name} at ${comPort} (${baudRate} baud).`,
      });
      
      // Auto-close dialog on success
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Failed to send test signal",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Test Serial Device: {device.name}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="comPort" className="text-right">
              COM Port
            </Label>
            <Input
              id="comPort"
              value={comPort}
              readOnly
              className="col-span-3 bg-muted"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="baudRate" className="text-right">
              Baud Rate
            </Label>
            <Input
              id="baudRate"
              value={baudRate}
              readOnly
              className="col-span-3 bg-muted"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="value" className="text-right">
              Value to Send
            </Label>
            <Input
              id="value"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="col-span-3"
              placeholder="Enter text or number"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendTest} 
            disabled={isSending || !value.trim()}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Test Value"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
