import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import { TableCompact, TableCompactHeader, TableCompactBody, TableCompactRow, TableCompactHead, TableCompactCell } from '@/components/ui/table-compact';
import { useMemoryData } from '@/hooks/useMemoryData';
import { MemoryProfile } from '@/types/memoryProfiles';
import { Device } from '@/types/devices';
import { WLEDOutputProfile } from '@/lib/wledProfiles';
interface DispatchResult {
  label: string;
  lastValue: any;
  success: boolean;
  timestamp: Date;
}
interface MessageOutput {
  key: string;
  label: string;
  lastValue?: any;
  format?: string;
  script?: string;
}
interface MemoryOutputTableProps {
  isPolling: boolean;
  activeGameProfile: string | null;
  activeMemoryProfile: string | null;
  detectedGameProfile?: any;
  isMessageDetected?: boolean;
  messageOutputs?: MessageOutput[];
  devices: Device[];
  wledProfiles: WLEDOutputProfile[];
}

// Helper functions moved outside component to prevent recreation on every render
const extractMemoryValue = (resultObj: any): any => {
  if (resultObj === null || resultObj === undefined) {
    return 0;
  }
  if (resultObj !== null && typeof resultObj !== 'object') {
    if (typeof resultObj === 'bigint') {
      return Number(resultObj);
    }
    return resultObj;
  }
  if (resultObj !== null && typeof resultObj === 'object' && 'value' in resultObj) {
    const extractedValue = resultObj.value;
    if (extractedValue === null || extractedValue === undefined) {
      return 0;
    }
    if (typeof extractedValue === 'bigint') {
      return Number(extractedValue);
    }
    return extractedValue;
  }
  return resultObj || 0;
};
const evaluateFormat = (format: string, value: any): string => {
  if (value === null || value === undefined) {
    value = 0;
  }
  if (!format || format === '') return value.toString();
  try {
    const decimalPattern = /^0(\.0+)?$/;
    if (decimalPattern.test(format.trim())) {
      const numericValue = Number(value);
      if (!isNaN(numericValue)) {
        const decimalMatch = format.match(/\.0+/);
        if (decimalMatch) {
          const decimalPlaces = decimalMatch[0].length - 1;
          return numericValue.toFixed(decimalPlaces);
        } else {
          return Math.round(numericValue).toString();
        }
      }
      return value.toString();
    }
    if (format.includes('{value}')) {
      const result = format.replace('{value}', value.toString());
      return result;
    }
    if (format.includes('{') && format.includes('}')) {
      const expressionMatch = format.match(/{([^}]+)}/);
      if (expressionMatch && expressionMatch[1]) {
        const expression = expressionMatch[1].trim();
        const evalFn = new Function('value', `return ${expression}`);
        const result = evalFn(value);
        const finalResult = format.replace(/{([^}]+)}/, result);
        return finalResult;
      }
    }
    return format;
  } catch (err) {
    return value.toString();
  }
};
const determineOutputType = (output: any): 'MSG' | 'MEM' => {
  if (output.key && !output.address && !output.offset && !output.useModuleOffset) {
    return 'MSG';
  }
  if (output.address || output.offset || output.useModuleOffset) {
    return 'MEM';
  }
  if (output.address || output.offset || output.useModuleOffset) {
    return 'MEM';
  }
  if (output.key) {
    return 'MSG';
  }
  return 'MEM';
};

// Memoized device info calculation with enhanced target display logic
const getDeviceInfo = (output: any, devices: Device[], wledProfiles: WLEDOutputProfile[]): {
  deviceType: string;
  target: string;
} => {
  let deviceType = 'None';
  let target = 'None';
  if (output.device && output.device !== 'none') {
    if (output.device.startsWith('serial_')) {
      deviceType = 'Serial';
      target = output.device.replace('serial_', '') + (output.channel ? ` Ch${output.channel}` : '');
    } else if (output.device.startsWith('pacdrive_')) {
      deviceType = 'PacDrive';
      target = `Ch${output.channel || 'N/A'}`;
    } else if (output.device.startsWith('wled_')) {
      deviceType = 'WLED';
      target = output.device.replace('wled_', '');
    } else if (output.device === 'Serial') {
      deviceType = 'Serial';
      // Look up device name using targetDevice
      if (output.targetDevice) {
        const device = devices.find(d => d.id === output.targetDevice);
        target = device ? device.name : output.targetDevice;
      } else {
        target = 'N/A';
      }
    } else if (output.device === 'PacDrive') {
      deviceType = 'PacDrive';
      // Look up device name using targetDevice and append channel
      if (output.targetDevice) {
        const device = devices.find(d => d.id === output.targetDevice);
        const deviceName = device ? device.name : output.targetDevice;
        target = `${deviceName} Ch${output.channel || 'N/A'}`;
      } else {
        target = `Ch${output.channel || 'N/A'}`;
      }
    } else if (output.device === 'WLED') {
      deviceType = 'WLED';
      // Look up WLED profile name using wledProfileId
      if (output.wledProfileId) {
        const wledProfile = wledProfiles.find(p => p.id === output.wledProfileId);
        target = wledProfile ? wledProfile.name : output.wledProfileId;
      } else {
        target = 'N/A';
      }
    } else {
      deviceType = output.device;
      target = output.targetDevice || output.channel ? `Ch${output.channel}` : 'N/A';
    }
  }
  return {
    deviceType,
    target
  };
};
const formatValue = (value: any, isRaw: boolean = false) => {
  if (value === null || value === undefined || value === 'N/A') return 'N/A';
  if (isRaw) {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toString() : value.toString();
    }
    return String(value);
  }
  if (typeof value === 'number') return value.toFixed(2);
  return String(value);
};
const MemoryOutputTable: React.FC<MemoryOutputTableProps> = ({
  isPolling,
  activeGameProfile,
  activeMemoryProfile,
  detectedGameProfile,
  isMessageDetected,
  messageOutputs = [],
  devices,
  wledProfiles
}) => {
  const [dispatchResults, setDispatchResults] = useState<DispatchResult[]>([]);
  const [activeProfile, setActiveProfile] = useState<any>(null);
  const [memoryProfile, setMemoryProfile] = useState<MemoryProfile | null>(null);
  const {
    memoryData,
    isLiveData
  } = useMemoryData(memoryProfile);

  // Memoize profile loading logic
  const profileToLoad = useMemo(() => {
    return detectedGameProfile || (activeGameProfile ? 'load-from-api' : null);
  }, [detectedGameProfile, activeGameProfile]);
  useEffect(() => {
    const loadProfile = async () => {
      let profile = detectedGameProfile;
      if (!profile && activeGameProfile) {
        try {
          const gameProfileResult = await window.electron?.getGameProfile?.(activeGameProfile);
          profile = gameProfileResult?.profile || null;
        } catch (error) {
          profile = null;
        }
      }
      if (!profile) {
        setActiveProfile(null);
        setMemoryProfile(null);
        return;
      }
      try {
        setActiveProfile(profile);
        if (profile.memoryFile) {
          try {
            const memoryProfileResult = await window.electron?.getMemoryProfile?.(profile.memoryFile);
            if (memoryProfileResult && memoryProfileResult.success && memoryProfileResult.profile) {
              const loadedMemoryProfile: MemoryProfile = {
                id: memoryProfileResult.profile.id || profile.memoryFile,
                fileName: profile.memoryFile,
                process: memoryProfileResult.profile.process,
                pollInterval: memoryProfileResult.profile.pollInterval,
                outputs: memoryProfileResult.profile.outputs || []
              };
              setMemoryProfile(loadedMemoryProfile);
            } else {
              setMemoryProfile(null);
            }
          } catch (memoryError) {
            setMemoryProfile(null);
          }
        } else {
          setMemoryProfile(null);
        }
      } catch (error) {
        setActiveProfile(null);
        setMemoryProfile(null);
      }
    };
    loadProfile();
  }, [profileToLoad, activeGameProfile]);
  useEffect(() => {
    if (!window.electron?.ipcRenderer) return;
    const handleDispatchResult = (_event: any, results: any[]) => {
      const newResults = results.map(result => ({
        label: result.label,
        lastValue: result.value,
        success: result.success,
        timestamp: new Date()
      }));
      setDispatchResults(newResults);
    };
    window.electron.ipcRenderer.on('output:dispatch-results', handleDispatchResult);
    return () => {
      window.electron.ipcRenderer.removeListener('output:dispatch-results', handleDispatchResult);
    };
  }, []);

  // Memoize expensive table data processing
  const tableData = useMemo(() => {
    if (!activeProfile?.outputs) return [];
    const activeOutputs = activeProfile.outputs.filter(output => output.isActive !== false);
    const processedData = activeOutputs.map(output => {
      const profileType = determineOutputType(output);
      let rawValue: string = 'N/A';
      if (profileType === 'MSG') {
        const messageKey = output.key || output.address;
        const messageOutput = messageOutputs.find(msg => {
          return msg.key === messageKey || msg.label === output.label || msg.key === output.label;
        });
        rawValue = messageOutput?.lastValue !== undefined ? String(messageOutput.lastValue) : 'N/A';
      } else {
        const memoryResult = memoryData[output.label];
        const extractedValue = extractMemoryValue(memoryResult);
        rawValue = extractedValue !== undefined ? String(extractedValue) : 'N/A';
      }
      let finalValue: string | number = rawValue;
      if (output.script && rawValue !== 'N/A') {
        try {
          const numericValue = Number(rawValue);
          if (!isNaN(numericValue)) {
            const scriptFn = new Function('value', `return ${output.script}`);
            finalValue = scriptFn(numericValue);
          }
        } catch (error) {
          finalValue = rawValue;
        }
      }
      if (output.invert && rawValue !== 'N/A') {
        const numericValue = Number(finalValue);
        if (!isNaN(numericValue)) {
          finalValue = numericValue === 0 ? 1 : numericValue === 1 ? 0 : numericValue;
        }
      }
      if (output.format && rawValue !== 'N/A') {
        try {
          finalValue = evaluateFormat(output.format, finalValue);
        } catch (error) {
          finalValue = String(finalValue);
        }
      }
      const {
        deviceType,
        target
      } = getDeviceInfo(output, devices, wledProfiles);
      return {
        label: output.label,
        profileType,
        rawValue: rawValue ?? 'N/A',
        finalValue: finalValue ?? 'N/A',
        deviceType,
        target
      };
    });

    // Sort by label alphabetically (memoized)
    return processedData.sort((a, b) => a.label.localeCompare(b.label));
  }, [activeProfile?.outputs, memoryData, messageOutputs, dispatchResults, devices, wledProfiles]);

  // Early returns with memoized conditions
  const hasProfileToShow = useMemo(() => detectedGameProfile || isPolling && activeGameProfile, [detectedGameProfile, isPolling, activeGameProfile]);
  const hasMessageData = useMemo(() => messageOutputs.length > 0, [messageOutputs.length]);
  const isLiveDataShowing = useMemo(() => isLiveData || hasMessageData, [isLiveData, hasMessageData]);
  if (!hasProfileToShow) {
    return <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Memory & Output Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p>No Game Profile loaded. You’ll need to turn on a monitor (Process or Message) and link up a Game Profile. Otherwise, this is just a static UI flex</p>
          </div>
        </CardContent>
      </Card>;
  }
  if (!activeProfile) {
    return <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Memory & Output Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p>Loading game profile...</p>
          </div>
        </CardContent>
      </Card>;
  }
  return <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>Memory & Output Status</span>
          {isLiveDataShowing && <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-300">
              Live
            </Badge>}
          {isMessageDetected && <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-300">
              Auto-Detected
            </Badge>}
          {detectedGameProfile && !isPolling && <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-300">
              Preview
            </Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tableData.length === 0 ? <div className="text-center text-muted-foreground py-4">
            No active outputs configured in the current game profile.
          </div> : <div className="overflow-x-auto">
            <TableCompact>
              <TableCompactHeader>
                <TableCompactRow>
                  <TableCompactHead className="w-[150px]">Label</TableCompactHead>
                  <TableCompactHead className="w-[60px] text-center">Type</TableCompactHead>
                  <TableCompactHead className="w-[100px] text-right font-mono">Raw Value</TableCompactHead>
                  <TableCompactHead className="w-[100px] text-right font-mono">Final Value</TableCompactHead>
                  <TableCompactHead className="w-[100px]">Output Device</TableCompactHead>
                  <TableCompactHead className="w-[120px]">Target</TableCompactHead>
                </TableCompactRow>
              </TableCompactHeader>
              <TableCompactBody>
                {tableData.map((row, index) => <TableCompactRow key={index}>
                    <TableCompactCell className="font-medium">{row.label}</TableCompactCell>
                    <TableCompactCell className="text-center">
                      <Badge variant="outline" className={`text-xs ${row.profileType === 'MEM' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-purple-50 text-purple-700 border-purple-300'}`}>
                        {row.profileType}
                      </Badge>
                    </TableCompactCell>
                    <TableCompactCell className="text-right font-mono">{formatValue(row.rawValue, true)}</TableCompactCell>
                    <TableCompactCell className="text-right font-mono">{formatValue(row.finalValue, false)}</TableCompactCell>
                    <TableCompactCell>{row.deviceType}</TableCompactCell>
                    <TableCompactCell className="font-mono">{row.target}</TableCompactCell>
                  </TableCompactRow>)}
              </TableCompactBody>
            </TableCompact>
          </div>}
        
        {detectedGameProfile && !isPolling && <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 text-center">
              Game profile auto-detected: <strong>{detectedGameProfile.profileName}</strong>. 
              Start memory polling to see live values.
            </p>
          </div>}
      </CardContent>
    </Card>;
};
export { MemoryOutputTable };