import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import { useWLEDDeviceConnection } from '@/hooks/useWLEDDeviceConnection';

interface ImportSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (ipAddress: string) => Promise<void>;
}

export const ImportSettingsDialog: React.FC<ImportSettingsDialogProps> = ({
  open,
  onOpenChange,
  onImport,
}) => {
  const [ipAddress, setIpAddress] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const { isConnected, connectToDevice } = useWLEDDeviceConnection();

  const handleImport = async () => {
    setIsImporting(true);
    try {
      await onImport(ipAddress);
      onOpenChange(false);
    } catch (error) {
      //console.error("Failed to import profile:", error);
      toast({
        title: "Import Failed",
        description: `Could not import profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleConnect = async () => {
    try {
      await connectToDevice(ipAddress);
    } catch (error) {
      //console.error("Failed to connect to device:", error);
      toast({
        title: "Connection Failed",
        description: `Could not connect to device: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Settings from WLED Device</DialogTitle>
          <DialogDescription>
            Enter the IP address of your WLED device to import its settings.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="ipAddress" className="text-right">
              IP Address
            </label>
            <Input
              type="text"
              id="ipAddress"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Connected to {ipAddress}</span>
              </>
            ) : ipAddress ? (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Not connected.</span>
              </>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={handleConnect} disabled={isImporting}>
              {isImporting ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <></>}
              Connect
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleImport} disabled={isImporting || !isConnected}>
            {isImporting ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <></>}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
