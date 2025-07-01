
import React, { useState, useEffect } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader, Usb, AlertCircle, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { runPacDriveDiagnostics } from "@/utils/deviceUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PacDriveStatusProps {
  showDetails?: boolean;
  className?: string;
}

interface PacDriveStatus {
  initialized: boolean;
  dllLoaded: boolean;
  dllLoadError: string | null;
  deviceCount: number;
  connectedDevices: number[];
  deviceDetails: Array<{
    deviceId: number;
    vendorId?: string;
    productId?: string;
    responsive: boolean;
  }>;
  initializationError?: string;
  dllPath?: string;
}

export function PacDriveStatus({ showDetails = false, className = "" }: PacDriveStatusProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<PacDriveStatus | null>(null);
  const [expanded, setExpanded] = useState(showDetails);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const { toast } = useToast();

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      if (!window.electron?.getPacDriveStatus) {
        throw new Error("PacDrive status API not available");
      }
      
      const data = await window.electron.getPacDriveStatus();
      setStatus(data);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to get PacDrive status: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Don't set up interval for auto-refresh to avoid excess IPC calls
  }, []);

  const getStatusBadge = () => {
    if (!status) {
      return <Badge variant="outline">Unknown</Badge>;
    }
    
    if (!status.dllLoaded) {
      return <Badge variant="destructive">DLL Not Loaded</Badge>;
    }
    
    if (!status.initialized) {
      return <Badge variant="destructive">Not Initialized</Badge>;
    }
    
    if (status.deviceCount === 0) {
      return <Badge variant="destructive">No Devices</Badge>;
    }
    
    return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Ready</Badge>;
  };

  const runDiagnostics = async () => {
    setDiagnosticsRunning(true);
    try {
      const results = await runPacDriveDiagnostics();
      setDiagnostics(results);
    } catch (error) {
      toast({
        title: "Diagnostics Error",
        description: `Failed to run diagnostics: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setDiagnosticsRunning(false);
    }
  };

  if (isLoading) {
    return (
      <Alert className={className}>
        <div className="flex items-center">
          <Loader className="mr-2 h-4 w-4 animate-spin" />
          <span>Loading PacDrive status...</span>
        </div>
      </Alert>
    );
  }

  return (
    <Alert className={`${status?.dllLoaded ? "" : "bg-red-50 border-red-200 text-red-900"} ${className}`}>
      <AlertTitle className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>PacDrive Status</span>
          {getStatusBadge()}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide Details" : "Show Details"}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchStatus}
          >
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={runDiagnostics}
            disabled={diagnosticsRunning}
          >
            {diagnosticsRunning ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              "Run Diagnostics"
            )}
          </Button>
        </div>
      </AlertTitle>
      
      {!status?.dllLoaded && (
        <AlertDescription className="mt-2">
          <div className="text-red-800">
            <strong>Error:</strong> {status?.dllLoadError || "Failed to load PacDrive DLL"}
          </div>
          <div className="mt-2">
            Make sure the PacDrive.dll file is present in the electron directory.
          </div>
          {status?.dllPath && (
            <div className="mt-1 text-xs">
              DLL path: {status.dllPath}
            </div>
          )}
        </AlertDescription>
      )}

      {status?.dllLoaded && !status.initialized && (
        <AlertDescription className="mt-2">
          <div className="text-amber-800">
            <strong>Warning:</strong> DLL loaded but PacDrive initialization failed
          </div>
          {status.initializationError && (
            <div className="text-red-700 mt-1">
              <strong>Error:</strong> {status.initializationError}
            </div>
          )}
          <div className="mt-2">
            Make sure PacDrive devices are properly connected and drivers are installed.
          </div>
          <div className="mt-1 text-sm">
            <Button variant="link" size="sm" className="p-0 text-xs" onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}>
              {showTechnicalDetails ? "Hide Technical Details" : "Show Technical Details"}
            </Button>
            {showTechnicalDetails && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs font-mono whitespace-pre-wrap">
                DLL Path: {status.dllPath || "Unknown"}<br />
                Initialization Result: {status.initialized ? "Success" : "Failed"}<br />
                Detected Device Count: {status.deviceCount}<br />
                Error: {status.initializationError || "None reported"}
              </div>
            )}
          </div>
        </AlertDescription>
      )}
      
      {expanded && status && (
        <AlertDescription className="mt-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>DLL Status:</div>
            <div>{status.dllLoaded ? "Loaded" : "Not Loaded"}</div>
            
            <div>Initialization:</div>
            <div>{status.initialized ? "Initialized" : "Not Initialized"}</div>
            
            <div>Device Count:</div>
            <div>{status.deviceCount}</div>
            
            {status.dllLoadError && (
              <>
                <div>DLL Error:</div>
                <div className="text-red-500">{status.dllLoadError}</div>
              </>
            )}
            
            {status.initializationError && (
              <>
                <div>Init Error:</div>
                <div className="text-red-500">{status.initializationError}</div>
              </>
            )}
          </div>
          
          {status.deviceCount > 0 && (
            <>
              <Separator className="my-2" />
              <div className="text-sm font-medium mb-1">Connected Devices</div>
              <div className="grid gap-2">
                {status.deviceDetails.map((device) => (
                  <div 
                    key={device.deviceId} 
                    className="text-xs bg-gray-50 p-2 rounded border"
                  >
                    <div className="grid grid-cols-2 gap-1">
                      <div>Device ID:</div>
                      <div>{device.deviceId}</div>
                      
                      <div>Vendor ID:</div>
                      <div>{device.vendorId || "Unknown"}</div>
                      
                      <div>Product ID:</div>
                      <div>{device.productId || "Unknown"}</div>
                      
                      <div>Status:</div>
                      <div>
                        {device.responsive ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Responsive
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            Not Responsive
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {diagnostics && (
            <>
              <Separator className="my-2" />
              <div className="text-sm font-medium mb-1">Diagnostics Results</div>
              <div className="bg-slate-50 p-3 rounded-md border text-xs">
                <div className="grid grid-cols-2 gap-y-1">
                  <div className="font-medium">Platform:</div>
                  <div>{diagnostics.platform}</div>
                  
                  <div className="font-medium">DLL Loaded:</div>
                  <div>{diagnostics.dllLoaded ? "Yes" : "No"}</div>
                  
                  <div className="font-medium">API Available:</div>
                  <div>{diagnostics.apiAvailable ? "Yes" : "No"}</div>
                  
                  <div className="font-medium">Initialization:</div>
                  <div>{diagnostics.initSuccessful ? "Successful" : "Failed"}</div>
                  
                  <div className="font-medium">Device Count:</div>
                  <div>{diagnostics.deviceCount}</div>
                  
                  {diagnostics.errorDetails && (
                    <>
                      <div className="font-medium">Error:</div>
                      <div className="text-red-600">{diagnostics.errorDetails}</div>
                    </>
                  )}
                </div>
                
                {diagnostics.suggestions.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium mb-1">Suggestions:</div>
                    <ul className="list-disc pl-5 space-y-1">
                      {diagnostics.suggestions.map((suggestion: string, idx: number) => (
                        <li key={idx}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <Collapsible className="mt-3">
                  <CollapsibleTrigger asChild>
                    <Button variant="link" size="sm" className="p-0 text-xs flex items-center">
                      <Info className="h-3 w-3 mr-1" />
                      Show System Information
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 p-2 bg-slate-100 rounded border border-slate-200 text-xs font-mono whitespace-pre-wrap">
                    {diagnostics.systemInfo ? JSON.stringify(diagnostics.systemInfo, null, 2) : "No system information available"}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </>
          )}
        </AlertDescription>
      )}
    </Alert>
  );
}
