import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useProcessMonitorControls } from '@/hooks/useProcessMonitorControls';
import { useLogContext } from '@/contexts/LogContext';
import { useLogControls } from '@/hooks/useLogControls';
import { useMessageListenerControls } from '@/hooks/useMessageListenerControls';
import { useMessageTimeoutControls } from '@/hooks/useMessageTimeoutControls';
import { useOutputOptimizationControls } from '@/hooks/useOutputOptimizationControls';
import { useStartupControls } from '@/hooks/useStartupControls';
import { useToast } from '@/hooks/use-toast';

export function DashboardSettingsSection() {
  const {
    isRunning,
    scanInterval,
    isLoading,
    toggleMonitor,
    setScanInterval
  } = useProcessMonitorControls();
  
  const {
    isLoggingEnabled,
    setLoggingEnabled
  } = useLogContext();

  const {
    maxLogEntries,
    updateMaxLogEntries,
    isLoading: isLogControlsLoading
  } = useLogControls();
  
  const {
    isEnabled: isMessageListenerEnabled,
    isLoading: isMessageListenerLoading,
    toggleMessageListener
  } = useMessageListenerControls();

  const {
    sendOnlyChangedValues,
    forceUpdateInterval,
    isLoading: isOptimizationLoading,
    setSendOnlyChangedValues,
    setForceUpdateInterval
  } = useOutputOptimizationControls();
  
  const {
    startMinimized,
    startWithWindows,
    isLoading: isStartupLoading,
    setStartMinimized,
    setStartWithWindows
  } = useStartupControls();

  const {
    timeout: messageTimeout,
    isTimeoutEnabled,
    setTimeoutFromMinSec: setMessageTimeout,
    setTimeoutEnabled,
    isLoading: isTimeoutLoading,
    formatSecondsToMinSec
  } = useMessageTimeoutControls();

  const { toast } = useToast();

  const [intervalInput, setIntervalInput] = useState(scanInterval.toString());
  const [forceUpdateInput, setForceUpdateInput] = useState(forceUpdateInterval.toString());
  const [maxLogEntriesInput, setMaxLogEntriesInput] = useState(maxLogEntries.toString());
  const [timeoutInput, setTimeoutInput] = useState(formatSecondsToMinSec(messageTimeout));

  const handleToggle = async () => {
    await toggleMonitor();
  };
  
  const handleLoggingToggle = (checked: boolean) => {
    setLoggingEnabled(checked);
  };
  
  const handleMessageListenerToggle = async (checked: boolean) => {
    await toggleMessageListener();
  };

  const handleOptimizationToggle = (checked: boolean) => {
    setSendOnlyChangedValues(checked);
  };
  
  const handleIntervalChange = (value: string) => {
    setIntervalInput(value);
  };
  
  const handleIntervalSubmit = async () => {
    const interval = parseInt(intervalInput, 10);
    if (!isNaN(interval) && interval >= 500 && interval <= 30000) {
      await setScanInterval(interval);
    } else {
      setIntervalInput(scanInterval.toString());
    }
  };

  const handleForceUpdateChange = (value: string) => {
    setForceUpdateInput(value);
  };

  const handleForceUpdateSubmit = async () => {
    const interval = parseInt(forceUpdateInput, 10);
    if (!isNaN(interval) && interval >= 1 && interval <= 2000) {
      await setForceUpdateInterval(interval);
    } else {
      setForceUpdateInput(forceUpdateInterval.toString());
    }
  };

  const handleMaxLogEntriesChange = (value: string) => {
    setMaxLogEntriesInput(value);
  };

  const handleMaxLogEntriesSubmit = async () => {
    const entries = parseInt(maxLogEntriesInput, 10);
    if (!isNaN(entries) && entries >= 1000 && entries <= 100000) {
      const success = await updateMaxLogEntries(entries);
      if (success) {
        toast({
          title: "Log Limit Updated",
          description: `Maximum log entries set to ${entries.toLocaleString()}`,
        });
      } else {
        toast({
          title: "Update Failed",
          description: "Failed to update log limit",
          variant: "destructive",
        });
        setMaxLogEntriesInput(maxLogEntries.toString());
      }
    } else {
      setMaxLogEntriesInput(maxLogEntries.toString());
      toast({
        title: "Invalid Value",
        description: "Log limit must be between 1,000 and 100,000 entries",
        variant: "destructive",
      });
    }
  };

  const handleTimeoutChange = (value: string) => {
    setTimeoutInput(value);
  };

  const handleTimeoutSubmit = async () => {
    const success = await setMessageTimeout(timeoutInput);
    if (success) {
      toast({
        title: "Timeout Updated",
        description: `Message timeout set to ${timeoutInput}`,
      });
    } else {
      toast({
        title: "Update Failed",
        description: "Invalid format. Use MM:SS (e.g., 2:00 for 2 minutes)",
        variant: "destructive",
      });
      setTimeoutInput(formatSecondsToMinSec(messageTimeout));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleIntervalSubmit();
    }
  };

  const handleForceUpdateKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleForceUpdateSubmit();
    }
  };

  const handleMaxLogEntriesKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleMaxLogEntriesSubmit();
    }
  };

  const handleTimeoutKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTimeoutSubmit();
    }
  };

  const handleTimeoutToggle = async (checked: boolean) => {
    const success = await setTimeoutEnabled(checked);
    if (!success) {
      toast({
        title: "Update Failed",
        description: "Failed to update timeout setting",
        variant: "destructive",
      });
    }
  };

  React.useEffect(() => {
    setIntervalInput(scanInterval.toString());
  }, [scanInterval]);

  React.useEffect(() => {
    setForceUpdateInput(forceUpdateInterval.toString());
  }, [forceUpdateInterval]);

  React.useEffect(() => {
    setMaxLogEntriesInput(maxLogEntries.toString());
  }, [maxLogEntries]);

  React.useEffect(() => {
    setTimeoutInput(formatSecondsToMinSec(messageTimeout));
  }, [messageTimeout, formatSecondsToMinSec]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">System Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Messages Listener */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Messages Listener</Label>
                  <p className="text-xs text-muted-foreground">Listen for game output messages</p>
                </div>
                <Switch 
                  checked={isMessageListenerEnabled} 
                  onCheckedChange={handleMessageListenerToggle}
                  disabled={isMessageListenerLoading}
                />
              </div>
              
              {isMessageListenerEnabled && (
                <div className="space-y-2">
                  {/* Timeout Toggle */}
                  <div className="flex items-center justify-between p-2 ml-4 bg-muted/30 rounded text-xs">
                    <Label className="text-muted-foreground">Disconnect Game Profile Due To Message Inactivity</Label>
                    <Switch 
                      checked={isTimeoutEnabled} 
                      onCheckedChange={handleTimeoutToggle}
                      disabled={isTimeoutLoading}
                    />
                  </div>
                  
                  {/* Timeout Input - only show when timeout is enabled */}
                  {isTimeoutEnabled && (
                    <div className="flex items-center justify-between p-2 ml-8 bg-muted/40 rounded text-xs">
                      <Label className="text-muted-foreground">Timeout</Label>
                      <div className="flex items-center space-x-1">
                        <Input 
                          type="text" 
                          value={timeoutInput} 
                          onChange={e => handleTimeoutChange(e.target.value)} 
                          onBlur={handleTimeoutSubmit} 
                          onKeyPress={handleTimeoutKeyPress} 
                          placeholder="2:00"
                          className="w-16 h-6 text-xs" 
                          disabled={isTimeoutLoading}
                        />
                        <span className="text-muted-foreground">min:sec</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Process Monitor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Process Monitor</Label>
                  <p className="text-xs text-muted-foreground">Auto-detect running processes</p>
                </div>
                <Switch 
                  checked={isRunning} 
                  onCheckedChange={handleToggle} 
                  disabled={isLoading} 
                />
              </div>
              
              {isRunning && (
                <div className="flex items-center justify-between p-2 ml-4 bg-muted/30 rounded text-xs">
                  <Label className="text-muted-foreground">Scan Interval</Label>
                  <div className="flex items-center space-x-1">
                    <Input 
                      type="number" 
                      value={intervalInput} 
                      onChange={e => handleIntervalChange(e.target.value)} 
                      onBlur={handleIntervalSubmit} 
                      onKeyPress={handleKeyPress} 
                      min={500} 
                      max={30000} 
                      className="w-20 h-6 text-xs" 
                    />
                    <span className="text-muted-foreground">ms</span>
                  </div>
                </div>
              )}
            </div>

            {/* System Logging */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">System Logging</Label>
                  <p className="text-xs text-muted-foreground">Enable system logging</p>
                </div>
                <Switch 
                  checked={isLoggingEnabled} 
                  onCheckedChange={handleLoggingToggle} 
                />
              </div>
              
              {isLoggingEnabled && (
                <>
                  <Alert className="bg-amber-50/50 border-amber-200 py-2">
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-800">
                      <strong>Warning:</strong> Logging increases CPU and memory usage
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex items-center justify-between p-2 ml-4 bg-muted/30 rounded text-xs">
                    <Label className="text-muted-foreground">Max Log Entries</Label>
                    <div className="flex items-center space-x-1">
                      <Input 
                        type="number" 
                        value={maxLogEntriesInput} 
                        onChange={e => handleMaxLogEntriesChange(e.target.value)} 
                        onBlur={handleMaxLogEntriesSubmit} 
                        onKeyPress={handleMaxLogEntriesKeyPress} 
                        min={1000} 
                        max={100000} 
                        className="w-20 h-6 text-xs"
                        disabled={isLogControlsLoading}
                      />
                      <span className="text-muted-foreground">entries</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Send Only Changed Values */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Send Changed Values Only</Label>
                  <p className="text-xs text-muted-foreground">Optimize output transmission</p>
                </div>
                <Switch 
                  checked={sendOnlyChangedValues} 
                  onCheckedChange={handleOptimizationToggle} 
                  disabled={isOptimizationLoading}
                />
              </div>

              {sendOnlyChangedValues && (
                <div className="flex items-center justify-between p-2 ml-4 bg-muted/30 rounded text-xs">
                  <Label className="text-muted-foreground">Force Update Cycles</Label>
                  <div className="flex items-center space-x-1">
                    <Input 
                      type="number" 
                      value={forceUpdateInput} 
                      onChange={e => handleForceUpdateChange(e.target.value)} 
                      onBlur={handleForceUpdateSubmit} 
                      onKeyPress={handleForceUpdateKeyPress} 
                      min={1} 
                      max={2000} 
                      className="w-20 h-6 text-xs" 
                    />
                    <span className="text-muted-foreground">cycles</span>
                  </div>
                </div>
              )}
            </div>

            {/* Start Minimized */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Start Minimized</Label>
                  <p className="text-xs text-muted-foreground">Launch minimized to tray</p>
                </div>
                <Switch 
                  checked={startMinimized} 
                  onCheckedChange={setStartMinimized}
                  disabled={isStartupLoading}
                />
              </div>
            </div>

            {/* Start with Windows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Start with Windows</Label>
                  <p className="text-xs text-muted-foreground">Auto-launch with Windows</p>
                </div>
                <Switch 
                  checked={startWithWindows} 
                  onCheckedChange={setStartWithWindows}
                  disabled={isStartupLoading}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
