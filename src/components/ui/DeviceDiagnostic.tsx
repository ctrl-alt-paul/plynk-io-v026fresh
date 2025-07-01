import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader, Bug, AlertCircle, Check, Info } from 'lucide-react';
import { isElectron } from '@/utils/isElectron';
import { HidDeviceInfo } from '@/types/devices';
import { extractDeviceIndex, getDevicePathDebugInfo } from '@/utils/deviceUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DeviceDiagnosticProps {
  className?: string;
}

export function DeviceDiagnostic({ className = "" }: DeviceDiagnosticProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [hidDevices, setHidDevices] = useState<HidDeviceInfo[]>([]);
  const [pacDriveStatus, setPacDriveStatus] = useState<any>(null);
  const [hidEnabled, setHidEnabled] = useState(false);
  const [pacEnabled, setPacEnabled] = useState(false);
  const [systemInfo, setSystemInfo] = useState<{platform: string; electronVersion: string}>({
    platform: 'unknown',
    electronVersion: 'unknown'
  });
  const [displayTechnicalDetails, setDisplayTechnicalDetails] = useState(false);

  const runDiagnostics = async () => {
    setIsLoading(true);
    const diagnosticResults: any = {
      timestamp: new Date().toISOString(),
      electronAvailable: isElectron(),
      platform: window.electron?.platform || 'unknown',
      hidDeviceCount: 0,
      pacDriveStatus: null,
      errors: []
    };

    try {
      // Get system info
      diagnosticResults.platform = window.electron?.platform || 'unknown';
      setSystemInfo({
        platform: diagnosticResults.platform,
        electronVersion: window.electron ? 'Available' : 'Not Available'
      });

      // Check if HID is available
      if (window.electron?.listHidDevices) {
        setHidEnabled(true);
        try {
          console.log("DeviceDiagnostic: Requesting HID devices...");
          const devices = await window.electron.listHidDevices();
          console.log(`DeviceDiagnostic: Received ${devices.length} HID devices`);
          diagnosticResults.hidDeviceCount = devices.length;
          diagnosticResults.hidDevices = devices;
          setHidDevices(devices);
          
          // Log first device for debugging
          if (devices.length > 0) {
            console.log("DeviceDiagnostic: First HID device example:", devices[0]);
          }
        } catch (error) {
          console.error("Error listing HID devices:", error);
          diagnosticResults.errors.push({
            component: 'HID',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else {
        diagnosticResults.errors.push({
          component: 'HID',
          error: 'HID device API not available'
        });
      }

      // Check PacDrive status
      if (window.electron?.getPacDriveStatus) {
        setPacEnabled(true);
        try {
          console.log("DeviceDiagnostic: Requesting PacDrive status...");
          const status = await window.electron.getPacDriveStatus();
          console.log("DeviceDiagnostic: PacDrive status received:", status);
          diagnosticResults.pacDriveStatus = status;
          setPacDriveStatus(status);
        } catch (error) {
          console.error("Error getting PacDrive status:", error);
          diagnosticResults.errors.push({
            component: 'PacDrive',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else {
        diagnosticResults.errors.push({
          component: 'PacDrive',
          error: 'PacDrive API not available'
        });
      }
    } catch (error) {
      console.error("Diagnostic error:", error);
      diagnosticResults.errors.push({
        component: 'General',
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setResults(diagnosticResults);
      setIsLoading(false);
    }
  };

  // Run diagnostics on component mount
  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Device Diagnostics
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setDisplayTechnicalDetails(!displayTechnicalDetails)}
            >
              {displayTechnicalDetails ? "Hide Details" : "Show Technical Details"}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={runDiagnostics}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                'Run Diagnostics'
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="p-4 flex justify-center">
            <Loader className="h-8 w-8 animate-spin" />
          </div>
        ) : results ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded p-3 text-center">
                <div className="text-muted-foreground text-sm">Platform</div>
                <div className="text-xl font-medium">{results.platform}</div>
              </div>
              <div className="border rounded p-3 text-center">
                <div className="text-muted-foreground text-sm">HID Devices</div>
                <div className="text-xl font-medium">{results.hidDeviceCount}</div>
              </div>
              <div className="border rounded p-3 text-center">
                <div className="text-muted-foreground text-sm">PacDrive Status</div>
                {pacDriveStatus ? (
                  <div className={`text-xl font-medium ${pacDriveStatus.initialized ? 'text-green-600' : 'text-red-600'}`}>
                    {pacDriveStatus.initialized ? 'Ready' : 'Not Ready'}
                  </div>
                ) : (
                  <div className="text-xl font-medium text-amber-600">Unknown</div>
                )}
              </div>
            </div>

            {/* API Status */}
            <div className="bg-muted/30 p-4 rounded">
              <h3 className="font-medium mb-2">API Status</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center">
                  <div className={hidEnabled ? 'text-green-500' : 'text-red-500'}>
                    {hidEnabled ? <Check size={16} /> : <AlertCircle size={16} />}
                  </div>
                  <span className="ml-2">HID Device API</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-4 w-4 ml-1">
                          <Info className="h-3 w-3" />
                          <span className="sr-only">Info</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Required for detecting HID devices</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center">
                  <div className={pacEnabled ? 'text-green-500' : 'text-red-500'}>
                    {pacEnabled ? <Check size={16} /> : <AlertCircle size={16} />}
                  </div>
                  <span className="ml-2">PacDrive API</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-4 w-4 ml-1">
                          <Info className="h-3 w-3" />
                          <span className="sr-only">Info</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Required for controlling PacDrive devices</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            {/* Errors */}
            {results.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <h3 className="font-medium text-red-800 mb-2">Errors Found</h3>
                <ul className="space-y-1">
                  {results.errors.map((err: any, idx: number) => (
                    <li key={idx} className="text-red-600 text-sm">
                      <strong>{err.component}:</strong> {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Advanced Technical Details */}
            {displayTechnicalDetails && (
              <>
                {/* PacDrive Status Details */}
                {pacDriveStatus && (
                  <div className="bg-muted/20 border rounded p-4">
                    <h3 className="font-medium mb-2">PacDrive Details</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <strong>DLL Loaded:</strong> {pacDriveStatus.dllLoaded ? 'Yes' : 'No'}
                      </div>
                      {pacDriveStatus.dllLoadError && (
                        <div>
                          <strong>DLL Error:</strong> <span className="text-red-600">{pacDriveStatus.dllLoadError}</span>
                        </div>
                      )}
                      <div>
                        <strong>Device Count:</strong> {pacDriveStatus.deviceCount}
                      </div>
                      <div>
                        <strong>Connected Devices:</strong> {pacDriveStatus.connectedDevices?.join(', ') || 'None'}
                      </div>
                    </div>
                  </div>
                )}

                {/* HID Devices */}
                {hidDevices.length > 0 && (
                  <div className="bg-muted/20 border rounded p-4">
                    <h3 className="font-medium mb-2">HID Devices Found ({hidDevices.length})</h3>
                    <div className="space-y-3 max-h-40 overflow-y-auto">
                      {hidDevices.slice(0, 5).map((device, idx) => {
                        const deviceIndex = extractDeviceIndex(device.path);
                        const isPacDrive = (
                          (device.vendorId === "0xD209" || device.vendorId === "53769" || 
                            Number(device.vendorId) === 0xD209 || Number(device.vendorId) === 53769) &&
                          (device.productId === "0x1500" || device.productId === "0x1501" || device.productId === "5376" || 
                            Number(device.productId) === 0x1500 || Number(device.productId) === 0x1501 || Number(device.productId) === 5376)
                        );
                        
                        return (
                          <div key={idx} className={`p-2 border rounded text-xs ${isPacDrive ? 'border-green-300 bg-green-50' : ''}`}>
                            <div><strong>Device:</strong> {device.product || `Device ${idx}`}</div>
                            <div><strong>Vendor/Product ID:</strong> {device.vendorId}/{device.productId}</div>
                            <div><strong>Path:</strong> <span className="font-mono text-xs break-all">{device.path}</span></div>
                            {deviceIndex >= 0 && <div><strong>Extracted Index:</strong> {deviceIndex}</div>}
                            {isPacDrive && <div className="text-green-600 font-medium">Likely PacDrive device</div>}
                          </div>
                        );
                      })}
                      {hidDevices.length > 5 && (
                        <div className="text-center text-muted-foreground">
                          {hidDevices.length - 5} more devices not shown
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* System Info */}
                <div className="bg-muted/20 border rounded p-4">
                  <h3 className="font-medium mb-2">System Information</h3>
                  <div className="space-y-1 text-sm">
                    <div><strong>Platform:</strong> {systemInfo.platform}</div>
                    <div><strong>Electron:</strong> {systemInfo.electronVersion}</div>
                    <div><strong>Renderer:</strong> {window.navigator.userAgent}</div>
                  </div>
                </div>
              </>
            )}

            {/* Timestamp */}
            <div className="text-xs text-muted-foreground text-right">
              Last checked: {new Date(results.timestamp).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="text-center p-4">No diagnostic results available</div>
        )}
      </CardContent>
    </Card>
  );
}
