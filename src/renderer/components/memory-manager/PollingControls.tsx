import React from 'react';
import { Play, Pause, RefreshCw, AlertCircle, Zap, Clock, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModuleNameInput } from "@/renderer/components/ModuleNameInput";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";

interface PollingControlsProps {
  isPollEnabled: boolean;
  isPolling: boolean;
  pollInterval: number;
  isLoading: boolean;
  selectedProcess: string | null;
  fetchProcesses: () => Promise<void>;
  setPollInterval: (interval: number) => void;
  startPolling: () => void;
  stopPolling: () => void;
  readMemory: () => Promise<void>;
  onProcessChange: (process: string) => void;
  currentProfileName: string | null;
  hasAddresses: boolean;
  mode?: 'full' | 'process-only' | 'controls-only';
  // Performance metrics props
  performanceMetrics?: {
    lastPollDuration: number;
    avgPollDuration: number;
    pollsPerSecond: number;
    skippedPolls?: number;
  };
  // Caching control props
  disableCaching?: boolean;
  toggleCaching?: () => void;
  // Fast Mode props
  fastModeEnabled?: boolean;
  toggleFastMode?: () => void;
  // Error reporting
  errorCount?: number;
  lastError?: string | null;
}

const PollingControls: React.FC<PollingControlsProps> = ({
  isPollEnabled,
  isPolling,
  pollInterval,
  isLoading,
  selectedProcess,
  fetchProcesses,
  setPollInterval,
  startPolling,
  stopPolling,
  readMemory,
  onProcessChange,
  currentProfileName,
  hasAddresses,
  mode = 'full',
  performanceMetrics,
  disableCaching = false,
  toggleCaching,
  fastModeEnabled = false,
  toggleFastMode,
  errorCount = 0,
  lastError
}) => {
  const showProcessSelection = mode === 'full' || mode === 'process-only';
  const showPollingControls = mode === 'full' || mode === 'controls-only';

  // Helper to format times to whole number with ms suffix
  const formatTime = (ms: number) => `${Math.round(ms)}ms`;
  
  // Format number with commas
  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      {showProcessSelection && (
        <div className="flex-1">
          <label htmlFor="process-select" className="mb-2 block">
            Select Process
          </label>
          <div className="flex items-center gap-2 w-full md:w-[450px]">
            <ModuleNameInput
              id="process-select"
              value={selectedProcess || ""}
              onChange={onProcessChange}
              className="w-full md:w-[450px]"
            />
            <Button onClick={fetchProcesses} variant="outline" size="sm" disabled={isLoading}>
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>
          {currentProfileName && (
            <p className="text-xs text-muted-foreground mt-1">
              You can change the process name even when using a profile.
            </p>
          )}
        </div>
      )}

      {showPollingControls && hasAddresses && (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <Button onClick={readMemory} variant="outline" size="sm" disabled={isLoading}>
              {isPolling ? <Play className="mr-1 h-4 w-4" /> : "Read"}
            </Button>
            
            {isPollEnabled ? (
              <Button onClick={stopPolling} variant="outline" size="sm">
                <Pause className="mr-1 h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button onClick={startPolling} variant="outline" size="sm">
                <Play className="mr-1 h-4 w-4" />
                Start Polling
              </Button>
            )}
            
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                min="16"
                max="10000"
                value={pollInterval}
                onChange={e => setPollInterval(Number(e.target.value))}
                className="w-20 text-xs"
              />
              <span className="text-xs text-muted-foreground">ms</span>
            </div>
            
            {/* Fast Mode toggle */}
            {toggleFastMode && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="fast-mode" 
                        checked={fastModeEnabled} 
                        onCheckedChange={toggleFastMode} 
                      />
                      <Label htmlFor="fast-mode" className="text-xs flex items-center">
                        <Zap className={`h-3 w-3 mr-1 ${fastModeEnabled ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                        Fast Mode
                      </Label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Skip value transformations during polling for maximum performance
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Caching toggle control */}
            {toggleCaching && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="disable-caching" 
                        checked={disableCaching} 
                        onCheckedChange={toggleCaching} 
                      />
                      <Label htmlFor="disable-caching" className="text-xs">No Cache</Label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Disable memory value caching for more accurate (but potentially slower) readings
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          {/* Performance metrics display */}
          {isPolling && performanceMetrics && (
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
              <span>
                Last: {formatTime(performanceMetrics.lastPollDuration)}
              </span>
              <span>
                Avg: {formatTime(performanceMetrics.avgPollDuration)}
              </span>
              <span>
                Rate: {performanceMetrics.pollsPerSecond.toFixed(1)}/sec
              </span>
              {performanceMetrics.skippedPolls !== undefined && performanceMetrics.skippedPolls > 0 && (
                <span className={`flex items-center gap-1 ${performanceMetrics.skippedPolls > 10 ? 'text-amber-500' : 'text-blue-500'}`}>
                  <Clock className="h-3 w-3" />
                  {formatNumber(performanceMetrics.skippedPolls)} skipped
                </span>
              )}
              {performanceMetrics.avgPollDuration > pollInterval && (
                <span className="text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Poll taking longer than interval
                </span>
              )}
              
              {/* Display for errors */}
              {errorCount > 0 && (
                <span className="text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {errorCount} error{errorCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
          
          {/* Last error message */}
          {lastError && (
            <div className="text-xs text-red-500 flex items-center gap-1 mt-1">
              <AlertTriangle className="h-3 w-3" />
              {lastError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PollingControls;
